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

GRANT EXECUTE ON FUNCTION public.update_shared_order_extras(TEXT, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN) TO anon, authenticated;