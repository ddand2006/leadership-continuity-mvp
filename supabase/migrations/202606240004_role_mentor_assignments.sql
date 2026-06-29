create table public.role_mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, mentor_profile_id)
);

create index role_mentor_assignments_role_idx
on public.role_mentor_assignments (role_id, mentor_profile_id);

create index role_mentor_assignments_mentor_idx
on public.role_mentor_assignments (mentor_profile_id, role_id);

create trigger set_updated_at_role_mentor_assignments
before update on public.role_mentor_assignments
for each row execute function public.set_updated_at();

alter table public.role_mentor_assignments enable row level security;

create policy "organization members can manage role mentor assignments"
on public.role_mentor_assignments
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into public.role_mentor_assignments (
  organization_id,
  role_id,
  mentor_profile_id,
  status
)
select distinct
  organization_id,
  role_id,
  mentor_profile_id,
  'active'
from public.mentor_role_assignments
where mentor_profile_id is not null
on conflict (role_id, mentor_profile_id) do nothing;
