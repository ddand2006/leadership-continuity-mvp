create table public.mentoring_preparation_worksheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  worksheet_type text not null default 'mentor_mentee_preparation',
  status text not null default 'draft',
  worksheet_date date,
  critical_competencies jsonb not null default '[]'::jsonb,
  mentee_least_prepared text,
  mentee_strongest_area text,
  strengths_help text,
  strengths_distraction_plan text,
  shared_development_focus text,
  desired_improvement text,
  mentor_support_needed text,
  communication_expectations text,
  initial_development_focus jsonb not null default '[]'::jsonb,
  mentor_guidance_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, mentor_profile_id, worksheet_type)
);

create index mentoring_preparation_worksheets_candidate_idx
on public.mentoring_preparation_worksheets (
  organization_id,
  candidate_id,
  role_id,
  mentor_profile_id
);

create index mentoring_preparation_worksheets_mentor_idx
on public.mentoring_preparation_worksheets (
  organization_id,
  mentor_profile_id,
  candidate_id
);

create trigger set_updated_at_mentoring_preparation_worksheets
before update on public.mentoring_preparation_worksheets
for each row execute function public.set_updated_at();

alter table public.mentoring_preparation_worksheets enable row level security;

create policy "organization members can manage mentoring preparation worksheets"
on public.mentoring_preparation_worksheets
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

