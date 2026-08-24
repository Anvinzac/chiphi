-- Ice category was stored as ASCII "Da"; list it as Vietnamese "Đá".
UPDATE public.categories
SET name = 'Đá'
WHERE lower(btrim(name)) = 'da';
