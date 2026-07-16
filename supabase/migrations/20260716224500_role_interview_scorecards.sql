create table public.role_interview_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null unique references public.roles(id) on delete cascade,
  generated_by_profile_id uuid references public.profiles(id) on delete set null,
  template_source text not null check (template_source in ('generated', 'locked_template')),
  competency_signature text not null,
  scorecard_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index role_interview_scorecards_role_idx
on public.role_interview_scorecards (role_id, generated_at desc);

create trigger set_updated_at_role_interview_scorecards
before update on public.role_interview_scorecards
for each row execute function public.set_updated_at();

alter table public.role_interview_scorecards enable row level security;

create policy "organization members can manage role interview scorecards"
on public.role_interview_scorecards
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
