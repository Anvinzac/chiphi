-- Allow an order line to be either a measured qty (kg, gói, …) or an exact VND amount.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS order_mode TEXT NOT NULL DEFAULT 'measure',
  ADD COLUMN IF NOT EXISTS money_amount NUMERIC;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_order_mode_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_order_mode_check
  CHECK (order_mode IN ('measure', 'money'));

COMMENT ON COLUMN public.order_items.order_mode IS
  'measure = quantity + unit; money = buy an exact VND amount (money_amount)';
COMMENT ON COLUMN public.order_items.money_amount IS
  'VND when order_mode = money; unused for measure lines';