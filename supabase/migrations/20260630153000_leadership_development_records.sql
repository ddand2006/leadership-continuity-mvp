create table if not exists public.development_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  target_role text not null,
  date_assigned date not null,
  status text not null check (status in ('assigned', 'in_progress', 'ready_for_review', 'completed')),
  growth_areas text[] not null default '{}',
  assignment_reason text,
  experience_title text not null,
  mentee_task text,
  readiness_signal text check (readiness_signal in ('developing', 'progressing', 'near_role_ready', 'role_ready')),
  mentor_improvement_observed text,
  mentor_development_needed text,
  next_recommended_experience text,
  mentor_review_date date,
  average_feedback_score numeric(4,2),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists development_records_org_candidate_role_idx
  on public.development_records (organization_id, candidate_id, role_id, mentor_id);

create table if not exists public.development_record_competencies (
  id uuid primary key default gen_random_uuid(),
  development_record_id uuid not null references public.development_records(id) on delete cascade,
  competency_name text not null,
  baseline_score integer not null check (baseline_score between 1 and 5),
  target_score integer not null check (target_score between 1 and 5),
  current_score integer check (current_score between 1 and 5),
  improvement integer,
  gap_remaining integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists development_record_competencies_record_idx
  on public.development_record_competencies (development_record_id);

create table if not exists public.development_record_leaders (
  id uuid primary key default gen_random_uuid(),
  development_record_id uuid not null references public.development_records(id) on delete cascade,
  leader_name text not null,
  department text,
  purpose text,
  meeting_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists development_record_leaders_record_idx
  on public.development_record_leaders (development_record_id);

create table if not exists public.development_record_feedback (
  id uuid primary key default gen_random_uuid(),
  development_record_id uuid not null references public.development_records(id) on delete cascade,
  reviewer_name text not null,
  reviewer_role text not null,
  review_date date not null,
  growth_score integer not null check (growth_score between 1 and 5),
  communication_score integer not null check (communication_score between 1 and 5),
  collaboration_score integer not null check (collaboration_score between 1 and 5),
  feedback_application_score integer not null check (feedback_application_score between 1 and 5),
  readiness_score integer not null check (readiness_score between 1 and 5),
  evidence_comments text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists development_record_feedback_record_idx
  on public.development_record_feedback (development_record_id);

alter table public.development_records enable row level security;
alter table public.development_record_competencies enable row level security;
alter table public.development_record_leaders enable row level security;
alter table public.development_record_feedback enable row level security;

drop policy if exists "development_records_select" on public.development_records;
create policy "development_records_select"
  on public.development_records
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "development_records_insert" on public.development_records;
create policy "development_records_insert"
  on public.development_records
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "development_records_update" on public.development_records;
create policy "development_records_update"
  on public.development_records
  for update
  to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "development_records_delete" on public.development_records;
create policy "development_records_delete"
  on public.development_records
  for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "development_record_competencies_all" on public.development_record_competencies;
create policy "development_record_competencies_all"
  on public.development_record_competencies
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_competencies.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_competencies.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  );

drop policy if exists "development_record_leaders_all" on public.development_record_leaders;
create policy "development_record_leaders_all"
  on public.development_record_leaders
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_leaders.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_leaders.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  );

drop policy if exists "development_record_feedback_all" on public.development_record_feedback;
create policy "development_record_feedback_all"
  on public.development_record_feedback
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_feedback.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.development_records
      where public.development_records.id = development_record_feedback.development_record_id
        and public.development_records.organization_id in (
          select organization_id from public.profiles where auth_user_id = auth.uid()
        )
    )
  );
