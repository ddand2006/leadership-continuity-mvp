alter table public.coaching_engagement_templates
  add column if not exists progress_reports jsonb not null default '[]'::jsonb;

create or replace function public.coaching_template_mutate(operation text, payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  eid uuid := nullif(payload->>'engagement_id','')::uuid;
  kind text := payload->>'template';
  existing public.coaching_engagement_templates;
  result uuid;
  reports jsonb;
begin
  if eid is null or kind not in ('agreement','action_plan','progress_report','summary') then
    raise exception 'Invalid coaching template';
  end if;
  if not exists (select 1 from public.coaching_engagements where id=eid)
    or not (public.coaching_is_coach(eid) or public.coaching_is_client(eid)
      or exists (select 1 from public.coaching_engagements e where e.id=eid and public.coaching_admin(e.organization_id))) then
    raise exception 'Not authorized';
  end if;
  insert into public.coaching_engagement_templates(engagement_id) values(eid)
    on conflict (engagement_id) do nothing;
  select * into existing from public.coaching_engagement_templates where engagement_id=eid;
  if operation <> 'template_save' then return existing.id; end if;
  if kind='agreement' then
    update public.coaching_engagement_templates set agreement=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  elsif kind='action_plan' then
    update public.coaching_engagement_templates set action_plan=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  elsif kind='progress_report' then
    select coalesce(progress_reports, '[]'::jsonb) into reports from public.coaching_engagement_templates where id=existing.id;
    update public.coaching_engagement_templates
      set progress_reports = reports || jsonb_build_array(coalesce(payload->'data','{}'::jsonb))
      where id=existing.id;
  else
    update public.coaching_engagement_templates set summary=coalesce(payload->'data','{}'::jsonb) where id=existing.id;
  end if;
  return existing.id;
end; $$;

create or replace function public.coaching_template_read(eid uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not (public.coaching_is_coach(eid) or public.coaching_is_client(eid)
    or exists (select 1 from public.coaching_engagements e where e.id=eid and public.coaching_admin(e.organization_id))) then
    raise exception 'Not authorized';
  end if;
  select jsonb_build_object(
    'agreement', agreement,
    'action_plan', action_plan,
    'progress_reports', coalesce(progress_reports, '[]'::jsonb),
    'summary', summary
  ) into result
  from public.coaching_engagement_templates where engagement_id=eid;
  return coalesce(result, '{}'::jsonb);
end; $$;
