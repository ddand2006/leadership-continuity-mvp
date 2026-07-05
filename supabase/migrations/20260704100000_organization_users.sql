create table public.organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid unique,
  profile_id uuid references public.profiles(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  email text not null check (char_length(trim(email)) > 0),
  is_candidate boolean not null default false,
  is_mentor boolean not null default false,
  admin_role text not null default 'none'
    check (admin_role in ('none', 'ceo_admin', 'manager_admin')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'archived')),
  invited_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  last_login_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index organization_users_org_email_lower_idx
on public.organization_users (organization_id, lower(email));

create index organization_users_org_status_idx
on public.organization_users (organization_id, status, admin_role);

create index organization_users_profile_idx
on public.organization_users (profile_id);

create index organization_users_candidate_idx
on public.organization_users (candidate_id);

create trigger set_updated_at_organization_users
before update on public.organization_users
for each row execute function public.set_updated_at();

alter table public.organization_users enable row level security;

create policy "organization members can manage organization users"
on public.organization_users
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into public.organization_users (
  organization_id,
  auth_user_id,
  profile_id,
  first_name,
  last_name,
  email,
  is_candidate,
  is_mentor,
  admin_role,
  status,
  activated_at,
  created_at,
  updated_at
)
select
  profiles.organization_id,
  profiles.auth_user_id,
  profiles.id,
  split_part(trim(profiles.full_name), ' ', 1) as first_name,
  case
    when position(' ' in trim(profiles.full_name)) > 0
      then substring(trim(profiles.full_name) from position(' ' in trim(profiles.full_name)) + 1)
    else 'User'
  end as last_name,
  profiles.email,
  profiles.role = 'candidate' as is_candidate,
  profiles.role = 'mentor' as is_mentor,
  case
    when profiles.role = 'system_admin' then 'ceo_admin'
    when profiles.role = 'hospital_admin' then 'manager_admin'
    else 'none'
  end as admin_role,
  case
    when profiles.deleted_at is null then 'active'
    else 'archived'
  end as status,
  case
    when profiles.deleted_at is null then now()
    else null
  end as activated_at,
  profiles.created_at,
  profiles.updated_at
from public.profiles
on conflict (organization_id, lower(email)) do nothing;
