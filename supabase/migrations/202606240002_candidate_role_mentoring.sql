create table public.candidate_role_considerations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  status text not null default 'active',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id)
);

create table public.mentor_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  start_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, mentor_profile_id)
);

create index candidate_role_considerations_candidate_idx
on public.candidate_role_considerations (candidate_id, role_id);

create index mentor_role_assignments_candidate_idx
on public.mentor_role_assignments (candidate_id, role_id);

create index mentor_role_assignments_mentor_idx
on public.mentor_role_assignments (mentor_profile_id, candidate_id);

create trigger set_updated_at_candidate_role_considerations
before update on public.candidate_role_considerations
for each row execute function public.set_updated_at();

create trigger set_updated_at_mentor_role_assignments
before update on public.mentor_role_assignments
for each row execute function public.set_updated_at();

alter table public.candidate_role_considerations enable row level security;
alter table public.mentor_role_assignments enable row level security;

create policy "organization members can manage candidate role considerations"
on public.candidate_role_considerations
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

create policy "organization members can manage mentor role assignments"
on public.mentor_role_assignments
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into public.candidate_role_considerations (
  organization_id,
  candidate_id,
  role_id,
  status,
  is_primary
)
select
  organization_id,
  id as candidate_id,
  target_role_id as role_id,
  'active',
  true
from public.candidates
where target_role_id is not null
on conflict (candidate_id, role_id) do nothing;

insert into public.mentor_role_assignments (
  organization_id,
  candidate_id,
  role_id,
  mentor_profile_id,
  status
)
select
  organization_id,
  id as candidate_id,
  target_role_id as role_id,
  mentor_profile_id,
  'active'
from public.candidates
where target_role_id is not null
  and mentor_profile_id is not null
on conflict (candidate_id, role_id, mentor_profile_id) do nothing;

