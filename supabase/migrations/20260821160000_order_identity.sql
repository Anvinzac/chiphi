ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS day_seq INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mgmt_id TEXT;

CREATE OR REPLACE FUNCTION public.assign_order_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d date;
  n integer;
BEGIN
  d := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  SELECT COALESCE(MAX(o.day_seq), 0) + 1
    INTO n
    FROM public.orders o
   WHERE o.user_id = NEW.user_id
     AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d
     AND o.id IS DISTINCT FROM NEW.id;
  NEW.day_seq := n;
  NEW.mgmt_id := to_char(d, 'YYMMDD') || '-' || lpad(n::text, 2, '0');
  IF NEW.customer_name IS NULL OR btrim(NEW.customer_name) = '' THEN
    NEW.customer_name := 'Khách';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_assign_identity ON public.orders;
CREATE TRIGGER orders_assign_identity
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_identity();

UPDATE public.orders o
SET day_seq = sub.seq,
    mgmt_id = to_char((o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYMMDD')
               || '-' || lpad(sub.seq::text, 2, '0'),
    customer_name = COALESCE(NULLIF(btrim(o.customer_name), ''), 'Khách')
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
           ORDER BY created_at, id
         ) AS seq
  FROM public.orders
) sub
WHERE o.id = sub.id;

CREATE UNIQUE INDEX IF NOT EXISTS orders_user_mgmt_id_idx
  ON public.orders (user_id, mgmt_id);

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
  include_deduction BOOLEAN,
  customer_name TEXT,
  day_seq INTEGER,
  mgmt_id TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.status, o.created_at, o.updated_at,
         o.shipping_fee, o.deduction, o.include_shipping, o.include_deduction,
         o.customer_name, o.day_seq, o.mgmt_id
  FROM public.orders o
  WHERE o.share_token = p_token
    AND o.status IN ('draft', 'shared', 'closed')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_order(TEXT) TO anon, authenticated;
