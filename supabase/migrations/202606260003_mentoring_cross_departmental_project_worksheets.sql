create table public.mentoring_cross_departmental_project_worksheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft',
  worksheet_date date,
  department_conversations jsonb not null default '[]'::jsonb,
  cross_department_challenge text,
  project_title text,
  project_objective text,
  project_partners text,
  project_timeline text,
  project_learning_goal text,
  shared_themes text,
  alignment_risks text,
  biggest_surprise text,
  leadership_shift text,
  critical_behaviors text,
  hospital_insights text,
  action_commitments jsonb not null default '[]'::jsonb,
  mentor_observed_qualities jsonb not null default '[]'::jsonb,
  mentor_comments text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, mentor_profile_id)
);

create index mentoring_cross_departmental_project_worksheets_candidate_idx
on public.mentoring_cross_departmental_project_worksheets (
  organization_id,
  candidate_id,
  role_id,
  mentor_profile_id
);

create trigger set_updated_at_mentoring_cross_departmental_project_worksheets
before update on public.mentoring_cross_departmental_project_worksheets
for each row execute function public.set_updated_at();

alter table public.mentoring_cross_departmental_project_worksheets enable row level security;

create policy "organization members can manage cross departmental project worksheets"
on public.mentoring_cross_departmental_project_worksheets
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
