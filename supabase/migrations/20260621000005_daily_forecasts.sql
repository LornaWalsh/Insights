-- ─────────────────────────────────────────────────────────────────────────────
-- DAILY FORECASTS
-- Stores the generated daily revenue forecast per channel per day.
-- Written by the Generate tab; read by dashboard for actual vs forecast.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.daily_forecasts (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  channel_id       uuid not null references public.sales_channels(id) on delete cascade,
  forecast_date    date not null,
  forecast_revenue numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  unique (organisation_id, channel_id, forecast_date)
);

create index daily_forecasts_org_idx on public.daily_forecasts(organisation_id, channel_id, forecast_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.daily_forecasts enable row level security;

-- All org members can read their own forecasts (dashboard will use this later)
create policy "daily_forecasts_select"
  on public.daily_forecasts for select
  using (
    public.is_platform_admin()
    or organisation_id = public.get_my_org_id()
  );

-- Only admins can write forecasts
create policy "daily_forecasts_insert"
  on public.daily_forecasts for insert
  with check (
    organisation_id = public.get_my_org_id()
    and public.get_my_role() = 'admin'
  );

create policy "daily_forecasts_update"
  on public.daily_forecasts for update
  using (
    organisation_id = public.get_my_org_id()
    and public.get_my_role() = 'admin'
  );

create policy "daily_forecasts_delete"
  on public.daily_forecasts for delete
  using (
    organisation_id = public.get_my_org_id()
    and public.get_my_role() = 'admin'
  );
