create table if not exists public.personal_role_competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  personal_role_profile_id uuid not null references public.personal_role_profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  definition text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (personal_role_profile_id, name)
);

create index if not exists personal_role_competencies_profile_sort_idx
  on public.personal_role_competencies (
    personal_role_profile_id,
    sort_order asc,
    created_at asc
  );

create trigger set_updated_at_personal_role_competencies
before update on public.personal_role_competencies
for each row execute function public.set_updated_at();

alter table public.personal_role_competencies enable row level security;

drop policy if exists "personal_role_competencies_manage" on public.personal_role_competencies;
create policy "personal_role_competencies_manage"
  on public.personal_role_competencies
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_role_profiles prp
      join public.personal_development_profiles pdp
        on pdp.id = prp.personal_development_profile_id
      where prp.id = personal_role_competencies.personal_role_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_role_profiles prp
      join public.personal_development_profiles pdp
        on pdp.id = prp.personal_development_profile_id
      where prp.id = personal_role_competencies.personal_role_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  );
