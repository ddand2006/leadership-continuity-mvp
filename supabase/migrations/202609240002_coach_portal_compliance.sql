-- Coach Portal Sprint 1: versioned credentials, insurance, eligibility, and audit history.
-- Existing coaching profiles, engagements, sessions, and notes remain intact.
begin;

alter table public.coach_profiles
  add column if not exists eligibility_status text not null default 'action_required'
    check (eligibility_status in ('active','action_required','pending_verification','suspended','inactive')),
  add column if not exists profile_completion_percent integer not null default 0
    check (profile_completion_percent between 0 and 100),
  add column if not exists marketplace_visible boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

create table if not exists public.coach_credentials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  credential_type text not null,
  credential_name text not null,
  issuing_organization text,
  credential_number text,
  issued_date date,
  expiration_date date,
  document_bucket text,
  document_path text unique,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','expired')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_insurance (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  insurer text not null,
  policy_number text not null,
  coverage_type text not null,
  coverage_amount numeric(14,2),
  effective_date date not null,
  expiration_date date not null,
  certificate_bucket text not null,
  certificate_path text not null unique,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected','expired')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  rejection_reason text,
  administrator_notes text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiration_date >= effective_date)
);

create table if not exists public.coach_compliance_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  event_type text not null,
  related_record_type text,
  related_record_id uuid,
  previous_status text,
  new_status text,
  performed_by uuid references auth.users(id),
  system_generated boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists coach_credentials_coach_idx on public.coach_credentials(coach_id);
create index if not exists coach_insurance_coach_expiration_idx on public.coach_insurance(coach_id, expiration_date desc);
create index if not exists coach_compliance_events_coach_created_idx on public.coach_compliance_events(coach_id, created_at desc);

alter table public.coach_credentials enable row level security;
alter table public.coach_insurance enable row level security;
alter table public.coach_compliance_events enable row level security;
revoke all on public.coach_credentials from public, anon, authenticated;
revoke all on public.coach_insurance from public, anon, authenticated;
revoke all on public.coach_compliance_events from public, anon, authenticated;
grant all on public.coach_credentials to service_role;
grant all on public.coach_insurance to service_role;
grant all on public.coach_compliance_events to service_role;

insert into storage.buckets (id, name, public)
values ('coach-compliance-documents', 'coach-compliance-documents', false)
on conflict (id) do nothing;

create or replace function public.coach_profile_completion(p public.coach_profiles)
returns integer language sql immutable as $$
  select least(100, round(100.0 * (
    (case when nullif(trim(p.first_name), '') is not null then 1 else 0 end) +
    (case when nullif(trim(p.last_name), '') is not null then 1 else 0 end) +
    (case when nullif(trim(p.headline), '') is not null then 1 else 0 end) +
    (case when nullif(trim(p.short_bio), '') is not null then 1 else 0 end) +
    (case when nullif(trim(p.timezone), '') is not null then 1 else 0 end) +
    (case when p.years_coaching is not null then 1 else 0 end) +
    (case when p.virtual_available or p.in_person_available then 1 else 0 end)
  ) / 7)::integer);
$$;

create or replace function public.coach_eligibility(p public.coach_profiles)
returns jsonb language sql stable security definer set search_path = public as $$
  with latest_insurance as (
    select i.* from public.coach_insurance i
    where i.coach_id = p.id
    order by i.expiration_date desc, i.created_at desc
    limit 1
  ),
  current_credentials as (
    select count(*)::integer as count from public.coach_credentials c
    where c.coach_id = p.id
      and c.verification_status = 'verified'
      and (c.expiration_date is null or c.expiration_date >= current_date)
  )
  select jsonb_build_object(
    'application_approved', exists(select 1 from public.coach_applications a where a.coach_id = p.id and a.status = 'approved'),
    'profile_complete', public.coach_profile_completion(p) = 100,
    'insurance_submitted', exists(select 1 from latest_insurance),
    'insurance_verified', exists(select 1 from latest_insurance where verification_status = 'verified'),
    'insurance_current', exists(select 1 from latest_insurance where verification_status = 'verified' and expiration_date >= current_date),
    'credentials_current', (select count > 0 from current_credentials) or (p.icf_credential <> 'none' and p.credential_verification_status = 'verified' and (p.icf_credential_expiration_date is null or p.icf_credential_expiration_date >= current_date)),
    'manually_suspended', coalesce(p.profile_status = 'suspended' or p.marketplace_status = 'suspended', false),
    'manually_inactive', coalesce(p.profile_status = 'inactive' or p.marketplace_status = 'inactive', false)
  );
$$;

create or replace function public.coach_recalculate_eligibility(cid uuid, actor uuid default null, system_generated boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare p public.coach_profiles; checks jsonb; next_status text; old_status text;
begin
  select * into p from public.coach_profiles where id = cid for update;
  if p.id is null then raise exception 'Coach profile not found'; end if;
  old_status := p.eligibility_status;
  checks := public.coach_eligibility(p);
  next_status := case
    when checks->>'manually_suspended' = 'true' then 'suspended'
    when checks->>'manually_inactive' = 'true' then 'inactive'
    when checks->>'insurance_submitted' = 'true' and checks->>'insurance_verified' <> 'true' then 'pending_verification'
    when checks->>'application_approved' <> 'true' or checks->>'profile_complete' <> 'true' or checks->>'insurance_current' <> 'true' or checks->>'credentials_current' <> 'true' then 'action_required'
    else 'active'
  end;
  update public.coach_profiles
    set profile_completion_percent = public.coach_profile_completion(p),
        eligibility_status = next_status,
        marketplace_visible = next_status = 'active' and accepting_clients and marketplace_status in ('approved','approved_limited'),
        updated_at = now()
  where id = cid;
  if old_status is distinct from next_status then
    insert into public.coach_compliance_events(coach_id,event_type,previous_status,new_status,performed_by,system_generated,notes)
    values(cid,'eligibility_recalculated',old_status,next_status,actor,system_generated,'Eligibility status recalculated from current profile, application, insurance, and credential requirements.');
  end if;
  return next_status;
end;
$$;

revoke all on function public.coach_eligibility(public.coach_profiles) from public, anon, authenticated;
revoke all on function public.coach_recalculate_eligibility(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.coach_recalculate_eligibility(uuid, uuid, boolean) to service_role;

commit;
