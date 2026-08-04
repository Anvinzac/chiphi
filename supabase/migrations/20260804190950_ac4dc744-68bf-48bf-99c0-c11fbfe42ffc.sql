ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'daily'
CHECK (frequency IN ('daily', 'weekly', 'monthly'));