-- Add weekly rice category for every existing user (skip if already present)
WITH new_categories(name, frequency) AS (
  VALUES
    ('Gạo', 'weekly')
)
INSERT INTO public.categories (name, frequency, user_id)
SELECT nc.name, nc.frequency, u.id
FROM new_categories nc
CROSS JOIN auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.user_id = u.id
    AND lower(c.name) = lower(nc.name)
);
