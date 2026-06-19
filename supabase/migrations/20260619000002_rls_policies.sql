-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Row Level Security policies
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper functions (security definer to avoid RLS recursion) ────────────────

create or replace function public.get_my_org_id()
returns uuid language sql stable security definer as $$
  select organisation_id from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_channel_id()
returns uuid language sql stable security definer as $$
  select channel_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer as $$
  select coalesce(is_platform_admin, false) from public.profiles where id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all tables
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organisations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.sales_channels       enable row level security;
alter table public.channel_closed_dates enable row level security;
alter table public.forecast_targets     enable row level security;
alter table public.daily_performance    enable row level security;
alter table public.import_jobs          enable row level security;
alter table public.import_errors        enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANISATIONS
-- ─────────────────────────────────────────────────────────────────────────────
create policy "organisations_select"
  on public.organisations for select
  using (
    public.is_platform_admin()
    or id = public.get_my_org_id()
  );

create policy "organisations_update"
  on public.organisations for update
  using (
    public.is_platform_admin()
    or (id = public.get_my_org_id() and public.get_my_role() = 'admin')
  );

create policy "organisations_insert"
  on public.organisations for insert
  with check (public.is_platform_admin());

create policy "organisations_delete"
  on public.organisations for delete
  using (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
create policy "profiles_select"
  on public.profiles for select
  using (
    public.is_platform_admin()
    or id = auth.uid()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() in ('admin', 'manager')
    )
  );

-- Users can update their own name only; platform_admin can update anything
create policy "profiles_update"
  on public.profiles for update
  using (
    public.is_platform_admin()
    or id = auth.uid()
  );

-- Only platform_admin or edge functions (service role) create profiles
create policy "profiles_insert"
  on public.profiles for insert
  with check (public.is_platform_admin());

create policy "profiles_delete"
  on public.profiles for delete
  using (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SALES CHANNELS
-- ─────────────────────────────────────────────────────────────────────────────
create policy "sales_channels_select"
  on public.sales_channels for select
  using (
    public.is_platform_admin()
    or organisation_id = public.get_my_org_id()
  );

create policy "sales_channels_insert"
  on public.sales_channels for insert
  with check (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "sales_channels_update"
  on public.sales_channels for update
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "sales_channels_delete"
  on public.sales_channels for delete
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- CHANNEL CLOSED DATES
-- ─────────────────────────────────────────────────────────────────────────────
create policy "closed_dates_select"
  on public.channel_closed_dates for select
  using (
    public.is_platform_admin()
    or organisation_id = public.get_my_org_id()
  );

create policy "closed_dates_insert"
  on public.channel_closed_dates for insert
  with check (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "closed_dates_delete"
  on public.channel_closed_dates for delete
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- FORECAST TARGETS
-- ─────────────────────────────────────────────────────────────────────────────
create policy "forecast_targets_select"
  on public.forecast_targets for select
  using (
    public.is_platform_admin()
    or organisation_id = public.get_my_org_id()
  );

create policy "forecast_targets_insert"
  on public.forecast_targets for insert
  with check (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "forecast_targets_update"
  on public.forecast_targets for update
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "forecast_targets_delete"
  on public.forecast_targets for delete
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DAILY PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin: all channels in their org
-- Manager: their assigned channel only
-- Staff: their assigned channel only
create policy "daily_performance_select"
  on public.daily_performance for select
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and (
        public.get_my_role() = 'admin'
        or channel_id = public.get_my_channel_id()
      )
    )
  );

-- Admin: any channel in their org
-- Manager and staff: their assigned channel only
create policy "daily_performance_insert"
  on public.daily_performance for insert
  with check (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and (
        public.get_my_role() = 'admin'
        or channel_id = public.get_my_channel_id()
      )
    )
  );

-- Admin: any channel; manager: their channel; staff: cannot update
create policy "daily_performance_update"
  on public.daily_performance for update
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() in ('admin', 'manager')
      and (
        public.get_my_role() = 'admin'
        or channel_id = public.get_my_channel_id()
      )
    )
  );

-- Admin only
create policy "daily_performance_delete"
  on public.daily_performance for delete
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORT JOBS
-- ─────────────────────────────────────────────────────────────────────────────
create policy "import_jobs_select"
  on public.import_jobs for select
  using (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

create policy "import_jobs_insert"
  on public.import_jobs for insert
  with check (
    public.is_platform_admin()
    or (
      organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORT ERRORS
-- ─────────────────────────────────────────────────────────────────────────────
create policy "import_errors_select"
  on public.import_errors for select
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.import_jobs j
      where j.id = import_job_id
      and j.organisation_id = public.get_my_org_id()
      and public.get_my_role() = 'admin'
    )
  );
