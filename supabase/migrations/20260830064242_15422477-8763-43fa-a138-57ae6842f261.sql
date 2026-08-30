-- Shared monthly view needs the same unit price the admin set.

DROP FUNCTION IF EXISTS public.get_shared_monthly_order(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_shared_monthly_order(p_token TEXT, p_pin TEXT)
RETURNS TABLE (
  title TEXT,
  range_start DATE,
  range_end DATE,
  columns SMALLINT,
  cells JSONB,
  unit_price_thousands TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT o.title, o.range_start, o.range_end, o.columns, o.cells, o.unit_price_thousands
  FROM public.monthly_orders o
  WHERE o.share_token = p_token
    AND o.pin_hash = encode(digest(('mise-order-pin:' || btrim(p_pin))::bytea, 'sha256'), 'hex')
  LIMIT 1;
$$;