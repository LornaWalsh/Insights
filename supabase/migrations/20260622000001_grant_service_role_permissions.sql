-- Grant full permissions to service_role on all app tables
-- Required for edge functions using the service role key to bypass RLS

GRANT ALL ON public.organisations       TO service_role;
GRANT ALL ON public.profiles            TO service_role;
GRANT ALL ON public.sales_channels      TO service_role;
GRANT ALL ON public.daily_performance   TO service_role;
GRANT ALL ON public.daily_forecasts     TO service_role;
GRANT ALL ON public.forecast_targets    TO service_role;
