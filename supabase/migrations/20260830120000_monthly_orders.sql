-- One editable monthly-order grid per user, plus PIN-gated public share.

CREATE TABLE IF NOT EXISTS public.monthly_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Đơn tháng',
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  columns SMALLINT NOT NULL DEFAULT 4,
  qty_min INTEGER NOT NULL DEFAULT 16,
  qty_max INTEGER NOT NULL DEFAULT 26,
  range_enabled BOOLEAN NOT NULL DEFAULT true,
  unit_price_thousands TEXT NOT NULL DEFAULT '',
  cells JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token TEXT UNIQUE,
  pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monthly_orders_share_token_idx
  ON public.monthly_orders (share_token)
  WHERE share_token IS NOT NULL;

ALTER TABLE public.monthly_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own monthly_orders" ON public.monthly_orders;
CREATE POLICY "Users manage own monthly_orders"
  ON public.monthly_orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_shared_monthly_order(p_token TEXT, p_pin TEXT)
RETURNS TABLE (
  title TEXT,
  range_start DATE,
  range_end DATE,
  columns SMALLINT,
  cells JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.title, o.range_start, o.range_end, o.columns, o.cells
  FROM public.monthly_orders o
  WHERE o.share_token = p_token
    AND o.pin_hash = encode(digest('mise-order-pin:' || btrim(p_pin), 'sha256'), 'hex')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_monthly_order(TEXT, TEXT) TO anon, authenticated;
