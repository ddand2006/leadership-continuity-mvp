alter table public.development_projects
  add column if not exists industry text,
  add column if not exists source_development_record_id uuid references public.development_records(id) on delete set null,
  add column if not exists source_project_assignment_id uuid references public.candidate_project_assignments(id) on delete set null,
  add column if not exists purpose text,
  add column if not exists working_goal text,
  add column if not exists why_it_fits text,
  add column if not exists strengths_application text,
  add column if not exists mentor_focus text,
  add column if not exists first_step text,
  add column if not exists key_partners jsonb not null default '[]'::jsonb,
  add column if not exists leadership_actions_required jsonb not null default '[]'::jsonb,
  add column if not exists mentor_preparation jsonb not null default '[]'::jsonb,
  add column if not exists mentee_preparation jsonb not null default '[]'::jsonb,
  add column if not exists anticipated_challenges jsonb not null default '[]'::jsonb;

create index if not exists development_projects_industry_idx
  on public.development_projects (industry);

create index if not exists development_projects_source_record_idx
  on public.development_projects (source_development_record_id);
