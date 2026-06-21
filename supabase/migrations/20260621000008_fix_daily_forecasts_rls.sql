-- Fix daily_forecasts RLS: add platform admin bypass to all policies
-- Consistent with all other tables which include is_platform_admin() OR ...

DROP POLICY IF EXISTS "daily_forecasts_select" ON public.daily_forecasts;
DROP POLICY IF EXISTS "daily_forecasts_insert" ON public.daily_forecasts;
DROP POLICY IF EXISTS "daily_forecasts_update" ON public.daily_forecasts;
DROP POLICY IF EXISTS "daily_forecasts_delete" ON public.daily_forecasts;

CREATE POLICY "daily_forecasts_select"
  ON public.daily_forecasts FOR SELECT
  USING (is_platform_admin() OR organisation_id = get_my_org_id());

CREATE POLICY "daily_forecasts_insert"
  ON public.daily_forecasts FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR (organisation_id = get_my_org_id() AND get_my_role() = 'admin')
  );

CREATE POLICY "daily_forecasts_update"
  ON public.daily_forecasts FOR UPDATE
  USING (
    is_platform_admin()
    OR (organisation_id = get_my_org_id() AND get_my_role() = 'admin')
  );

CREATE POLICY "daily_forecasts_delete"
  ON public.daily_forecasts FOR DELETE
  USING (
    is_platform_admin()
    OR (organisation_id = get_my_org_id() AND get_my_role() = 'admin')
  );
