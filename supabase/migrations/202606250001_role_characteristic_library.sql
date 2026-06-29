create table public.role_characteristic_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (category in ('talent', 'skill', 'behavior')),
  characteristic text not null,
  normalized_characteristic text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, category, normalized_characteristic)
);

create index role_characteristic_library_org_idx
on public.role_characteristic_library (organization_id, category, characteristic);

create trigger set_updated_at_role_characteristic_library
before update on public.role_characteristic_library
for each row execute function public.set_updated_at();

alter table public.role_characteristic_library enable row level security;

create policy "organization members can manage role characteristic library"
on public.role_characteristic_library
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into public.role_characteristic_library (
  organization_id,
  category,
  characteristic,
  normalized_characteristic
)
select distinct
  organization_id,
  category,
  characteristic,
  lower(trim(regexp_replace(characteristic, '\s+', ' ', 'g')))
from public.role_candidate_characteristics
on conflict (organization_id, category, normalized_characteristic) do nothing;
