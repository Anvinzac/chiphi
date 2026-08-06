-- Move Shopee, Sửa chữa, Vệ sinh, Khác onto the daily chip page
UPDATE public.categories
SET frequency = 'daily'
WHERE lower(name) IN ('shopee', 'sửa chữa', 'vệ sinh', 'khác');
