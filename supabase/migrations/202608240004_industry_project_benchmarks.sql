alter table public.organizations
  add column if not exists benchmark_contribution_enabled boolean not null default false;

alter table public.development_records
  add column if not exists mentee_worksheet jsonb,
  add column if not exists mentee_report_notes text;

create table if not exists public.industry_project_benchmarks (
  id uuid primary key default gen_random_uuid(),
  source_organization_id uuid references public.organizations(id) on delete set null,
  source_development_project_id uuid references public.development_projects(id) on delete set null,
  industry text not null,
  role_titles jsonb not null default '[]'::jsonb,
  competency_names jsonb not null default '[]'::jsonb,
  strengths_leveraged jsonb not null default '[]'::jsonb,
  project_json jsonb not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_development_project_id)
);

create index if not exists industry_project_benchmarks_industry_idx
  on public.industry_project_benchmarks (industry);

alter table public.industry_project_benchmarks enable row level security;
