begin;
create table if not exists public.coach_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.coach_profiles(id) on delete cascade,
  leader_user_id uuid references auth.users(id) on delete cascade,
  engagement_id uuid,
  project_id uuid,
  permissions jsonb not null default '{"profile":true,"sessions":true,"goals":true}'::jsonb,
  status text not null default 'requested' check (status in ('requested','approved','revoked','expired')),
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (leader_user_id is not null or engagement_id is not null or project_id is not null)
);
create table if not exists public.coach_access_events (
  id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.coach_access_grants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id), event_type text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists coach_access_grants_coach_idx on public.coach_access_grants(coach_id,status);
create index if not exists coach_access_grants_org_idx on public.coach_access_grants(organization_id,status);
alter table public.coach_access_grants enable row level security;
alter table public.coach_access_events enable row level security;
revoke all on public.coach_access_grants, public.coach_access_events from public, anon, authenticated;
grant select on public.coach_access_grants, public.coach_access_events to authenticated;

create or replace function public.coach_access_is_org_admin(org_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where auth_user_id=auth.uid() and organization_id=org_id and role in ('hospital_admin','system_admin') and deleted_at is null)
$$;
create or replace function public.coach_access_read() returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; org uuid; result jsonb;
begin
  select id into cid from public.coach_profiles where user_id=auth.uid();
  select organization_id into org from public.profiles where auth_user_id=auth.uid() and deleted_at is null;
  select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at desc),'[]') into result from public.coach_access_grants g where (g.coach_id=cid) or public.coach_access_is_org_admin(g.organization_id) or exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='system_admin' and deleted_at is null);
  return result;
end; $$;
create or replace function public.coach_access_request(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; org uuid; rid uuid; coach_user uuid;
begin
  select organization_id into org from public.profiles where auth_user_id=auth.uid() and deleted_at is null;
  if org is null then raise exception 'Organization access required'; end if;
  cid:=(payload->>'coach_id')::uuid;
  select user_id into coach_user from public.coach_profiles where id=cid;
  if cid is null or not exists(select 1 from public.coach_profiles where id=cid) then raise exception 'Coach not found'; end if;
  insert into public.coach_access_grants(organization_id,coach_id,leader_user_id,engagement_id,project_id,permissions,requested_by,expires_at,notes)
  values(org,cid,nullif(payload->>'leader_user_id','')::uuid,nullif(payload->>'engagement_id','')::uuid,nullif(payload->>'project_id','')::uuid,coalesce(payload->'permissions','{"profile":true,"sessions":true,"goals":true}'::jsonb),auth.uid(),nullif(payload->>'expires_at','')::timestamptz,nullif(payload->>'notes','')) returning id into rid;
  insert into public.coach_access_events(grant_id,organization_id,actor_user_id,event_type,details) values(rid,org,auth.uid(),'access_requested',payload);
  if coach_user is not null then insert into public.notifications(recipient_user_id,event_type,title,href,dedupe_key) values(coach_user,'coach_access_requested','A client organization requested coaching access','/coaching/onboarding','coach-access:'||rid) on conflict do nothing; end if;
  for coach_user in select auth_user_id from public.profiles where role='system_admin' and deleted_at is null loop insert into public.notifications(recipient_user_id,event_type,title,href,dedupe_key) values(coach_user,'coach_access_requested','New coach access request requires review','/admin/coaching/coaches','coach-access-admin:'||rid) on conflict do nothing; end loop;
  return rid;
end; $$;
create or replace function public.coach_access_review(grant_id uuid, decision text, note text default null) returns text language plpgsql security definer set search_path=public as $$
declare g public.coach_access_grants; next_status text; coach_user uuid;
begin
  select * into g from public.coach_access_grants where id=grant_id;
  if not found or (not public.coach_access_is_org_admin(g.organization_id) and not exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='system_admin')) then raise exception 'Organization administrator access required'; end if;
  if decision not in ('approve','revoke') then raise exception 'Unsupported access decision'; end if;
  next_status:=case when decision='approve' then 'approved' else 'revoked' end;
  update public.coach_access_grants set status=next_status,approved_by=case when decision='approve' then auth.uid() else approved_by end,approved_at=case when decision='approve' then now() else approved_at end,revoked_at=case when decision='revoke' then now() else null end,notes=coalesce(note,notes),updated_at=now() where id=grant_id;
  insert into public.coach_access_events(grant_id,organization_id,actor_user_id,event_type,details) values(grant_id,g.organization_id,auth.uid(),'access_'||next_status,jsonb_build_object('note',note));
  select user_id into coach_user from public.coach_profiles where id=g.coach_id;
  if coach_user is not null then insert into public.notifications(recipient_user_id,event_type,title,href,dedupe_key) values(coach_user,'coach_access_updated','Your coaching access was '||next_status,'/coaching/notifications','coach-access-update:'||grant_id||':'||next_status) on conflict do nothing; end if;
  return next_status;
end; $$;
revoke all on function public.coach_access_read(),public.coach_access_request(jsonb),public.coach_access_review(uuid,text,text),public.coach_access_is_org_admin(uuid) from public,anon;
grant execute on function public.coach_access_read(),public.coach_access_request(jsonb),public.coach_access_review(uuid,text,text) to authenticated;
commit;
