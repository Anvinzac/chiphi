CREATE TABLE public.order_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.order_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  subcategory TEXT,
  reference_price NUMERIC,
  quick_quantities JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_categories TO authenticated;
GRANT ALL ON public.order_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_ingredients TO authenticated;
GRANT ALL ON public.order_ingredients TO service_role;

CREATE INDEX order_categories_user_id_idx ON public.order_categories (user_id);
CREATE UNIQUE INDEX order_categories_user_source_key_uidx
ON public.order_categories (user_id, source_key)
WHERE source_key IS NOT NULL;
CREATE INDEX order_ingredients_user_id_idx ON public.order_ingredients (user_id);
CREATE INDEX order_ingredients_category_id_idx ON public.order_ingredients (category_id);
CREATE UNIQUE INDEX order_ingredients_user_source_key_uidx
ON public.order_ingredients (user_id, source_key)
WHERE source_key IS NOT NULL;

ALTER TABLE public.order_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own order_categories"
ON public.order_categories FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners manage own order_ingredients"
ON public.order_ingredients FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);