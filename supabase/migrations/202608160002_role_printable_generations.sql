create table public.role_printable_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  document_type text not null check (document_type in ('role_composite','condensed_profile','printable_narrative','interview_scorecard')),
  competency_signature text not null,
  generated_at timestamptz not null default timezone('utc', now()),
  generated_by_profile_id uuid references public.profiles(id) on delete set null,
  unique (role_id, document_type)
);

create index role_printable_generations_role_idx on public.role_printable_generations (role_id, generated_at desc);
alter table public.role_printable_generations enable row level security;

create policy "Role printables managed by administrators"
  on public.role_printable_generations for all to authenticated
  using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'))
  with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));
