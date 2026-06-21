-- Export audit log — records every CSV download.
create table public.export_logs (
  id            uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  report_type   text not null,
  date_from     date not null,
  date_to       date not null,
  channel_count integer not null default 0,
  exported_at   timestamptz not null default now()
);

create index export_logs_org_idx on public.export_logs(organisation_id, exported_at desc);

alter table public.export_logs enable row level security;

create policy "export_logs_select"
  on public.export_logs for select
  using (organisation_id = public.get_my_org_id() or public.is_platform_admin());

create policy "export_logs_insert"
  on public.export_logs for insert
  with check (
    organisation_id = public.get_my_org_id()
    and public.get_my_role() in ('admin', 'manager')
  );

-- No update or delete — audit logs are immutable.

GRANT SELECT, INSERT ON public.export_logs TO authenticated;
