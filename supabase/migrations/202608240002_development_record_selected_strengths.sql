-- Preserve the selected CliftonStrengths and their project-specific uses on each development record.
alter table public.development_records
  add column if not exists selected_strengths jsonb not null default '[]'::jsonb;
