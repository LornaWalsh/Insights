ALTER TABLE public.daily_performance
  ADD COLUMN IF NOT EXISTS discounted_value numeric NULL;
