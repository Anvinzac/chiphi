-- Vendor-added substitutes live as extra order_items, kept when the buyer re-saves the main list.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_alternate BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.order_items.is_alternate IS
  'Vendor-added alternate / extra goods, shown between the main list and shipping extras';

CREATE OR REPLACE FUNCTION public.add_shared_order_alternate(
  p_token TEXT,
  p_name TEXT DEFAULT '',
  p_quantity NUMERIC DEFAULT 1,
  p_unit TEXT DEFAULT 'kg'
)
RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created public.order_items;
BEGIN
  INSERT INTO public.order_items (
    order_id, name, quantity, unit, status, sort_order, is_alternate, order_mode
  )
  SELECT o.id,
         COALESCE(btrim(p_name), ''),
         GREATEST(COALESCE(p_quantity, 1), 0),
         COALESCE(NULLIF(btrim(p_unit), ''), 'kg'),
         'pending',
         COALESCE((SELECT MAX(i.sort_order) FROM public.order_items i WHERE i.order_id = o.id), 0) + 1,
         true,
         'measure'
    FROM public.orders o
   WHERE o.share_token = p_token
     AND o.status IN ('draft', 'shared')
  RETURNING * INTO created;

  IF created.id IS NULL THEN
    RAISE EXCEPTION 'order not found or not editable';
  END IF;

  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_shared_order_alternate(
  p_token TEXT,
  p_item_id UUID,
  p_name TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
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
     SET name = COALESCE(btrim(p_name), i.name),
         quantity = GREATEST(COALESCE(p_quantity, i.quantity), 0),
         unit = COALESCE(NULLIF(btrim(p_unit), ''), i.unit),
         retail_price = p_retail_price,
         fulfilled_qty = p_fulfilled_qty,
         status = p_status,
         vendor_notice = NULLIF(btrim(p_notice), ''),
         updated_at = now()
    FROM public.orders o
   WHERE i.id = p_item_id
     AND i.is_alternate
     AND i.order_id = o.id
     AND o.share_token = p_token
     AND o.status IN ('draft', 'shared')
  RETURNING i.* INTO updated;

  IF updated.id IS NULL THEN
    RAISE EXCEPTION 'order item not found or not editable';
  END IF;

  RETURN updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shared_order_alternate(
  p_token TEXT,
  p_item_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.order_items i
   USING public.orders o
   WHERE i.id = p_item_id
     AND i.is_alternate
     AND i.order_id = o.id
     AND o.share_token = p_token
     AND o.status IN ('draft', 'shared');
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_shared_order_alternate(TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_order_alternate(TEXT, UUID, TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shared_order_alternate(TEXT, UUID) TO anon, authenticated;
