-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Post-launch fixes and additions
-- All changes applied directly in Supabase SQL Editor during development.
-- Captured here for rebuild/re-deploy consistency.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table grants (authenticated role needs base access on top of RLS) ──────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── 2. Helper functions with SET row_security = off (prevents RLS recursion) ──
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off
AS $$ SELECT organisation_id FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.get_my_channel_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off
AS $$ SELECT channel_id FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off
AS $$ SELECT COALESCE(is_platform_admin, false) FROM public.profiles WHERE id = auth.uid(); $$;

-- ── 3. Split profiles_select into separate policies (avoids helper fn recursion)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_org" ON public.profiles
  FOR SELECT USING (
    organisation_id = public.get_my_org_id()
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "profiles_select_platform" ON public.profiles
  FOR SELECT USING (public.is_platform_admin());

-- ── 4. Add invite status and email tracking columns to profiles ───────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- ── 5. Security definer function for setting org admin role after invite ───────
-- Called from invite-user edge function to bypass RLS on profile update.
CREATE OR REPLACE FUNCTION public.assign_org_admin(
  p_user_id uuid,
  p_org_id uuid,
  p_full_name text,
  p_email text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  UPDATE public.profiles SET
    role = 'admin',
    organisation_id = p_org_id,
    full_name = p_full_name,
    email = p_email,
    invited_at = now()
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.assign_org_admin TO authenticated;
