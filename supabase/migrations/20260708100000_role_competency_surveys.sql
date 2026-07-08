create table if not exists public.role_surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  intro_message text,
  thank_you_message text,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  launched_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_survey_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  survey_id uuid not null references public.role_surveys(id) on delete cascade,
  recipient_name text not null check (char_length(trim(recipient_name)) > 0),
  recipient_email text not null check (char_length(trim(recipient_email)) > 0),
  recipient_title text,
  relationship_to_role text,
  access_token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'opened', 'completed')
  ),
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_survey_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  survey_id uuid not null references public.role_surveys(id) on delete cascade,
  recipient_id uuid not null references public.role_survey_recipients(id) on delete cascade,
  response_json jsonb not null default '{}'::jsonb,
  normalized_competencies jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (recipient_id)
);

create table if not exists public.role_survey_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  survey_id uuid not null unique references public.role_surveys(id) on delete cascade,
  source_response_count integer not null default 0 check (source_response_count >= 0),
  summary_json jsonb not null default '{}'::jsonb,
  generated_by_profile_id uuid references public.profiles(id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists role_surveys_org_role_idx
  on public.role_surveys (organization_id, role_id, created_at desc);

create index if not exists role_surveys_status_idx
  on public.role_surveys (organization_id, status, created_at desc);

create unique index if not exists role_survey_recipients_survey_email_lower_idx
  on public.role_survey_recipients (survey_id, lower(recipient_email));

create index if not exists role_survey_recipients_org_status_idx
  on public.role_survey_recipients (organization_id, status, created_at desc);

create index if not exists role_survey_recipients_access_token_idx
  on public.role_survey_recipients (access_token);

create index if not exists role_survey_responses_org_survey_idx
  on public.role_survey_responses (organization_id, survey_id, submitted_at desc);

create index if not exists role_survey_summaries_org_idx
  on public.role_survey_summaries (organization_id, generated_at desc);

create trigger set_updated_at_role_surveys
before update on public.role_surveys
for each row execute function public.set_updated_at();

create trigger set_updated_at_role_survey_recipients
before update on public.role_survey_recipients
for each row execute function public.set_updated_at();

create trigger set_updated_at_role_survey_responses
before update on public.role_survey_responses
for each row execute function public.set_updated_at();

create trigger set_updated_at_role_survey_summaries
before update on public.role_survey_summaries
for each row execute function public.set_updated_at();

alter table public.role_surveys enable row level security;
alter table public.role_survey_recipients enable row level security;
alter table public.role_survey_responses enable row level security;
alter table public.role_survey_summaries enable row level security;

drop policy if exists "role_surveys_admin_manage" on public.role_surveys;
create policy "role_surveys_admin_manage"
  on public.role_surveys
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  );

drop policy if exists "role_survey_recipients_admin_manage" on public.role_survey_recipients;
create policy "role_survey_recipients_admin_manage"
  on public.role_survey_recipients
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  );

drop policy if exists "role_survey_responses_admin_manage" on public.role_survey_responses;
create policy "role_survey_responses_admin_manage"
  on public.role_survey_responses
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  );

drop policy if exists "role_survey_summaries_admin_manage" on public.role_survey_summaries;
create policy "role_survey_summaries_admin_manage"
  on public.role_survey_summaries
  for all
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and public.current_app_role() in ('system_admin', 'hospital_admin')
  );
