create extension if not exists pgcrypto;

create type public.app_role as enum (
  'system_admin',
  'hospital_admin',
  'interviewer',
  'mentor',
  'candidate'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, email)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department text,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.role_competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  name text not null,
  definition text not null,
  weight numeric(5,2) not null check (weight >= 0),
  target_score numeric(3,2) not null check (target_score >= 1 and target_score <= 5),
  behavioral_indicators jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  competency_id uuid not null references public.role_competencies(id) on delete cascade,
  question text not null,
  scoring_rubric jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  current_title text,
  target_role_id uuid references public.roles(id) on delete set null,
  mentor_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.candidate_strengths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  theme_name text not null,
  rank integer not null check (rank >= 1 and rank <= 34),
  domain text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, theme_name),
  unique (candidate_id, rank)
);

create table public.interview_panels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  panel_name text not null,
  date_completed date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  panel_id uuid not null references public.interview_panels(id) on delete cascade,
  interviewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid not null references public.role_competencies(id) on delete cascade,
  score_numeric numeric(3,2) not null check (score_numeric >= 1 and score_numeric <= 5),
  evidence_notes text,
  concern_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (panel_id, interviewer_profile_id, competency_id)
);

create table public.strengths_library (
  id uuid primary key default gen_random_uuid(),
  theme_name text not null unique,
  domain text not null,
  leadership_advantages text not null,
  possible_blind_spots text not null,
  development_uses text not null,
  coaching_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.development_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  difficulty text not null,
  duration_days integer not null check (duration_days > 0),
  applicable_roles jsonb not null default '[]'::jsonb,
  competencies_developed jsonb not null default '[]'::jsonb,
  strengths_leveraged jsonb not null default '[]'::jsonb,
  expected_outcomes jsonb not null default '[]'::jsonb,
  mentor_questions jsonb not null default '[]'::jsonb,
  evidence_of_success jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.mentor_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  version integer not null default 1,
  report_json jsonb not null default '{}'::jsonb,
  narrative_text text,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, version)
);

create table public.candidate_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mentor_profile_id uuid references public.profiles(id) on delete set null,
  development_project_id uuid not null references public.development_projects(id) on delete cascade,
  status text not null default 'assigned',
  start_date date,
  due_date date,
  mentor_notes text,
  evidence_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create trigger set_updated_at_organizations
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_roles
before update on public.roles
for each row execute function public.set_updated_at();

create trigger set_updated_at_role_competencies
before update on public.role_competencies
for each row execute function public.set_updated_at();

create trigger set_updated_at_interview_questions
before update on public.interview_questions
for each row execute function public.set_updated_at();

create trigger set_updated_at_candidates
before update on public.candidates
for each row execute function public.set_updated_at();

create trigger set_updated_at_candidate_strengths
before update on public.candidate_strengths
for each row execute function public.set_updated_at();

create trigger set_updated_at_interview_panels
before update on public.interview_panels
for each row execute function public.set_updated_at();

create trigger set_updated_at_interview_scores
before update on public.interview_scores
for each row execute function public.set_updated_at();

create trigger set_updated_at_strengths_library
before update on public.strengths_library
for each row execute function public.set_updated_at();

create trigger set_updated_at_development_projects
before update on public.development_projects
for each row execute function public.set_updated_at();

create trigger set_updated_at_mentor_reports
before update on public.mentor_reports
for each row execute function public.set_updated_at();

create trigger set_updated_at_candidate_project_assignments
before update on public.candidate_project_assignments
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_competencies enable row level security;
alter table public.interview_questions enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_strengths enable row level security;
alter table public.interview_panels enable row level security;
alter table public.interview_scores enable row level security;
alter table public.strengths_library enable row level security;
alter table public.development_projects enable row level security;
alter table public.mentor_reports enable row level security;
alter table public.candidate_project_assignments enable row level security;

create policy "organization members can view their organization"
on public.organizations
for select
using (id = public.current_profile_organization_id());

create policy "organization members can manage peer profiles"
on public.profiles
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage roles"
on public.roles
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage role competencies"
on public.role_competencies
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage interview questions"
on public.interview_questions
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage candidates"
on public.candidates
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage candidate strengths"
on public.candidate_strengths
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage interview panels"
on public.interview_panels
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage interview scores"
on public.interview_scores
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage mentor reports"
on public.mentor_reports
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage candidate project assignments"
on public.candidate_project_assignments
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage organization projects"
on public.development_projects
for all
using (
  (
    organization_id is null
    and public.current_app_role() = 'system_admin'
  )
  or organization_id = public.current_profile_organization_id()
)
with check (
  (
    organization_id is null
    and public.current_app_role() = 'system_admin'
  )
  or organization_id = public.current_profile_organization_id()
);

create policy "authenticated users can view strengths library"
on public.strengths_library
for select
to authenticated
using (true);

create policy "system admins can manage strengths library"
on public.strengths_library
for all
to authenticated
using (public.current_app_role() = 'system_admin')
with check (public.current_app_role() = 'system_admin');
