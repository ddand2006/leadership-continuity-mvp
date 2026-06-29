create table public.openai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  feature_name text not null,
  report_id uuid references public.mentor_reports(id) on delete set null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost numeric(12,6) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create index openai_usage_logs_feature_name_idx
on public.openai_usage_logs (feature_name);

create index openai_usage_logs_created_at_idx
on public.openai_usage_logs (created_at desc);

create index openai_usage_logs_report_id_idx
on public.openai_usage_logs (report_id);

alter table public.openai_usage_logs enable row level security;

create policy "organization members can view usage logs for mentor reports"
on public.openai_usage_logs
for select
using (
  exists (
    select 1
    from public.mentor_reports
    where mentor_reports.id = openai_usage_logs.report_id
      and mentor_reports.organization_id = public.current_profile_organization_id()
  )
);

create policy "organization members can manage usage logs for mentor reports"
on public.openai_usage_logs
for all
using (
  exists (
    select 1
    from public.mentor_reports
    where mentor_reports.id = openai_usage_logs.report_id
      and mentor_reports.organization_id = public.current_profile_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.mentor_reports
    where mentor_reports.id = openai_usage_logs.report_id
      and mentor_reports.organization_id = public.current_profile_organization_id()
  )
);
