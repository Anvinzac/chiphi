-- Kitchen (bep) account: submits ingredient orders for admin approval.
-- Pending orders stay in orders/order_items until approved, because
-- payments.total_amount is force-overwritten by update_payment_total_trigger.

-- 1. Extend the order lifecycle: pending (awaiting approval) and rejected (declined).
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'shared', 'closed', 'pending', 'rejected'));

-- 2. Reviewer trail so approvals are auditable.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

-- 3. Which admin a kitchen account submits to.
CREATE TABLE IF NOT EXISTS public.kitchen_accounts (
  kitchen_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kitchen_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kitchen reads own link" ON public.kitchen_accounts;
CREATE POLICY "kitchen reads own link"
  ON public.kitchen_accounts FOR SELECT TO authenticated
  USING (auth.uid() = kitchen_user_id);

DROP POLICY IF EXISTS "admin manages own kitchen accounts" ON public.kitchen_accounts;
CREATE POLICY "admin manages own kitchen accounts"
  ON public.kitchen_accounts FOR ALL TO authenticated
  USING (auth.uid() = admin_user_id)
  WITH CHECK (auth.uid() = admin_user_id);

-- Resolves the admin a kitchen account belongs to. Read by RLS, so no
-- dependency on user_roles (which is currently self-granted client-side).
CREATE OR REPLACE FUNCTION public.admin_for_kitchen(p_kitchen uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_user_id
  FROM public.kitchen_accounts
  WHERE kitchen_user_id = p_kitchen
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.kitchen_ids_for_admin(p_admin uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kitchen_user_id
  FROM public.kitchen_accounts
  WHERE admin_user_id = p_admin;
$$;

GRANT EXECUTE ON FUNCTION public.admin_for_kitchen(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kitchen_ids_for_admin(uuid) TO anon, authenticated;

-- 4. Kitchen reads the admin's catalog (read-only). INSERT/UPDATE/DELETE stay
--    owner-only under the existing policies.
DROP POLICY IF EXISTS "kitchen reads admin catalog" ON public.order_categories;
CREATE POLICY "kitchen reads admin catalog"
  ON public.order_categories FOR SELECT TO authenticated
  USING (user_id = public.admin_for_kitchen(auth.uid()));

DROP POLICY IF EXISTS "kitchen reads admin ingredients" ON public.order_ingredients;
CREATE POLICY "kitchen reads admin ingredients"
  ON public.order_ingredients FOR SELECT TO authenticated
  USING (user_id = public.admin_for_kitchen(auth.uid()));

-- 5. Admin sees the kitchen's orders and their lines.
--    Note: uses admin_for_kitchen, not has_role, so it keeps working if the
--    client-side admin self-grant in useAdminDemoAuth is ever removed.
DROP POLICY IF EXISTS "admin reads kitchen orders" ON public.orders;
CREATE POLICY "admin reads kitchen orders"
  ON public.orders FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.kitchen_ids_for_admin(auth.uid())));

DROP POLICY IF EXISTS "admin reads kitchen order_items" ON public.order_items;
CREATE POLICY "admin reads kitchen order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id IN (SELECT public.kitchen_ids_for_admin(auth.uid()))
  ));

-- 6. Kitchen submits a non-empty draft for approval.
CREATE OR REPLACE FUNCTION public.submit_order_for_approval(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF public.admin_for_kitchen(auth.uid()) IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO n FROM public.order_items WHERE order_id = p_order_id;
  IF n = 0 THEN
    RAISE EXCEPTION 'Đơn trống — thêm ít nhất một nguyên liệu';
  END IF;

  UPDATE public.orders
     SET status = 'pending',
         reviewed_at = NULL,
         reviewed_by = NULL,
         review_note = NULL,
         updated_at = now()
   WHERE id = p_order_id
     AND user_id = auth.uid()
     AND status IN ('draft', 'rejected');
  RETURN FOUND;
END;
$$;

-- 7. What the admin reviews.
CREATE OR REPLACE FUNCTION public.list_pending_orders()
RETURNS TABLE (
  order_id uuid,
  title text,
  customer_name text,
  submitted_at timestamptz,
  item_count bigint,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT o.id,
           o.title,
           o.customer_name,
           o.updated_at,
           (SELECT count(*) FROM public.order_items i WHERE i.order_id = o.id),
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'id', i.id,
               'name', i.name,
               'quantity', i.quantity,
               'unit', i.unit,
               'retail_price', i.retail_price,
               'money_amount', i.money_amount,
               'order_mode', i.order_mode
             ) ORDER BY i.sort_order)
             FROM public.order_items i WHERE i.order_id = o.id
           ), '[]'::jsonb)
    FROM public.orders o
    WHERE o.status = 'pending'
      AND o.user_id IN (SELECT public.kitchen_ids_for_admin(auth.uid()))
    ORDER BY o.updated_at ASC;
END;
$$;

-- 8. Approve: write a receipt owned by the ADMIN, then close the order.
--    payments.total_amount is recomputed by update_payment_total_trigger.
CREATE OR REPLACE FUNCTION public.approve_order(
  p_order_id uuid,
  p_supplier_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_amounts jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_pid uuid;
  v_title text;
BEGIN
  IF v_admin IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  SELECT o.title INTO v_title
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.status = 'pending'
    AND o.user_id IN (SELECT public.kitchen_ids_for_admin(v_admin));

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Đơn không còn chờ duyệt';
  END IF;

  INSERT INTO public.payments (date, time, total_amount, supplier_id, notes, user_id)
  VALUES (CURRENT_DATE, CURRENT_TIME, 0, p_supplier_id,
          COALESCE(p_note, 'Từ đơn bếp: ' || v_title), v_admin)
  RETURNING id INTO v_pid;

  INSERT INTO public.sub_payments (
    payment_id, item_name, quantity, unit_price, amount, notes, user_id, payment_method
  )
  SELECT v_pid,
         i.name,
         COALESCE(i.quantity, 1),
         CASE WHEN COALESCE((p_amounts ->> i.id::text)::numeric, i.money_amount, 0) > 0
                   AND COALESCE(i.quantity, 1) <> 0
              THEN COALESCE((p_amounts ->> i.id::text)::numeric, i.money_amount, 0) / COALESCE(i.quantity, 1)
              ELSE 0 END,
         COALESCE((p_amounts ->> i.id::text)::numeric, i.money_amount, 0),
         'Từ đơn bếp: ' || v_title,
         v_admin,
         'cash'
  FROM public.order_items i
  WHERE i.order_id = p_order_id;

  UPDATE public.orders
     SET status = 'closed',
         reviewed_at = now(),
         reviewed_by = v_admin,
         review_note = p_note,
         updated_at = now()
   WHERE id = p_order_id;

  RETURN v_pid;
END;
$$;

-- 9. Reject: back to the kitchen as rejected, with an optional reason.
CREATE OR REPLACE FUNCTION public.reject_order(p_order_id uuid, p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL THEN RETURN false; END IF;

  UPDATE public.orders
     SET status = 'rejected',
         reviewed_at = now(),
         reviewed_by = v_admin,
         review_note = p_note,
         updated_at = now()
   WHERE id = p_order_id
     AND status = 'pending'
     AND user_id IN (SELECT public.kitchen_ids_for_admin(v_admin));
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order_for_approval(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_orders() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_order(uuid, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_order(uuid, text) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
