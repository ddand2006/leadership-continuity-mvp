create table public.candidate_role_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  match_status text not null check (match_status in ('match', 'not_yet', 'not_recommended')),
  readiness_score numeric(5,2) check (readiness_score is null or (readiness_score >= 0 and readiness_score <= 100)),
  decision_notes text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hiring_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  decision text not null check (decision in ('hire', 'continue_mentoring', 'decline')),
  decision_notes text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index candidate_role_matches_track_created_idx on public.candidate_role_matches (organization_id, candidate_id, role_id, created_at desc);
create index hiring_decisions_track_created_idx on public.hiring_decisions (organization_id, candidate_id, role_id, created_at desc);

alter table public.candidate_role_matches enable row level security;
alter table public.hiring_decisions enable row level security;

create policy "organization members can manage candidate role matches" on public.candidate_role_matches
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage hiring decisions" on public.hiring_decisions
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
