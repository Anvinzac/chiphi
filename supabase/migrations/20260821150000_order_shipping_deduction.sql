ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_shipping BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_deduction BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_shared_order(TEXT);

CREATE FUNCTION public.get_shared_order(p_token TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  shipping_fee NUMERIC,
  deduction NUMERIC,
  include_shipping BOOLEAN,
  include_deduction BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.status, o.created_at, o.updated_at,
         o.shipping_fee, o.deduction, o.include_shipping, o.include_deduction
  FROM public.orders o
  WHERE o.share_token = p_token
    AND o.status IN ('draft', 'shared', 'closed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_shared_order_extras(
  p_token TEXT,
  p_shipping_fee NUMERIC,
  p_deduction NUMERIC,
  p_include_shipping BOOLEAN,
  p_include_deduction BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders o
  SET shipping_fee = COALESCE(p_shipping_fee, 0),
      deduction = COALESCE(p_deduction, 0),
      include_shipping = COALESCE(p_include_shipping, false),
      include_deduction = COALESCE(p_include_deduction, false),
      updated_at = now()
  WHERE o.share_token = p_token
    AND o.status IN ('draft', 'shared');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found or not editable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_order(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shared_order_extras(TEXT, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN) TO anon, authenticated;
