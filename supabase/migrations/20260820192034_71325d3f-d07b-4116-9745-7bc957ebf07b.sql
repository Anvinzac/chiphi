ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS vendor_notice TEXT;

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
      vendor_notice = NULLIF(btrim(p_notice), ''),
      updated_at = now()
  FROM public.orders o
  WHERE i.id = p_item_id
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

GRANT EXECUTE ON FUNCTION public.update_shared_order_item(TEXT, UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO anon, authenticated;