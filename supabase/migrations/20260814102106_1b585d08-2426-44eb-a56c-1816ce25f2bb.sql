ALTER TABLE public.sub_payments
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_method_note TEXT;

CREATE TABLE IF NOT EXISTS public.expense_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  last_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_method_note TEXT,
  repeat TEXT NOT NULL CHECK (repeat IN ('weekly', 'biweekly', 'monthly')),
  next_due DATE NOT NULL,
  weekday SMALLINT,
  month_day SMALLINT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_schedules TO authenticated;
GRANT ALL ON public.expense_schedules TO service_role;

ALTER TABLE public.expense_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own expense_schedules" ON public.expense_schedules;
CREATE POLICY "Users manage own expense_schedules"
ON public.expense_schedules FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS expense_schedules_user_due_idx
ON public.expense_schedules (user_id, next_due)
WHERE active;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_expense_schedules_updated_at ON public.expense_schedules;
CREATE TRIGGER update_expense_schedules_updated_at
BEFORE UPDATE ON public.expense_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();