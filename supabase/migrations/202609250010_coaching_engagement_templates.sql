begin;

create table public.coaching_engagement_templates (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null unique references public.coaching_engagements(id) on delete cascade,
  agreement jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coaching_engagement_templates enable row level security;
revoke all on public.coaching_engagement_templates from anon, authenticated;
grant select on public.coaching_engagement_templates to authenticated;
create policy coaching_engagement_templates_read on public.coaching_engagement_templates
  for select to authenticated using (public.coaching_identity_enabled() and public.coaching_can_read(engagement_id, 'organization_shared'));
create trigger coaching_engagement_templates_updated_at before update on public.coaching_engagement_templates
  for each row execute function public.set_updated_at();

create or replace function public.coaching_template_mutate(operation text, payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  eid uuid := nullif(payload->>'engagement_id','')::uuid;
  kind text := payload->>'template';
  existing public.coaching_engagement_templates;
  result uuid;
begin
  if eid is null or kind not in ('agreement','action_plan','summary') then raise exception 'Invalid coaching template'; end if;
  if not exists (select 1 from public.coaching_engagements where id=eid)
    or not (public.coaching_is_coach(eid) or public.coaching_is_client(eid) or exists (select 1 from public.coaching_engagements e where e.id=eid and public.coaching_admin(e.organization_id))) then
    raise exception 'Not authorized';
  end if;
  insert into public.coaching_engagement_templates(engagement_id) values(eid)
    on conflict (engagement_id) do nothing;
  select * into existing from public.coaching_engagement_templates where engagement_id=eid;
  if operation <> 'template_save' then return existing.id; end if;
  if kind='agreement' then update public.coaching_engagement_templates set agreement=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  elsif kind='action_plan' then update public.coaching_engagement_templates set action_plan=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  else update public.coaching_engagement_templates set summary=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  end if;
  return existing.id;
end; $$;

revoke all on function public.coaching_template_mutate(text,jsonb) from public, anon, authenticated;
grant execute on function public.coaching_template_mutate(text,jsonb) to authenticated;

create or replace function public.coaching_template_read(eid uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not (public.coaching_is_coach(eid) or public.coaching_is_client(eid) or exists (select 1 from public.coaching_engagements e where e.id=eid and public.coaching_admin(e.organization_id))) then raise exception 'Not authorized'; end if;
  select jsonb_build_object('agreement',agreement,'action_plan',action_plan,'summary',summary) into result from public.coaching_engagement_templates where engagement_id=eid;
  return coalesce(result, '{}'::jsonb);
end; $$;
revoke all on function public.coaching_template_read(uuid) from public, anon, authenticated;
grant execute on function public.coaching_template_read(uuid) to authenticated;

commit;
