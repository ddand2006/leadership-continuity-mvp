create table public.mentoring_departmental_project_worksheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft',
  project_timeline text,
  department_need text,
  project_title text,
  project_objective text,
  project_importance text,
  responsible_outcomes text,
  collaborators text,
  leadership_actions_required jsonb not null default '[]'::jsonb,
  leadership_actions_other text,
  competencies_developed text,
  mentor_anticipated_difficulty text,
  mentor_stretch_competencies text,
  mentee_anticipated_difficulty text,
  challenge_process_with_mentor text,
  coaching_areas text,
  figuring_things_out_process text,
  help_threshold text,
  success_measures text,
  post_project_leader_wins text,
  post_project_do_differently text,
  post_project_feedback_received text,
  mentor_evaluation_competencies_developed text,
  strengths_observed text,
  future_development_areas text,
  readiness_signal text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, mentor_profile_id)
);

create index mentoring_departmental_project_worksheets_candidate_idx
on public.mentoring_departmental_project_worksheets (
  organization_id,
  candidate_id,
  role_id,
  mentor_profile_id
);

create trigger set_updated_at_mentoring_departmental_project_worksheets
before update on public.mentoring_departmental_project_worksheets
for each row execute function public.set_updated_at();

alter table public.mentoring_departmental_project_worksheets enable row level security;

create policy "organization members can manage departmental project worksheets"
on public.mentoring_departmental_project_worksheets
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

