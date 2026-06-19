-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Initial schema
-- Tables: organisations, sales_channels, channel_closed_dates, profiles,
--         forecast_targets, daily_performance, import_jobs, import_errors
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: auto-update updated_at ───────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Channel type enum ─────────────────────────────────────────────────────────
create type public.channel_type as enum (
  'online_store',
  'physical_shop',
  'market_popup',
  'wholesale',
  'marketplace'
);

-- ── User role enum ────────────────────────────────────────────────────────────
create type public.user_role as enum (
  'platform_admin',
  'admin',
  'manager',
  'staff'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANISATIONS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.organisations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  currency              text not null default 'GBP',
  -- Lorna's admin-only fields (not shown to firm users)
  description           text,
  channel_count         integer,
  channel_description   text,
  phone                 text,
  billing_contact_name  text,
  billing_contact_email text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger organisations_updated_at
  before update on public.organisations
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- SALES CHANNELS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.sales_channels (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  channel_type     public.channel_type not null,
  -- trading_days: array of integers 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  trading_days     integer[] not null default '{0,1,2,3,4,5,6}',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index sales_channels_org_idx on public.sales_channels(organisation_id);

create trigger sales_channels_updated_at
  before update on public.sales_channels
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- CHANNEL CLOSED DATES
-- ─────────────────────────────────────────────────────────────────────────────
create table public.channel_closed_dates (
  id               uuid primary key default gen_random_uuid(),
  channel_id       uuid not null references public.sales_channels(id) on delete cascade,
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  closed_date      date not null,
  created_at       timestamptz not null default now(),
  unique (channel_id, closed_date)
);

create index channel_closed_dates_channel_idx on public.channel_closed_dates(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  organisation_id   uuid references public.organisations(id) on delete cascade,
  role              public.user_role not null,
  full_name         text not null,
  -- channel_id: only set for manager and staff roles
  channel_id        uuid references public.sales_channels(id) on delete set null,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_org_idx on public.profiles(organisation_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create a basic profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'staff',
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- FORECAST TARGETS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.forecast_targets (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  channel_id       uuid not null references public.sales_channels(id) on delete cascade,
  year             integer not null,
  month            integer not null check (month between 1 and 12),
  target_revenue   numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, channel_id, year, month)
);

create index forecast_targets_org_idx on public.forecast_targets(organisation_id, channel_id, year, month);

create trigger forecast_targets_updated_at
  before update on public.forecast_targets
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- DAILY PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────
create table public.daily_performance (
  id                        uuid primary key default gen_random_uuid(),
  organisation_id           uuid not null references public.organisations(id) on delete cascade,
  channel_id                uuid not null references public.sales_channels(id) on delete cascade,
  performance_date          date not null,
  -- Required fields
  sales                     numeric(12,2) not null,
  orders                    integer not null,
  -- Auto-calculated, stored for query performance
  aov                       numeric(12,2),
  -- Optional fields
  returns_value             numeric(12,2),
  returns_count             integer,
  footfall                  integer,
  conversion_rate           numeric(6,4),
  conversion_rate_overridden boolean not null default false,
  returning_customers_pct   numeric(5,2),
  signups                   integer,
  discounted_orders         integer,
  facebook_ad_spend         numeric(12,2),
  google_ad_spend           numeric(12,2),
  other_ad_spend            numeric(12,2),
  other_ad_spend_notes      text,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (organisation_id, channel_id, performance_date)
);

create index daily_performance_org_date_idx on public.daily_performance(organisation_id, performance_date);
create index daily_performance_channel_date_idx on public.daily_performance(channel_id, performance_date);

create trigger daily_performance_updated_at
  before update on public.daily_performance
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORT JOBS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.import_jobs (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  filename         text not null,
  total_rows       integer not null default 0,
  success_rows     integer not null default 0,
  error_rows       integer not null default 0,
  status           text not null default 'pending' check (status in ('pending','processing','complete','failed')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index import_jobs_org_idx on public.import_jobs(organisation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORT ERRORS
-- ─────────────────────────────────────────────────────────────────────────────
create table public.import_errors (
  id             uuid primary key default gen_random_uuid(),
  import_job_id  uuid not null references public.import_jobs(id) on delete cascade,
  row_number     integer,
  row_data       jsonb,
  error_message  text,
  created_at     timestamptz not null default now()
);

create index import_errors_job_idx on public.import_errors(import_job_id);
