alter table public.development_records
  add column if not exists source_project_assignment_id uuid references public.candidate_project_assignments(id) on delete set null,
  add column if not exists project_summary text,
  add column if not exists project_purpose text,
  add column if not exists working_goal text,
  add column if not exists why_it_fits text,
  add column if not exists mentor_focus text,
  add column if not exists first_step text,
  add column if not exists key_partners text[] not null default '{}',
  add column if not exists leadership_actions_required text[] not null default '{}',
  add column if not exists anticipated_challenges text[] not null default '{}',
  add column if not exists success_measures text[] not null default '{}',
  add column if not exists mentor_preparation text[] not null default '{}',
  add column if not exists mentee_preparation text[] not null default '{}',
  add column if not exists reflection_questions text[] not null default '{}',
  add column if not exists success_signals text[] not null default '{}';

create index if not exists development_records_source_project_assignment_idx
  on public.development_records (source_project_assignment_id);
