-- Platform-operated account intake, manual access controls, and support audit trail.
alter table public.organizations
  add column if not exists manual_access_status text not null default 'active'
    check (manual_access_status in ('active', 'payment_hold')),
  add column if not exists manual_access_note text,
  add column if not exists manual_access_changed_at timestamptz,
  add column if not exists manual_access_changed_by_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.platform_account_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  company_name text not null,
  phone text not null,
  email text not null,
  role_title text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'approved', 'declined', 'archived')),
  notes text,
  first_contacted_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  last_reminder_sent_at timestamptz,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_account_requests_email_open_idx
  on public.platform_account_requests (lower(email))
  where status in ('new', 'contacted');
create index if not exists platform_account_requests_review_idx
  on public.platform_account_requests (status, next_review_at);

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  sales_notification_email text,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  system_admin_profile_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  account_request_id uuid references public.platform_account_requests(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_org_created_idx
  on public.platform_audit_events (organization_id, created_at desc);

drop trigger if exists set_updated_at_platform_account_requests on public.platform_account_requests;
create trigger set_updated_at_platform_account_requests before update on public.platform_account_requests
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_platform_settings on public.platform_settings;
create trigger set_updated_at_platform_settings before update on public.platform_settings
for each row execute function public.set_updated_at();

alter table public.platform_account_requests enable row level security;
alter table public.platform_settings enable row level security;
alter table public.platform_support_sessions enable row level security;
alter table public.platform_audit_events enable row level security;
