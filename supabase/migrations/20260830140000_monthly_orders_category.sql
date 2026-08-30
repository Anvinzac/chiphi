-- One monthly-order grid per user + ingredient category (rau, đậu hũ, …).

ALTER TABLE public.monthly_orders
  ADD COLUMN IF NOT EXISTS category_key TEXT NOT NULL DEFAULT 'rau';

ALTER TABLE public.monthly_orders
  DROP CONSTRAINT IF EXISTS monthly_orders_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS monthly_orders_user_category_uidx
  ON public.monthly_orders (user_id, category_key);
