create table if not exists public.personal_development_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  current_role_id uuid references public.roles(id) on delete set null,
  current_position_title text,
  years_in_role numeric(5,2) check (years_in_role is null or years_in_role >= 0),
  leadership_history text,
  organizational_context text,
  last_composite_generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personal_role_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  personal_development_profile_id uuid not null unique references public.personal_development_profiles(id) on delete cascade,
  source_role_id uuid references public.roles(id) on delete set null,
  role_mode text not null check (role_mode in ('organization_role', 'personal_role')),
  title text not null check (char_length(trim(title)) > 0),
  department text,
  description text not null check (char_length(trim(description)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personal_leadership_composites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  personal_development_profile_id uuid not null references public.personal_development_profiles(id) on delete cascade,
  personal_role_profile_id uuid not null references public.personal_role_profiles(id) on delete cascade,
  source_survey_id uuid references public.role_surveys(id) on delete set null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'generated', 'archived')),
  composite_json jsonb not null default '{}'::jsonb,
  narrative_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (personal_development_profile_id, version)
);

create table if not exists public.personal_source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  personal_development_profile_id uuid not null references public.personal_development_profiles(id) on delete cascade,
  document_category text not null check (char_length(trim(document_category)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  file_extension text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  storage_bucket text,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personal_strength_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  personal_development_profile_id uuid not null references public.personal_development_profiles(id) on delete cascade,
  source_document_id uuid references public.personal_source_documents(id) on delete set null,
  theme_name text not null,
  rank integer not null check (rank >= 1 and rank <= 34),
  domain text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (personal_development_profile_id, theme_name),
  unique (personal_development_profile_id, rank)
);

create index if not exists personal_development_profiles_org_profile_idx
  on public.personal_development_profiles (organization_id, profile_id);

create index if not exists personal_role_profiles_org_mode_idx
  on public.personal_role_profiles (organization_id, role_mode, created_at desc);

create index if not exists personal_leadership_composites_profile_generated_idx
  on public.personal_leadership_composites (
    personal_development_profile_id,
    generated_at desc,
    created_at desc
  );

create index if not exists personal_source_documents_profile_category_idx
  on public.personal_source_documents (
    personal_development_profile_id,
    document_category,
    created_at desc
  );

create index if not exists personal_strength_profiles_profile_rank_idx
  on public.personal_strength_profiles (
    personal_development_profile_id,
    rank asc
  );

create trigger set_updated_at_personal_development_profiles
before update on public.personal_development_profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_personal_role_profiles
before update on public.personal_role_profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_personal_leadership_composites
before update on public.personal_leadership_composites
for each row execute function public.set_updated_at();

create trigger set_updated_at_personal_source_documents
before update on public.personal_source_documents
for each row execute function public.set_updated_at();

create trigger set_updated_at_personal_strength_profiles
before update on public.personal_strength_profiles
for each row execute function public.set_updated_at();

alter table public.personal_development_profiles enable row level security;
alter table public.personal_role_profiles enable row level security;
alter table public.personal_leadership_composites enable row level security;
alter table public.personal_source_documents enable row level security;
alter table public.personal_strength_profiles enable row level security;

drop policy if exists "personal_development_profiles_manage" on public.personal_development_profiles;
create policy "personal_development_profiles_manage"
  on public.personal_development_profiles
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and (
      profile_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
    )
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and (
      profile_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
    )
  );

drop policy if exists "personal_role_profiles_manage" on public.personal_role_profiles;
create policy "personal_role_profiles_manage"
  on public.personal_role_profiles
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_development_profiles pdp
      where pdp.id = personal_role_profiles.personal_development_profile_id
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
      from public.personal_development_profiles pdp
      where pdp.id = personal_role_profiles.personal_development_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  );

drop policy if exists "personal_leadership_composites_manage" on public.personal_leadership_composites;
create policy "personal_leadership_composites_manage"
  on public.personal_leadership_composites
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_development_profiles pdp
      where pdp.id = personal_leadership_composites.personal_development_profile_id
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
      from public.personal_development_profiles pdp
      where pdp.id = personal_leadership_composites.personal_development_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  );

drop policy if exists "personal_source_documents_manage" on public.personal_source_documents;
create policy "personal_source_documents_manage"
  on public.personal_source_documents
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_development_profiles pdp
      where pdp.id = personal_source_documents.personal_development_profile_id
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
      from public.personal_development_profiles pdp
      where pdp.id = personal_source_documents.personal_development_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  );

drop policy if exists "personal_strength_profiles_manage" on public.personal_strength_profiles;
create policy "personal_strength_profiles_manage"
  on public.personal_strength_profiles
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and exists (
      select 1
      from public.personal_development_profiles pdp
      where pdp.id = personal_strength_profiles.personal_development_profile_id
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
      from public.personal_development_profiles pdp
      where pdp.id = personal_strength_profiles.personal_development_profile_id
        and (
          pdp.profile_id in (
            select id from public.profiles where auth_user_id = auth.uid()
          )
          or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
        )
    )
  );

insert into storage.buckets (id, name, public)
values ('personal-source-documents', 'personal-source-documents', false)
on conflict (id) do nothing;
