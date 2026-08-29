-- Nested details on any expense row, plus a user-scoped salary roster.
-- Nested lines do NOT roll into payments.total_amount (parent amount stays the day total).

-- 1. Generic nest under sub_payments
CREATE TABLE public.sub_payment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_payment_id UUID NOT NULL REFERENCES public.sub_payments(id) ON DELETE CASCADE,
  sort_index INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sub_payment_lines_sub_payment_id_idx
  ON public.sub_payment_lines (sub_payment_id);

CREATE INDEX sub_payment_lines_user_id_idx
  ON public.sub_payment_lines (user_id);

ALTER TABLE public.sub_payment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sub_payment_lines"
  ON public.sub_payment_lines FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Current salary file (what /salary edits)
CREATE TABLE public.salary_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account TEXT,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  deposit NUMERIC CHECK (deposit IS NULL OR deposit >= 0),
  transfer_amount NUMERIC CHECK (transfer_amount IS NULL OR transfer_amount >= 0),
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX salary_employees_user_sort_idx
  ON public.salary_employees (user_id, sort_index);

ALTER TABLE public.salary_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own salary_employees"
  ON public.salary_employees FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One roster-meta row per user (last import period / summary)
CREATE TABLE public.salary_roster_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  period JSONB,
  exported_at TIMESTAMPTZ,
  summary JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_roster_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own salary_roster_meta"
  ON public.salary_roster_meta FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
