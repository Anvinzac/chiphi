ALTER TABLE public.order_ingredients
ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS order_ingredients_category_order_count_idx
ON public.order_ingredients (category_id, order_count DESC);

CREATE OR REPLACE FUNCTION public.touch_order_ingredient_frequency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_name text;
  v_delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    SELECT o.user_id INTO v_user_id FROM public.orders o WHERE o.id = NEW.order_id;
    v_name := lower(trim(NEW.name));
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -1;
    SELECT o.user_id INTO v_user_id FROM public.orders o WHERE o.id = OLD.order_id;
    v_name := lower(trim(OLD.name));
  ELSE
    RETURN NULL;
  END IF;

  IF v_user_id IS NULL OR v_name IS NULL OR v_name = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.order_ingredients oi
  SET order_count = GREATEST(0, oi.order_count + v_delta),
      updated_at = now()
  WHERE oi.user_id = v_user_id
    AND lower(trim(oi.name)) = v_name;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS order_items_bump_ingredient_frequency_ins ON public.order_items;
CREATE TRIGGER order_items_bump_ingredient_frequency_ins
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.touch_order_ingredient_frequency();

DROP TRIGGER IF EXISTS order_items_bump_ingredient_frequency_del ON public.order_items;
CREATE TRIGGER order_items_bump_ingredient_frequency_del
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.touch_order_ingredient_frequency();

UPDATE public.order_ingredients oi
SET order_count = sub.cnt,
    updated_at = now()
FROM (
  SELECT o.user_id, lower(trim(i.name)) AS name_key, count(*)::integer AS cnt
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  GROUP BY o.user_id, lower(trim(i.name))
) sub
WHERE oi.user_id = sub.user_id
  AND lower(trim(oi.name)) = sub.name_key;