create table if not exists public.candidate_generated_mentoring_idea_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  competency_id uuid not null references public.role_competencies(id) on delete cascade,
  ideas_json jsonb not null default '[]'::jsonb,
  selected_idea_title text,
  selected_project_assignment_id uuid references public.candidate_project_assignments(id) on delete set null,
  selected_development_record_id uuid references public.development_records(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, candidate_id, role_id, competency_id)
);

create index if not exists candidate_generated_mentoring_idea_sets_lookup_idx
  on public.candidate_generated_mentoring_idea_sets (organization_id, candidate_id, role_id, competency_id);

create trigger set_updated_at_candidate_generated_mentoring_idea_sets
before update on public.candidate_generated_mentoring_idea_sets
for each row execute function public.set_updated_at();

alter table public.candidate_generated_mentoring_idea_sets enable row level security;

drop policy if exists "candidate_generated_mentoring_idea_sets_select" on public.candidate_generated_mentoring_idea_sets;
create policy "candidate_generated_mentoring_idea_sets_select"
  on public.candidate_generated_mentoring_idea_sets
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "candidate_generated_mentoring_idea_sets_insert" on public.candidate_generated_mentoring_idea_sets;
create policy "candidate_generated_mentoring_idea_sets_insert"
  on public.candidate_generated_mentoring_idea_sets
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "candidate_generated_mentoring_idea_sets_update" on public.candidate_generated_mentoring_idea_sets;
create policy "candidate_generated_mentoring_idea_sets_update"
  on public.candidate_generated_mentoring_idea_sets
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

drop policy if exists "candidate_generated_mentoring_idea_sets_delete" on public.candidate_generated_mentoring_idea_sets;
create policy "candidate_generated_mentoring_idea_sets_delete"
  on public.candidate_generated_mentoring_idea_sets
  for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from public.profiles where auth_user_id = auth.uid()
    )
  );
