CREATE TABLE public.expense_spans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  sub_sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  period_count INTEGER NOT NULL CHECK (period_count >= 2 AND period_count <= 120),
  posted_count INTEGER NOT NULL DEFAULT 0 CHECK (posted_count >= 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  start_date DATE NOT NULL,
  next_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expense_span_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  span_id UUID NOT NULL REFERENCES public.expense_spans(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL CHECK (installment_index >= 1),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  sub_payment_id UUID REFERENCES public.sub_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (span_id, installment_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_spans TO authenticated;
GRANT ALL ON public.expense_spans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_span_installments TO authenticated;
GRANT ALL ON public.expense_span_installments TO service_role;

CREATE INDEX expense_spans_user_active_idx
  ON public.expense_spans (user_id, status, next_due_date);

CREATE INDEX expense_span_installments_span_id_idx
  ON public.expense_span_installments (span_id);

ALTER TABLE public.expense_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_span_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own expense_spans"
  ON public.expense_spans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners manage own expense_span_installments"
  ON public.expense_span_installments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_spans s
      WHERE s.id = expense_span_installments.span_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_spans s
      WHERE s.id = expense_span_installments.span_id AND s.user_id = auth.uid()
    )
  );

CREATE TRIGGER expense_spans_set_updated_at
  BEFORE UPDATE ON public.expense_spans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();