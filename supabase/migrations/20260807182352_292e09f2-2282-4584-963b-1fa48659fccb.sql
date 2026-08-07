CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Đơn hàng',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'closed')),
  share_token TEXT NOT NULL UNIQUE,
  supplier_pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'kg',
  retail_price NUMERIC,
  fulfilled_qty NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'done')),
  notice TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX orders_user_id_idx ON public.orders (user_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own orders"
ON public.orders FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners manage own order_items"
ON public.order_items FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER order_items_set_updated_at BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public access only via token-scoped RPCs (never exposes supplier_pin_hash)
CREATE OR REPLACE FUNCTION public.get_shared_order(p_token TEXT)
RETURNS TABLE (id UUID, title TEXT, status TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.status, o.created_at, o.updated_at
  FROM public.orders o
  WHERE o.share_token = p_token
    AND o.status IN ('shared', 'closed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verify_order_pin(p_token TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.share_token = p_token
      AND o.status IN ('shared', 'closed')
      AND o.supplier_pin_hash = p_pin
  );
$$;

CREATE OR REPLACE FUNCTION public.get_shared_order_items(p_token TEXT)
RETURNS SETOF public.order_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM public.order_items i
  INNER JOIN public.orders o ON o.id = i.order_id
  WHERE o.share_token = p_token
    AND o.status IN ('shared', 'closed')
  ORDER BY i.sort_order ASC, i.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_shared_order_item(
  p_token TEXT,
  p_item_id UUID,
  p_retail_price NUMERIC,
  p_fulfilled_qty NUMERIC,
  p_status TEXT,
  p_notice TEXT
)
RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.order_items;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'partial', 'done') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.order_items i
  SET retail_price = p_retail_price,
      fulfilled_qty = p_fulfilled_qty,
      status = p_status,
      notice = p_notice,
      updated_at = now()
  FROM public.orders o
  WHERE i.id = p_item_id
    AND i.order_id = o.id
    AND o.share_token = p_token
    AND o.status = 'shared'
  RETURNING i.* INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'order item not found or not editable';
  END IF;

  RETURN updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_order(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_pin(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_order_items(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_order_item(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;