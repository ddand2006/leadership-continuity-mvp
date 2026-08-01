create table public.training_selections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  training_program_id uuid not null references public.training_programs(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  competency_name text,
  candidate_id uuid references public.candidates(id) on delete set null,
  development_record_id uuid references public.development_records(id) on delete set null,
  status text not null default 'shortlisted' check (status in ('exploring','shortlisted','approved','scheduled','in_progress','completed','declined')),
  selected_by_user_id uuid references public.profiles(id) on delete set null,
  notes text,
  planned_start_date date,
  planned_completion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_selections_org_status_idx on public.training_selections (organization_id, status);
create trigger set_updated_at_training_selections before update on public.training_selections for each row execute function public.set_updated_at();
alter table public.training_selections enable row level security;
create policy "organization members can manage training selections" on public.training_selections
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
