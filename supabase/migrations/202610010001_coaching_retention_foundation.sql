-- Coaching retention foundation: scoped policy metadata, legal holds, exports,
-- and disposition audit records. Execution jobs are intentionally separate.
begin;

alter table public.coaching_retention_rules
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists effective_until timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists policy_version text not null default 'retention-v1';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'coaching_retention_rules_effective_window') then
    alter table public.coaching_retention_rules add constraint coaching_retention_rules_effective_window
      check (effective_until is null or effective_until > effective_from);
  end if;
end $$;

comment on table public.coaching_retention_rules is
  'Platform-governed retention rules. The effective period must satisfy the longest applicable legal, contractual, or legal-hold requirement.';
comment on column public.coaching_retention_rules.retain_days is
  'Configured minimum retention period. Null means an administrator must review the record individually.';

create table if not exists public.coaching_legal_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  subject_user_id uuid references auth.users(id),
  engagement_id uuid references public.coaching_engagements(id),
  record_categories text[] not null default '{}',
  hold_reference text not null,
  reason text not null,
  placed_by uuid not null references auth.users(id),
  placed_at timestamptz not null default now(),
  released_by uuid references auth.users(id),
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (organization_id is not null or subject_user_id is not null or engagement_id is not null),
  check (released_at is null or released_by is not null),
  check (released_at is null or release_reason is not null)
);
alter table public.coaching_legal_holds enable row level security;
revoke all on public.coaching_legal_holds from public, anon, authenticated;

create table if not exists public.coaching_termination_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  requested_by uuid not null references auth.users(id),
  status text not null default 'requested' check(status in ('requested','preparing','ready','expired','failed','cancelled')),
  categories text[] not null default '{}',
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  storage_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'ready' or storage_reference is not null),
  check (status <> 'expired' or expires_at is not null)
);
alter table public.coaching_termination_exports enable row level security;
revoke all on public.coaching_termination_exports from public, anon, authenticated;

create table if not exists public.coaching_disposition_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  record_category text not null,
  record_ids jsonb not null default '[]',
  disposition text not null check(disposition in ('review','delete','anonymize','restrict')),
  reason text not null,
  policy_version text not null,
  legal_hold_checked boolean not null default false,
  actor_user_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  execution_reference text,
  created_at timestamptz not null default now()
);
alter table public.coaching_disposition_events enable row level security;
revoke all on public.coaching_disposition_events from public, anon, authenticated;

create index if not exists coaching_legal_holds_active_idx on public.coaching_legal_holds(organization_id, released_at) where released_at is null;
create index if not exists coaching_termination_exports_org_idx on public.coaching_termination_exports(organization_id, status, expires_at);
create index if not exists coaching_disposition_events_org_idx on public.coaching_disposition_events(organization_id, occurred_at desc);

create or replace function public.coaching_retention_admin(operation text, payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; hold public.coaching_legal_holds; actor uuid := auth.uid();
begin
  if not public.coaching_platform_admin() then raise exception 'Platform administrator required'; end if;
  if operation = 'legal_hold_place' then
    insert into public.coaching_legal_holds(
      organization_id, subject_user_id, engagement_id, record_categories,
      hold_reference, reason, placed_by
    ) values (
      nullif(payload->>'organization_id','')::uuid,
      nullif(payload->>'subject_user_id','')::uuid,
      nullif(payload->>'engagement_id','')::uuid,
      coalesce(array(select jsonb_array_elements_text(payload->'categories')), '{}'),
      nullif(trim(payload->>'hold_reference'), ''),
      nullif(trim(payload->>'reason'), ''), actor
    ) returning id into result;
  elsif operation = 'legal_hold_release' then
    select * into hold from public.coaching_legal_holds where id=(payload->>'id')::uuid for update;
    if hold.id is null then raise exception 'Legal hold not found'; end if;
    if hold.released_at is not null then raise exception 'Legal hold is already released'; end if;
    update public.coaching_legal_holds set released_by=actor, released_at=now(), release_reason=nullif(trim(payload->>'reason'), ''), updated_at=now() where id=hold.id returning id into result;
  elsif operation = 'termination_export_request' then
    insert into public.coaching_termination_exports(organization_id, requested_by, categories) values ((payload->>'organization_id')::uuid, actor, coalesce(array(select jsonb_array_elements_text(payload->'categories')), '{}')) returning id into result;
  else
    raise exception 'Unsupported retention operation';
  end if;
  return result;
end $$;
revoke all on function public.coaching_retention_admin(text,jsonb) from public, anon;
grant execute on function public.coaching_retention_admin(text,jsonb) to authenticated;

create or replace function public.coaching_retention_admin_read()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'holds', coalesce((select jsonb_agg(to_jsonb(h) order by h.placed_at desc) from public.coaching_legal_holds h where h.released_at is null), '[]'::jsonb),
    'exports', coalesce((select jsonb_agg(to_jsonb(e) order by e.requested_at desc) from public.coaching_termination_exports e), '[]'::jsonb),
    'dispositions', coalesce((select jsonb_agg(to_jsonb(d) order by d.occurred_at desc) from public.coaching_disposition_events d), '[]'::jsonb)
  )
  where public.coaching_platform_admin();
$$;
revoke all on function public.coaching_retention_admin_read() from public, anon;
grant execute on function public.coaching_retention_admin_read() to authenticated;

create or replace function public.coaching_retention_cases_read(filters jsonb default '{}')
returns jsonb language sql stable security definer set search_path=public as $$
  with requests as (
    select
      r.id,
      r.organization_id,
      r.subject_user_id,
      r.requested_by,
      r.action,
      r.categories,
      r.reason,
      r.status,
      r.decision_reason,
      r.execution_reference,
      r.created_at,
      r.updated_at,
      coalesce(c.full_name, p.full_name, r.subject_user_id::text) as candidate_name,
      cp.display_name as coach_name,
      e.id as engagement_id,
      e.title as engagement_title
    from public.coaching_privacy_requests r
    left join public.profiles p on p.auth_user_id = r.subject_user_id
    left join lateral (
      select e.*
      from public.coaching_engagements e
      where e.coachee_user_id = r.subject_user_id
        and (r.organization_id is null or e.organization_id = r.organization_id)
      order by e.updated_at desc
      limit 1
    ) e on true
    left join public.candidates c on c.id = e.candidate_id
    left join public.coach_profiles cp on cp.id = e.coach_id
    where public.coaching_platform_admin()
      and (nullif(filters->>'status', '') is null or r.status = filters->>'status')
      and (nullif(filters->>'candidate_id', '') is null or c.id = (filters->>'candidate_id')::uuid)
      and (nullif(filters->>'coach_id', '') is null or cp.id = (filters->>'coach_id')::uuid)
      and (nullif(filters->>'engagement_id', '') is null or e.id = (filters->>'engagement_id')::uuid)
      and (nullif(filters->>'q', '') is null or concat_ws(' ', c.full_name, p.full_name, cp.display_name, e.title, r.reason, r.execution_reference) ilike '%' || (filters->>'q') || '%')
    order by r.created_at desc
  )
  select jsonb_build_object(
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(requests)) from requests), '[]'::jsonb),
    'holds', coalesce((select jsonb_agg(to_jsonb(h) order by h.placed_at desc) from public.coaching_legal_holds h where h.released_at is null), '[]'::jsonb),
    'exports', coalesce((select jsonb_agg(to_jsonb(x) order by x.requested_at desc) from public.coaching_termination_exports x), '[]'::jsonb)
  );
$$;
revoke all on function public.coaching_retention_cases_read(jsonb) from public, anon;
grant execute on function public.coaching_retention_cases_read(jsonb) to authenticated;

commit;
