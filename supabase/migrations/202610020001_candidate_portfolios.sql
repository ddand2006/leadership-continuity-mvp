create table if not exists public.candidate_portfolios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','submitted','approved','revoked','archived')),
  title text not null default 'Candidate progress portfolio',
  included_documents jsonb not null default '[]'::jsonb,
  liability_acknowledged_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(candidate_id, version)
);

create table if not exists public.candidate_portfolio_shares (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.candidate_portfolios(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'requested' check (status in ('requested','approved','sent','revoked','expired','declined')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz not null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_portfolio_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portfolio_id uuid references public.candidate_portfolios(id) on delete set null,
  share_id uuid references public.candidate_portfolio_shares(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','submitted','approved','declined','sent','downloaded','revoked','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists candidate_portfolios_candidate_idx
  on public.candidate_portfolios(candidate_id, version desc);
create index if not exists candidate_portfolio_shares_portfolio_idx
  on public.candidate_portfolio_shares(portfolio_id, status, expires_at);
create index if not exists candidate_portfolio_audit_portfolio_idx
  on public.candidate_portfolio_audit_events(portfolio_id, created_at desc);

alter table public.candidate_portfolios enable row level security;
alter table public.candidate_portfolio_shares enable row level security;
alter table public.candidate_portfolio_audit_events enable row level security;

create policy candidate_portfolios_org_read on public.candidate_portfolios
  for select to authenticated
  using (organization_id = public.current_profile_organization_id());
create policy candidate_portfolios_org_write on public.candidate_portfolios
  for all to authenticated
  using (organization_id = public.current_profile_organization_id())
  with check (organization_id = public.current_profile_organization_id());

create policy candidate_portfolio_shares_org_read on public.candidate_portfolio_shares
  for select to authenticated
  using (organization_id = public.current_profile_organization_id());
create policy candidate_portfolio_shares_org_write on public.candidate_portfolio_shares
  for all to authenticated
  using (organization_id = public.current_profile_organization_id())
  with check (organization_id = public.current_profile_organization_id());

create policy candidate_portfolio_audit_org_read on public.candidate_portfolio_audit_events
  for select to authenticated
  using (organization_id = public.current_profile_organization_id());
create policy candidate_portfolio_audit_insert on public.candidate_portfolio_audit_events
  for insert to authenticated
  with check (organization_id = public.current_profile_organization_id());
