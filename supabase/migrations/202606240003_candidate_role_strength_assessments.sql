create table public.candidate_role_strength_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  competency_id uuid not null references public.role_competencies(id) on delete cascade,
  strength_score numeric(3,2) not null check (strength_score >= 1 and strength_score <= 5),
  supporting_strengths jsonb not null default '[]'::jsonb,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, role_id, competency_id)
);

create index candidate_role_strength_assessments_candidate_role_idx
on public.candidate_role_strength_assessments (candidate_id, role_id);

create trigger set_updated_at_candidate_role_strength_assessments
before update on public.candidate_role_strength_assessments
for each row execute function public.set_updated_at();

alter table public.candidate_role_strength_assessments enable row level security;

create policy "organization members can manage candidate role strength assessments"
on public.candidate_role_strength_assessments
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

