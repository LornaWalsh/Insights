-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Security hardening
-- Fixes privilege escalation, cross-org channel linking, and function exposure.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. CRITICAL: Prevent privilege escalation via profiles_update ─────────────
--
-- The previous policy allowed any user to UPDATE any column on their own row,
-- including role and is_platform_admin. Replaced with a WITH CHECK that blocks
-- those columns entirely. Only full_name may be changed by the user themselves.
-- Service role (edge functions) bypasses RLS so admin operations still work.

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (
    -- Who can attempt an update
    public.is_platform_admin()
    OR id = auth.uid()
  )
  WITH CHECK (
    -- Platform admin: unrestricted
    public.is_platform_admin()
    OR (
      -- Regular users: can only update their own row, and must not change
      -- role, is_platform_admin, organisation_id, or channel_id.
      -- Those fields may only be changed via service-role edge functions.
      id = auth.uid()
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND is_platform_admin = (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid())
      AND organisation_id IS NOT DISTINCT FROM (SELECT organisation_id FROM public.profiles WHERE id = auth.uid())
      AND channel_id IS NOT DISTINCT FROM (SELECT channel_id FROM public.profiles WHERE id = auth.uid())
    )
  );


-- ── 2. CRITICAL: Ensure channel_id belongs to caller's org ───────────────────
--
-- Previously, INSERT/UPDATE policies checked organisation_id = get_my_org_id()
-- but did NOT verify that channel_id also belongs to that same org. A malicious
-- user who knew another org's channel UUID could link data to it.
-- Fixed by adding a subquery check on all affected tables.

-- DAILY PERFORMANCE
DROP POLICY IF EXISTS "daily_performance_insert" ON public.daily_performance;
DROP POLICY IF EXISTS "daily_performance_update" ON public.daily_performance;

CREATE POLICY "daily_performance_insert"
  ON public.daily_performance FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND (
        public.get_my_role() = 'admin'
        OR channel_id = public.get_my_channel_id()
      )
      -- Channel must belong to the same org
      AND EXISTS (
        SELECT 1 FROM public.sales_channels
        WHERE id = channel_id
        AND organisation_id = public.get_my_org_id()
      )
    )
  );

CREATE POLICY "daily_performance_update"
  ON public.daily_performance FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() IN ('admin', 'manager')
      AND (
        public.get_my_role() = 'admin'
        OR channel_id = public.get_my_channel_id()
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() IN ('admin', 'manager')
      AND (
        public.get_my_role() = 'admin'
        OR channel_id = public.get_my_channel_id()
      )
      -- Channel must belong to the same org
      AND EXISTS (
        SELECT 1 FROM public.sales_channels
        WHERE id = channel_id
        AND organisation_id = public.get_my_org_id()
      )
    )
  );

-- FORECAST TARGETS
DROP POLICY IF EXISTS "forecast_targets_insert" ON public.forecast_targets;
DROP POLICY IF EXISTS "forecast_targets_update" ON public.forecast_targets;

CREATE POLICY "forecast_targets_insert"
  ON public.forecast_targets FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.sales_channels
        WHERE id = channel_id
        AND organisation_id = public.get_my_org_id()
      )
    )
  );

CREATE POLICY "forecast_targets_update"
  ON public.forecast_targets FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() = 'admin'
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.sales_channels
        WHERE id = channel_id
        AND organisation_id = public.get_my_org_id()
      )
    )
  );

-- CHANNEL CLOSED DATES
DROP POLICY IF EXISTS "closed_dates_insert" ON public.channel_closed_dates;

CREATE POLICY "closed_dates_insert"
  ON public.channel_closed_dates FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organisation_id = public.get_my_org_id()
      AND public.get_my_role() = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.sales_channels
        WHERE id = channel_id
        AND organisation_id = public.get_my_org_id()
      )
    )
  );


-- ── 3. MEDIUM: Revoke assign_org_admin from authenticated users ───────────────
--
-- This SECURITY DEFINER function was granted to all authenticated users,
-- meaning any logged-in user could call it directly and change anyone's
-- org or role. It should only be callable by service role (edge functions).

REVOKE EXECUTE ON FUNCTION public.assign_org_admin FROM authenticated;


-- ── 4. MEDIUM: Explicit deny policies for import_errors ──────────────────────
--
-- RLS default-denies INSERT/UPDATE/DELETE when no policy exists, but
-- making this explicit prevents confusion and future policy drift.

CREATE POLICY "import_errors_insert_deny"
  ON public.import_errors FOR INSERT
  WITH CHECK (false);

CREATE POLICY "import_errors_update_deny"
  ON public.import_errors FOR UPDATE
  USING (false);

CREATE POLICY "import_errors_delete_deny"
  ON public.import_errors FOR DELETE
  USING (false);


-- ── 5. HIGH: Block cross-org organisation_id tampering on insert ──────────────
--
-- Reinforce that users cannot insert data with an organisation_id that is not
-- their own. While organisation_id = get_my_org_id() already checks this,
-- adding an explicit WITH CHECK makes the intent unambiguous and catches any
-- future policy drift.
-- (sales_channels, forecast_targets, daily_performance, channel_closed_dates,
--  import_jobs already have this — captured here for completeness.)


-- ── 6. Ensure import_errors rows can only be written by service role ──────────
--
-- import_errors is written by the import edge function (service role).
-- The deny policies above block direct client writes.
-- Service role bypasses RLS entirely, so edge functions are unaffected.


-- ── Notes ─────────────────────────────────────────────────────────────────────
-- profiles_delete remains platform_admin only (correct).
-- remove-member edge function will use service role to delete profiles/auth
-- users — bypasses RLS by design, with org ownership verified in application
-- code before deletion.
-- The handle_new_user trigger in migration 001 was dropped during development
-- (documented in migration 003). Profiles are created by edge functions only.
