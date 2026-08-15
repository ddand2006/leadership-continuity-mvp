-- Current-role 360 reviews are intentionally separate from succession candidates.
create table public.employee_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_user_id uuid not null references public.organization_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  supervisor_organization_user_id uuid references public.organization_users(id) on delete set null,
  department text,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index employee_role_assignments_one_active_idx on public.employee_role_assignments (organization_user_id) where status = 'active';
create index employee_role_assignments_org_idx on public.employee_role_assignments (organization_id, status);

create table public.review_360_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_organization_user_id uuid not null references public.organization_users(id) on delete restrict,
  employee_role_assignment_id uuid references public.employee_role_assignments(id) on delete set null,
  role_id uuid not null references public.roles(id) on delete restrict,
  role_title text not null,
  composite_version text not null,
  composite_effective_date date not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','invitations_pending','in_progress','ready_for_review','completed','archived')),
  due_date date,
  confidentiality_threshold integer not null default 3 check (confidentiality_threshold >= 2),
  self_other_gap_threshold numeric(3,2) not null default 0.40,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  launched_at timestamptz,
  completed_at timestamptz,
  results_released_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index review_360_cycles_org_status_idx on public.review_360_cycles (organization_id, status, created_at desc);
create index review_360_cycles_employee_idx on public.review_360_cycles (employee_organization_user_id, created_at desc);

create table public.review_360_snapshot_competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  source_role_competency_id uuid references public.role_competencies(id) on delete set null,
  name text not null,
  definition text not null,
  behavioral_indicators jsonb not null default '[]'::jsonb,
  weight numeric(5,2) not null check (weight >= 0),
  target_score numeric(3,2) not null check (target_score between 1 and 5),
  display_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (review_cycle_id, display_order)
);

create table public.review_360_respondents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  organization_user_id uuid references public.organization_users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  invited_relationship text not null check (invited_relationship in ('self','supervisor','peer','direct_report','other')),
  confirmed_relationship text check (confirmed_relationship in ('self','supervisor','peer','direct_report','other')),
  token_hash text not null unique,
  token_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending','opened','completed','revoked')),
  invited_at timestamptz,
  reminder_sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index review_360_respondents_cycle_idx on public.review_360_respondents (review_cycle_id, status);
create unique index review_360_respondents_cycle_email_lower_idx on public.review_360_respondents (review_cycle_id, lower(email));

create table public.review_360_ratings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  respondent_id uuid not null references public.review_360_respondents(id) on delete cascade,
  snapshot_competency_id uuid not null references public.review_360_snapshot_competencies(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  not_observed boolean not null default false,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((rating is null) = not_observed),
  unique (respondent_id, snapshot_competency_id)
);

create table public.review_360_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  respondent_id uuid not null unique references public.review_360_respondents(id) on delete cascade,
  strength text,
  development text,
  additional_feedback text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.review_360_audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null, event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger set_updated_at_employee_role_assignments before update on public.employee_role_assignments for each row execute function public.set_updated_at();
create trigger set_updated_at_review_360_cycles before update on public.review_360_cycles for each row execute function public.set_updated_at();
create trigger set_updated_at_review_360_respondents before update on public.review_360_respondents for each row execute function public.set_updated_at();
create trigger set_updated_at_review_360_ratings before update on public.review_360_ratings for each row execute function public.set_updated_at();

alter table public.employee_role_assignments enable row level security;
alter table public.review_360_cycles enable row level security;
alter table public.review_360_snapshot_competencies enable row level security;
alter table public.review_360_respondents enable row level security;
alter table public.review_360_ratings enable row level security;
alter table public.review_360_feedback enable row level security;
alter table public.review_360_audit_events enable row level security;

create policy "360 admins manage employee assignments" on public.employee_role_assignments for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage review cycles" on public.review_360_cycles for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage snapshots" on public.review_360_snapshot_competencies for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage respondents" on public.review_360_respondents for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage ratings" on public.review_360_ratings for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage feedback" on public.review_360_feedback for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
create policy "360 admins manage audit events" on public.review_360_audit_events for all to authenticated using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin')) with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
