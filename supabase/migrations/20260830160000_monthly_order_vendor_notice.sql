-- Vendor note on the shared monthly grid (typed on /m/:token).

ALTER TABLE public.monthly_orders
  ADD COLUMN IF NOT EXISTS vendor_notice TEXT NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.get_shared_monthly_order(TEXT, TEXT);

CREATE FUNCTION public.get_shared_monthly_order(p_token TEXT, p_pin TEXT)
RETURNS TABLE (
  title TEXT,
  range_start DATE,
  range_end DATE,
  columns SMALLINT,
  cells JSONB,
  unit_price_thousands TEXT,
  vendor_notice TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.title, o.range_start, o.range_end, o.columns, o.cells, o.unit_price_thousands, o.vendor_notice
  FROM public.monthly_orders o
  WHERE o.share_token = p_token
    AND o.pin_hash = encode(digest('mise-order-pin:' || btrim(p_pin), 'sha256'), 'hex')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_monthly_order(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_shared_monthly_notice(p_token TEXT, p_pin TEXT, p_notice TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_notice TEXT;
BEGIN
  UPDATE public.monthly_orders
  SET vendor_notice = COALESCE(btrim(p_notice), ''),
      updated_at = now()
  WHERE share_token = p_token
    AND pin_hash = encode(digest('mise-order-pin:' || btrim(p_pin), 'sha256'), 'hex')
  RETURNING vendor_notice INTO next_notice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'monthly order not found or pin mismatch';
  END IF;

  RETURN COALESCE(next_notice, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_shared_monthly_notice(TEXT, TEXT, TEXT) TO anon, authenticated;
