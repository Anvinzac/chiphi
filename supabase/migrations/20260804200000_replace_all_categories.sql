-- Remove all existing categories for all users
DELETE FROM public.categories;

-- Insert the 18 Vietnamese categories for every existing user
-- Order: daily items first, then weekly, then monthly
WITH quick_categories(name, frequency) AS (
  VALUES
    ('Điện',           'daily'),
    ('Thuê nhà',       'daily'),
    ('Gas',            'daily'),
    ('Đi chợ',         'daily'),
    ('Bánh mì',        'daily'),
    ('Nguyên vật liệu', 'daily'),
    ('Nước dừa',       'weekly'),
    ('Muối',           'weekly'),
    ('Shopee',         'weekly'),
    ('Internet',       'weekly'),
    ('Sửa chữa',       'weekly'),
    ('Vệ sinh',        'weekly'),
    ('Lương NV',       'monthly'),
    ('Thuế',           'monthly'),
    ('BHXH',           'monthly'),
    ('Rác',            'monthly'),
    ('Giữ xe',         'monthly'),
    ('Khác',           'monthly')
)
INSERT INTO public.categories (name, frequency, user_id)
SELECT qc.name, qc.frequency, u.id
FROM quick_categories qc
CROSS JOIN auth.users u;
