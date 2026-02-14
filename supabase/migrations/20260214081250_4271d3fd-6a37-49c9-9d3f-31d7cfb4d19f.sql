
-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sub-categories (2 levels via parent reference)
CREATE TABLE public.sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  parent_sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sub_categories" ON public.sub_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suppliers" ON public.suppliers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Items (ingredient/product catalog)
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  sub_sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  default_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  default_unit_price NUMERIC,
  unit TEXT DEFAULT 'unit',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own items" ON public.items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payments (receipts)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  receipt_photo_path TEXT,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payments" ON public.payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sub-payments (individual items within a receipt)
CREATE TABLE public.sub_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  sub_sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sub_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sub_payments" ON public.sub_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Receipt photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('receipt-photos', 'receipt-photos', false);

CREATE POLICY "Users can upload receipt photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipt-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own receipt photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipt-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own receipt photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipt-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update payment total when sub_payments change
CREATE OR REPLACE FUNCTION public.update_payment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.payments SET total_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM public.sub_payments WHERE payment_id = OLD.payment_id
    ) WHERE id = OLD.payment_id;
    RETURN OLD;
  ELSE
    UPDATE public.payments SET total_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM public.sub_payments WHERE payment_id = NEW.payment_id
    ) WHERE id = NEW.payment_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER update_payment_total_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sub_payments
FOR EACH ROW EXECUTE FUNCTION public.update_payment_total();
