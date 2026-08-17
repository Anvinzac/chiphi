-- Strip English sandbox seed categories from real/admin accounts.
-- Demo and sandbox keep their sample catalog.
CREATE TEMP TABLE seed_cats ON COMMIT DROP AS
SELECT c.id
FROM public.categories c
JOIN auth.users u ON u.id = c.user_id
WHERE u.email IS DISTINCT FROM 'demo@mise.local'
  AND u.email IS DISTINCT FROM 'sandbox@mise.local'
  AND (
    lower(btrim(c.name, ' :：')) IN (
      'food & ingredients',
      'food & ingredient',
      'kitchen supplies',
      'operations',
      'beverages'
    )
    OR lower(c.name) LIKE 'food & ingredient%'
  );

UPDATE public.sub_payments
SET category_id = NULL, sub_category_id = NULL, sub_sub_category_id = NULL, item_id = NULL
WHERE category_id IN (SELECT id FROM seed_cats);

UPDATE public.expense_schedules
SET category_id = NULL, sub_category_id = NULL, item_id = NULL
WHERE category_id IN (SELECT id FROM seed_cats);

UPDATE public.expense_spans
SET category_id = NULL, sub_category_id = NULL, sub_sub_category_id = NULL, item_id = NULL
WHERE category_id IN (SELECT id FROM seed_cats);

DELETE FROM public.items
WHERE category_id IN (SELECT id FROM seed_cats);

UPDATE public.sub_categories
SET parent_sub_category_id = NULL
WHERE category_id IN (SELECT id FROM seed_cats);

DELETE FROM public.sub_categories
WHERE category_id IN (SELECT id FROM seed_cats);

DELETE FROM public.categories
WHERE id IN (SELECT id FROM seed_cats);
