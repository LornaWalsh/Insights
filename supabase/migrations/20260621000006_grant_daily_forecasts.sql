-- Grant table permissions for daily_forecasts.
-- Migration 002 ran GRANT ON ALL TABLES but only covered tables existing at that time.
-- Any table created in a later migration needs an explicit grant.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_forecasts TO authenticated;
