create table public.role_candidate_characteristics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  category text not null check (category in ('talent', 'skill', 'behavior')),
  characteristic text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index role_candidate_characteristics_role_idx
on public.role_candidate_characteristics (role_id, category, sort_order, created_at);

create trigger set_updated_at_role_candidate_characteristics
before update on public.role_candidate_characteristics
for each row execute function public.set_updated_at();

alter table public.role_candidate_characteristics enable row level security;

create policy "organization members can manage role candidate characteristics"
on public.role_candidate_characteristics
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
