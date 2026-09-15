-- Sprint 2 extends the existing coaching domain. No commerce or calendar-provider integration.
begin;
create extension if not exists btree_gist;
alter table public.coach_requests alter column coach_id drop not null;
alter table public.coach_requests drop constraint coach_requests_status_check;
alter table public.coach_requests add constraint coach_requests_status_check check(status in ('draft','submitted','under_review','coach_contacted','accepted','declined','matching','reviewing_matches','coach_invited','coach_interested','coach_declined','leader_review','engagement_setup','converted_to_engagement','cancelled','closed'));
alter table public.coach_requests
 add column workflow_version integer not null default 1,
 add column candidate_id uuid references public.candidates(id),
 add column target_role_id uuid references public.roles(id),
 add column request_title text,
 add column objectives text[] not null default '{}',
 add column context_categories text[] not null default '{}',
 add column competency_ids uuid[] not null default '{}',
 add column specialty_ids uuid[] not null default '{}',
 add column preferred_industry_id uuid references public.industries(id),
 add column preferred_leadership_level_id uuid references public.leadership_levels(id),
 add column preferred_credential text check(preferred_credential in ('none','acc','pcc','mcc','other')),
 add column preferred_format text check(preferred_format in ('video','phone','in_person','other')),
 add column location_preference text,
 add column timezone text,
 add column language text,
 add column preferred_start_date date,
 add column desired_duration_months integer check(desired_duration_months between 1 and 120),
 add column estimated_sessions integer check(estimated_sessions between 1 and 1000),
 add column submitted_at timestamptz,
 add column matching_run_id uuid,
 add column leader_accepted_at timestamptz;
alter table public.coaching_engagements add column consent_policy_version integer not null default 1;
create table public.coaching_match_weights(id uuid primary key default gen_random_uuid(),factor_key text unique not null check(factor_key in ('specialty','competency','industry','leadership_level','credential','format','availability','geography')),weight numeric not null check(weight between 0 and 100),active boolean not null default true,updated_at timestamptz not null default now(),updated_by uuid);
insert into public.coaching_match_weights(factor_key,weight) values ('specialty',25),('competency',20),('industry',15),('leadership_level',15),('credential',10),('format',5),('availability',5),('geography',5);
create table public.coaching_match_results(
 id uuid primary key default gen_random_uuid(),coach_request_id uuid not null references public.coach_requests(id),coach_id uuid not null references public.coach_profiles(id),run_id uuid not null,
 match_score numeric not null check(match_score between 0 and 100),factor_scores jsonb not null,match_reasons jsonb not null,unmet_preferences jsonb not null,
 matching_version text not null default 'rules-v1',excluded boolean not null default false,capacity_override boolean not null default false,admin_reason text,
 created_at timestamptz not null default clock_timestamp()
);
create table public.coaching_invitations(
 id uuid primary key default gen_random_uuid(),coach_request_id uuid not null references public.coach_requests(id),organization_id uuid not null references public.organizations(id),coach_id uuid not null references public.coach_profiles(id),requested_for_user_id uuid references auth.users(id),
 invited_by uuid not null,invited_at timestamptz not null default now(),message text,
 status text not null default 'pending' check(status in ('pending','viewed','interested','declined','expired','withdrawn','converted')),
 responded_at timestamptz,response_message text,decline_reason text,admin_question text,capacity_override boolean not null default false,
 expires_at timestamptz not null default now()+interval '14 days',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index coaching_one_open_invite on public.coaching_invitations(coach_request_id,coach_id) where status in ('pending','viewed','interested','converted');
alter table public.coach_requests add column selected_invitation_id uuid references public.coaching_invitations(id);
create table public.coaching_intro_meetings(
 id uuid primary key default gen_random_uuid(),coach_request_id uuid not null references public.coach_requests(id),coach_id uuid not null references public.coach_profiles(id),coachee_user_id uuid not null references auth.users(id),
 scheduled_start_at timestamptz,scheduled_end_at timestamptz,format text not null default 'video' check(format in ('video','phone','in_person','other')),location_or_link text,
 status text not null default 'requested' check(status in ('requested','scheduled','completed','cancelled')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(scheduled_end_at is null or scheduled_end_at>scheduled_start_at),check(status<>'scheduled' or (scheduled_start_at is not null and scheduled_end_at is not null)),unique(coach_request_id,coach_id)
);
create table public.coach_availability_rules(
 id uuid primary key default gen_random_uuid(),coach_id uuid not null references public.coach_profiles(id),day_of_week integer not null check(day_of_week between 0 and 6),start_time time not null,end_time time not null,timezone text not null,
 effective_start_date date not null default current_date,effective_end_date date,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(end_time>start_time),check(effective_end_date is null or effective_end_date>=effective_start_date)
);
create table public.coach_availability_exceptions(
 id uuid primary key default gen_random_uuid(),coach_id uuid not null references public.coach_profiles(id),exception_date date not null,start_time time,end_time time,timezone text not null,
 exception_type text not null check(exception_type in ('unavailable','custom_availability')),notes text,created_at timestamptz not null default now(),
 check((start_time is null and end_time is null and exception_type='unavailable') or (start_time is not null and end_time is not null and end_time>start_time))
);
create table public.coaching_session_changes(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.coaching_sessions(id),requested_by uuid not null,change_type text not null check(change_type in ('reschedule','cancel')),original_start_at timestamptz,requested_start_at timestamptz,requested_end_at timestamptz,reason text,
 status text not null default 'pending' check(status in ('pending','approved','declined','completed')),created_at timestamptz not null default now(),resolved_at timestamptz,
 check(change_type<>'reschedule' or (requested_start_at is not null and requested_end_at>requested_start_at))
);
create unique index coaching_pending_session_change on public.coaching_session_changes(session_id) where status='pending';
create table public.coaching_engagement_closeouts(
 id uuid primary key default gen_random_uuid(),engagement_id uuid not null unique references public.coaching_engagements(id),coach_completed_at timestamptz,coachee_completed_at timestamptz,organization_completed_at timestamptz,
 coach_shared_summary text,coachee_shared_reflection text,organization_outcome_notes text,continue_recommended boolean,additional_coaching_recommended boolean,
 final_status text check(final_status in ('completed','extended','renewed','terminated')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
-- A general recipient-owned inbox; email uses the existing Resend adapter through an outbox.
create table public.notifications(
 id uuid primary key default gen_random_uuid(),recipient_user_id uuid not null references auth.users(id),event_type text not null,title text not null,href text not null,
 dedupe_key text not null,created_by_user_id uuid default auth.uid(),read_at timestamptz,email_sent_at timestamptz,email_attempted_at timestamptz,email_claim_token uuid,
 created_at timestamptz not null default now(),unique(recipient_user_id,dedupe_key)
);
create schema if not exists coaching_internal;
revoke all on schema coaching_internal from public,anon;
grant usage on schema coaching_internal to authenticated;
create function coaching_internal.request_admin(rid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from coach_requests where id=rid and coaching_admin(organization_id)) $$;
create function coaching_internal.owner(cid uuid) returns boolean language sql stable security definer set search_path=public as $$ select coaching_identity_enabled() and exists(select 1 from coach_profiles where id=cid and user_id=auth.uid()) $$;
create function coaching_internal.request_client(rid uuid) returns boolean language sql stable security definer set search_path=public as $$ select coaching_identity_enabled() and exists(select 1 from coach_requests where id=rid and requested_for_user_id=auth.uid() and status in ('leader_review','engagement_setup','converted_to_engagement')) $$;
create function coaching_internal.eligible(cid uuid, override_capacity boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from coach_profiles c where c.id=cid and profile_status='approved' and accepting_clients and availability_status<>'unavailable' and user_id is not null and
 (override_capacity or max_active_clients is null or (select count(distinct coachee_user_id) from coaching_engagements where coach_id=cid and status='active')<max_active_clients))
$$;
create function coaching_internal.notify(rid uuid,event text,entity uuid,extra uuid[] default '{}') returns void language plpgsql security definer set search_path=public as $$
declare r coach_requests; recipient uuid; begin
 select * into r from coach_requests where id=rid;
 for recipient in select distinct id from (
 select p.auth_user_id as id from profiles p where p.deleted_at is null and (p.role='system_admin' or (p.organization_id=r.organization_id and p.role='hospital_admin'))
 union select unnest(extra)) x where id is not null loop
 insert into notifications(recipient_user_id,event_type,title,href,dedupe_key) values(recipient,event,replace(event,'_',' '),coalesce((select '/coaching/clients/'||id from coaching_engagements where coach_request_id=rid),case when exists(select 1 from coach_profiles where user_id=recipient) then '/coaching/opportunities' else '/coaching/requests' end),event||':'||entity::text) on conflict do nothing;
 end loop;
end $$;
alter table public.coaching_match_weights enable row level security;
revoke all on public.coaching_match_weights from anon,authenticated; grant select on public.coaching_match_weights to authenticated;
create policy coaching_match_weights_read on public.coaching_match_weights for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_identity_enabled()));
alter table public.coaching_match_results enable row level security;
revoke all on public.coaching_match_results from anon,authenticated; grant select on public.coaching_match_results to authenticated;
create policy coaching_match_results_read on public.coaching_match_results for select to authenticated using (public.coaching_identity_enabled() and (coaching_internal.request_admin(coach_request_id)));
alter table public.coaching_invitations enable row level security;
revoke all on public.coaching_invitations from anon,authenticated; grant select on public.coaching_invitations to authenticated;
create policy coaching_invitations_read on public.coaching_invitations for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_admin(organization_id)));
alter table public.coaching_intro_meetings enable row level security;
revoke all on public.coaching_intro_meetings from anon,authenticated; grant select on public.coaching_intro_meetings to authenticated;
create policy coaching_intro_meetings_read on public.coaching_intro_meetings for select to authenticated using (public.coaching_identity_enabled() and (coaching_internal.request_admin(coach_request_id) or coaching_internal.owner(coach_id) or coachee_user_id=auth.uid()));
alter table public.coach_availability_rules enable row level security;
revoke all on public.coach_availability_rules from anon,authenticated; grant select on public.coach_availability_rules to authenticated;
create policy coach_availability_rules_read on public.coach_availability_rules for select to authenticated using (public.coaching_identity_enabled() and (coaching_internal.owner(coach_id)));
alter table public.coach_availability_exceptions enable row level security;
revoke all on public.coach_availability_exceptions from anon,authenticated; grant select on public.coach_availability_exceptions to authenticated;
create policy coach_availability_exceptions_read on public.coach_availability_exceptions for select to authenticated using (public.coaching_identity_enabled() and (coaching_internal.owner(coach_id)));
alter table public.coaching_session_changes enable row level security;
revoke all on public.coaching_session_changes from anon,authenticated; grant select on public.coaching_session_changes to authenticated;
create policy coaching_session_changes_read on public.coaching_session_changes for select to authenticated using (public.coaching_identity_enabled() and (exists(select 1 from public.coaching_sessions s where s.id=session_id and (public.coaching_is_coach(s.engagement_id) or public.coaching_is_client(s.engagement_id)))));
alter table public.coaching_engagement_closeouts enable row level security;
revoke all on public.coaching_engagement_closeouts from anon,authenticated; grant select on public.coaching_engagement_closeouts to authenticated;
create policy coaching_engagement_closeouts_read on public.coaching_engagement_closeouts for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_can_read(engagement_id,'organization_shared')));
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated; grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated using (public.coaching_identity_enabled() and (recipient_user_id=auth.uid()));
create index on public.coaching_match_results(coach_request_id,run_id,created_at desc);
create index on public.coaching_invitations(coach_id,status);
create index on public.coach_availability_rules(coach_id);
create index on public.coach_availability_exceptions(coach_id,exception_date);
create index on public.notifications(recipient_user_id,created_at desc);
-- Race-safe double-booking protection. Existing unscheduled log records are unaffected.
alter table public.coaching_sessions add constraint coaching_no_overlap exclude using gist
 (coach_id with =, tstzrange(scheduled_start_at,scheduled_end_at,'[)') with &&)
 where (status in ('scheduled','completed') and scheduled_start_at is not null and scheduled_end_at is not null);
create function coaching_internal.slot_available(cid uuid, starts timestamptz, ends timestamptz, ignore_session uuid default null) returns boolean language plpgsql stable security definer set search_path=public as $$
declare valid boolean; begin
 if starts is null or ends is null or ends<=starts or ends-starts>interval '8 hours' then return false; end if;
 if exists(select 1 from coaching_sessions s where coach_id=cid and id is distinct from ignore_session and status in ('scheduled','completed') and tstzrange(scheduled_start_at,scheduled_end_at,'[)') && tstzrange(starts,ends,'[)') and scheduled_start_at is not null and scheduled_end_at is not null) then return false; end if;
 if exists(select 1 from coach_availability_exceptions x where x.coach_id=cid and x.exception_type='unavailable' and tstzrange((x.exception_date+coalesce(x.start_time,'00:00'::time)) at time zone x.timezone,(case when x.end_time is null then x.exception_date+1 else x.exception_date end+coalesce(x.end_time,'00:00'::time)) at time zone x.timezone,'[)') && tstzrange(starts,ends,'[)')) then return false; end if;
 select exists(select 1 from coach_availability_exceptions x where x.coach_id=cid and exception_type='custom_availability' and starts>=(exception_date+start_time) at time zone timezone and ends<=(exception_date+end_time) at time zone timezone)
 or exists(select 1 from coach_availability_rules a where a.coach_id=cid and a.active and extract(dow from starts at time zone a.timezone)=a.day_of_week and (starts at time zone a.timezone)::date>=a.effective_start_date and (a.effective_end_date is null or (starts at time zone a.timezone)::date<=a.effective_end_date) and starts>=((starts at time zone a.timezone)::date+a.start_time) at time zone a.timezone and ends<=((starts at time zone a.timezone)::date+a.end_time) at time zone a.timezone) into valid;
 return valid;
end $$;
create function public.coaching_available_slots(cid uuid, day date, minutes integer default 60, request_id uuid default null, engagement_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare allowed boolean; result jsonb; begin
 if not coaching_identity_enabled() then raise exception 'Not authorized'; end if;
 if exists(select 1 from coach_profiles where user_id=auth.uid() and id<>cid) then raise exception 'Another coach availability is private'; end if;
 select coaching_internal.owner(cid) or exists(select 1 from coach_requests r where r.id=request_id and coaching_enabled(r.organization_id) and (coaching_admin(r.organization_id) or coaching_internal.request_client(r.id))) or exists(select 1 from coaching_engagements e where e.id=engagement_id and e.coach_id=cid and e.status='active' and coaching_enabled(e.organization_id) and (coaching_admin(e.organization_id) or coaching_is_client(e.id))) into allowed;
 if not coaching_internal.owner(cid) and not exists(select 1 from coach_profiles where id=cid and profile_status='approved') then raise exception 'Coach profile unavailable';end if;
 if not allowed then raise exception 'Active Coaching and an authorized workflow are required'; end if;
 if minutes not between 15 and 480 or day<current_date or day>current_date+366 then raise exception 'Invalid duration or date'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('start',t,'end',t+make_interval(mins=>minutes),'coach_timezone',c.timezone) order by t),'[]') into result
 from coach_profiles c cross join lateral generate_series(day::timestamp at time zone c.timezone,(day+1)::timestamp at time zone c.timezone-interval '15 minutes',interval '15 minutes') t
 where c.id=cid and t>now() and coaching_internal.slot_available(cid,t,t+make_interval(mins=>minutes));
 return result;
end $$;
create function coaching_internal.activation_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='active' and new.consent_policy_version=2 then
 if not exists(select 1 from coach_requests r join coaching_invitations i on i.id=r.selected_invitation_id where r.id=new.coach_request_id and r.leader_accepted_at is not null and i.status='converted' and i.coach_id=new.coach_id) then raise exception 'Coach interest and leader acceptance are required'; end if;
 if exists(select 1 from unnest(array['coaching_record_retention','credential_verification','development_data_access','organization_reporting']) k where not coaching_has_consent(new.id,k)) then raise exception 'Engagement Pending Consent'; end if;
 if new.start_date is null or new.planned_end_date is null or new.planned_sessions is null or new.planned_hours is null then raise exception 'Complete the engagement structure'; end if;
 end if; return new;
end $$;
create trigger coaching_sprint2_activation before insert or update on public.coaching_engagements for each row execute function coaching_internal.activation_guard();
create function public.coaching_request_context(leader uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p profiles; c candidates; begin
 select * into p from profiles where auth_user_id=leader and deleted_at is null;
 if p.id is null or not coaching_admin(p.organization_id) or not coaching_enabled(p.organization_id) then raise exception 'Active Coaching and administrator access required'; end if;
 select ca.* into c from organization_users ou join candidates ca on ca.id=ou.candidate_id where ou.profile_id=p.id and ou.organization_id=p.organization_id and ou.deleted_at is null limit 1;
 return jsonb_build_object('leader',p.full_name,'candidate_id',c.id,'current_role',c.current_title,'target_role_id',c.target_role_id,
 'target_role',(select title from roles where id=c.target_role_id),'competencies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from role_competencies where role_id=c.target_role_id and organization_id=p.organization_id),
 'development_records',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',experience_title,'status',status)),'[]') from development_records where candidate_id=c.id and organization_id=p.organization_id));
end $$;
create function public.coaching_workflow_requests() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(case when coaching_admin(r.organization_id) then to_jsonb(r)||jsonb_build_object('leader_name',p.full_name,'coach_name',c.display_name) else
 jsonb_build_object('id',r.id,'status',r.status,'request_title','Coaching for your development','selected_invitation_id',r.selected_invitation_id,'requested_for_user_id',r.requested_for_user_id,'coach_id',r.coach_id,'coach_name',c.display_name,'leader_accepted_at',r.leader_accepted_at) end order by r.created_at desc),'[]')
 from coach_requests r left join profiles p on p.auth_user_id=r.requested_for_user_id left join coach_profiles c on c.id=r.coach_id
 where coaching_identity_enabled() and (coaching_admin(r.organization_id) or coaching_internal.request_client(r.id))
$$;
create function public.coaching_opportunities() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'request_id',r.id,'coach_id',i.coach_id,'coach_name',c.display_name,
 'organization',o.name,'industry',o.industry,'leadership_level',l.name,'objectives',r.objectives,
 'specialties',(select coalesce(jsonb_agg(name),'[]') from coaching_specialties where id=any(r.specialty_ids)),
 'preferred_start_date',r.preferred_start_date,'duration_months',r.desired_duration_months,'estimated_sessions',r.estimated_sessions,'format',r.preferred_format,'timezone',r.timezone,
 'status',case when i.status in ('pending','viewed') and i.expires_at<=now() then 'expired' else i.status end,'expires_at',i.expires_at,
 'response_message',case when coaching_internal.owner(i.coach_id) or coaching_admin(i.organization_id) then i.response_message else null end,
 'admin_question',case when coaching_internal.owner(i.coach_id) or coaching_platform_admin() then i.admin_question else null end,
 'match_reasons',(select m.match_reasons from coaching_match_results m where m.coach_request_id=r.id and m.coach_id=i.coach_id order by m.created_at desc limit 1)
 ) order by i.created_at desc),'[]') from coaching_invitations i join coach_requests r on r.id=i.coach_request_id join organizations o on o.id=i.organization_id join coach_profiles c on c.id=i.coach_id left join leadership_levels l on l.id=r.preferred_leadership_level_id
 where coaching_identity_enabled() and (coaching_internal.owner(i.coach_id) or coaching_admin(i.organization_id) or (coaching_internal.request_client(r.id) and i.status in ('interested','converted')))
$$;
create function public.coaching_run_matching(rid uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r coach_requests; c coach_profiles; run uuid:=gen_random_uuid(); factor record; fraction numeric; factors jsonb; reasons jsonb; unmet jsonb; score numeric; label text;
begin
 select * into r from coach_requests where id=rid for update;
 if r.id is null or not coaching_admin(r.organization_id) or not coaching_enabled(r.organization_id) or r.status in ('draft','engagement_setup','converted_to_engagement','cancelled','closed') then raise exception 'Request is not available for matching'; end if;
 if (select sum(weight) from coaching_match_weights where active)<>100 then raise exception 'Matching weights must total 100'; end if;
 for c in select * from coach_profiles where coaching_internal.eligible(id) loop
 factors:='{}';reasons:='[]';unmet:='[]';score:=0;
 for factor in select * from coaching_match_weights where active order by factor_key loop
 fraction:=1;label:=factor.factor_key;
 case factor.factor_key
 when 'specialty' then
 if cardinality(r.specialty_ids)>0 then select count(*)::numeric/cardinality(r.specialty_ids) into fraction from coach_specialties where coach_id=c.id and specialty_id=any(r.specialty_ids);label:='Requested coaching specialties'; else label:='Specialty: no preference'; end if;
 when 'competency' then
 if cardinality(r.competency_ids)>0 then select count(*)::numeric/cardinality(r.competency_ids) into fraction from role_competencies rc where rc.id=any(r.competency_ids) and exists(select 1 from coach_specialties j join coaching_specialties s on s.id=j.specialty_id where j.coach_id=c.id and lower(trim(s.name))=lower(trim(rc.name)));label:='Competency names matched to listed specialties'; else label:='Competency: no preference'; end if;
 when 'industry' then if r.preferred_industry_id is not null then fraction:=case when exists(select 1 from coach_industries where coach_id=c.id and industry_id=r.preferred_industry_id) then 1 else 0 end;label:='Preferred industry experience';else label:='Industry: no preference';end if;
 when 'leadership_level' then if r.preferred_leadership_level_id is not null then fraction:=case when exists(select 1 from coach_leadership_levels where coach_id=c.id and leadership_level_id=r.preferred_leadership_level_id) then 1 else 0 end;label:='Preferred leadership level';else label:='Leadership level: no preference';end if;
 when 'credential' then if r.preferred_credential is not null then fraction:=case when array_position(array['none','acc','pcc','mcc'],c.icf_credential)>=array_position(array['none','acc','pcc','mcc'],r.preferred_credential) or c.icf_credential=r.preferred_credential then 1 else 0 end;if c.icf_credential_expiration_date<current_date then fraction:=0;end if;label:='Current preferred credential or higher';else label:='Credential: no preference';end if;
 when 'format' then if r.preferred_format is not null then fraction:=case when (r.preferred_format in ('video','phone') and c.virtual_available) or (r.preferred_format='in_person' and c.in_person_available) then 1 else 0 end;label:='Preferred coaching format';else label:='Format: no preference';end if;
 when 'availability' then fraction:=case when c.availability_status='available' then 1 else .5 end;label:='Coach reports availability; dates still require confirmation';
 when 'geography' then
 if r.timezone is not null or r.location_preference is not null or r.language is not null then fraction:=case when (r.timezone is null or r.timezone=c.timezone) and (r.location_preference is null or lower(r.location_preference) in (lower(c.city),lower(c.country),lower(c.state_region))) and (r.language is null or exists(select 1 from unnest(c.languages) v where lower(v)=lower(r.language))) then 1 else 0 end;label:='Time zone, location and language preferences';else label:='Location/time zone/language: no preference';end if;
 end case;
 score:=score+factor.weight*fraction;
 factors:=factors||jsonb_build_object(factor.factor_key,jsonb_build_object('weight',factor.weight,'fraction',fraction,'points',factor.weight*fraction));
 if fraction>0 then reasons:=reasons||to_jsonb(label);end if;
 if fraction<1 then unmet:=unmet||to_jsonb(label||' not fully met');end if;
 end loop;
 insert into coaching_match_results(coach_request_id,coach_id,run_id,match_score,factor_scores,match_reasons,unmet_preferences) values(rid,c.id,run,score,factors,reasons,unmet);
 end loop;
 update coach_requests set matching_run_id=run,status='reviewing_matches' where id=rid;
 insert into platform_audit_events(actor_profile_id,organization_id,event_type,details) values((select id from profiles where auth_user_id=auth.uid()),r.organization_id,'coaching.match_generated',jsonb_build_object('request_id',rid,'run_id',run,'version','rules-v1'));
 return run;
end $$;
create function public.coaching_workflow_matches(rid uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if not coaching_internal.request_admin(rid) then raise exception 'Not authorized';end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('display_name',c.display_name,'headline',c.headline,'icf_credential',c.icf_credential,'years_coaching',c.years_coaching,'years_leadership_experience',c.years_leadership_experience,'availability_status',c.availability_status,'virtual_available',c.virtual_available,'in_person_available',c.in_person_available) order by match_score desc),'[]') into result
 from (select distinct on (coach_id) * from coaching_match_results where coach_request_id=rid and run_id=(select matching_run_id from coach_requests where id=rid) order by coach_id,created_at desc) m join coach_profiles c on c.id=m.coach_id where not m.excluded and c.profile_status='approved';
 return result;
end $$;
-- Keep the tested Sprint 1 implementation as an internal compatibility path.
alter function public.coaching_mutate(text,jsonb) rename to coaching_mutate_sprint1;
revoke all on function public.coaching_mutate_sprint1(text,jsonb) from public,anon,authenticated;
create function public.coaching_mutate(operation text,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); org uuid:=current_profile_organization_id(); rid uuid:=nullif(payload->>'request_id','')::uuid; eid uuid:=nullif(payload->>'engagement_id','')::uuid; item uuid:=nullif(payload->>'id','')::uuid; cid uuid;
 r coach_requests;i coaching_invitations;e coaching_engagements;s coaching_sessions;change coaching_session_changes;result uuid;stamp timestamptz:=clock_timestamp();context jsonb;ids uuid[];k text;decision text;starts timestamptz;ends timestamptz;zone text;recipient uuid;ev text;override_capacity boolean:=false;
begin
 if not coaching_identity_enabled() then raise exception 'An active account is required';end if;
 for k in select key from jsonb_each(payload) where key in ('scheduled_start_at','scheduled_end_at','actual_start_at','actual_end_at','requested_start_at','requested_end_at') loop
 if nullif(payload->>k,'') is not null and (payload->>k)!~'(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Timestamp % must include an explicit UTC offset or Z',k;end if;
 end loop;
 if operation='request_coach' then
 return coaching_mutate('request_save',payload||jsonb_build_object('requested_for_user_id',payload->>'requested_for_user_id','request_title','Leadership coaching','submit','true'));
 elsif operation='request_save' then
 if item is not null then select * into r from coach_requests where id=item for update;org:=r.organization_id;end if;
 if not coaching_admin(org) or not coaching_enabled(org) then raise exception 'Unlock Coaching to begin working with a coach.';end if;
 if item is not null and (r.id is null or r.status not in ('draft','submitted','matching','reviewing_matches','coach_declined')) then raise exception 'This request can no longer be edited';end if;
 context:=coaching_request_context((payload->>'requested_for_user_id')::uuid);
 if not exists(select 1 from profiles where auth_user_id=(payload->>'requested_for_user_id')::uuid and organization_id=org) then raise exception 'Invalid leader';end if;
 zone:=nullif(payload->>'timezone','');if zone is not null and not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Unknown time zone';end if;
 if nullif(trim(payload->>'request_title'),'') is null then raise exception 'Request title required';end if;
 if item is null then insert into coach_requests(organization_id,requested_by,workflow_version,status) values(org,actor,2,'draft') returning id into item;end if;
 if jsonb_array_length(coalesce(payload->'competency_ids','[]'))>0 and not coalesce(payload->'context_categories','[]') ? 'competencies' then raise exception 'Select target-role competencies as a matching category';end if;
 ids:=array(select value::uuid from jsonb_array_elements_text(coalesce(payload->'competency_ids','[]')));
 if exists(select 1 from unnest(ids) v where not exists(select 1 from jsonb_array_elements(context->'competencies') c where c->>'id'=v::text)) then raise exception 'Competency does not belong to the selected leader target role';end if;
 if coalesce(payload->'context_categories','[]') ? 'development_plan' then
 ids:=array(select distinct v from (select unnest(ids) v union select rc.id from role_competencies rc join development_record_competencies dc on lower(dc.competency_name)=lower(rc.name) join development_records d on d.id=dc.development_record_id where d.candidate_id=(context->>'candidate_id')::uuid and d.organization_id=org and rc.role_id=(context->>'target_role_id')::uuid and rc.organization_id=org) q);
 end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(payload->'specialty_ids','[]')) v where not exists(select 1 from coaching_specialties where id=v::uuid and active)) then raise exception 'Invalid specialty';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(payload->'objectives','[]')) v where v not in ('Prepare for Future Leadership Role','Executive Transition','New Executive Onboarding','Improve Leadership Effectiveness','Communication','Strategic Leadership','Financial Leadership','Team Leadership','Conflict Management','Change Leadership','Performance Improvement','Career Development','Succession Readiness','Other')) then raise exception 'Select a listed coaching objective';end if;
 update coach_requests set requested_for_user_id=(payload->>'requested_for_user_id')::uuid,candidate_id=nullif(context->>'candidate_id','')::uuid,target_role_id=nullif(context->>'target_role_id','')::uuid,
 request_title=payload->>'request_title',request_reason=payload->>'request_reason',development_focus=payload->>'development_focus',objectives=array(select jsonb_array_elements_text(coalesce(payload->'objectives','[]'))),context_categories=array(select jsonb_array_elements_text(coalesce(payload->'context_categories','[]'))),competency_ids=ids,
 specialty_ids=array(select value::uuid from jsonb_array_elements_text(coalesce(payload->'specialty_ids','[]'))),preferred_industry_id=nullif(payload->>'preferred_industry_id','')::uuid,preferred_leadership_level_id=nullif(payload->>'preferred_leadership_level_id','')::uuid,
 preferred_credential=nullif(payload->>'preferred_credential',''),preferred_format=nullif(payload->>'preferred_format',''),location_preference=nullif(payload->>'location_preference',''),timezone=zone,language=nullif(payload->>'language',''),preferred_start_date=nullif(payload->>'preferred_start_date','')::date,
 desired_duration_months=nullif(payload->>'desired_duration_months','')::integer,estimated_sessions=nullif(payload->>'estimated_sessions','')::integer,
 status=case when payload->>'submit'='true' then 'submitted' else 'draft' end,submitted_at=case when payload->>'submit'='true' then stamp else null end,matching_run_id=null where id=item returning id into result;
 if payload->>'submit'='true' then perform coaching_internal.notify(result,'coaching_request_submitted',result);end if;
 elsif operation='match' then result:=coaching_run_matching(rid);
 elsif operation='weights' then
 if not coaching_platform_admin() then raise exception 'Platform administrator required';end if;
 if (select count(*) from jsonb_each(payload->'weights'))<>8 or exists(select 1 from jsonb_each_text(payload->'weights') x where not exists(select 1 from coaching_match_weights where factor_key=x.key) or x.value::numeric<0) or (select sum(value::numeric) from jsonb_each_text(payload->'weights'))<>100 then raise exception 'All eight weights must total 100';end if;
 perform 1 from coaching_match_weights order by factor_key for update;
 update coaching_match_weights w set weight=x.value::numeric,updated_by=actor,updated_at=stamp from jsonb_each_text(payload->'weights') x where w.factor_key=x.key;result:=gen_random_uuid();
 elsif operation in ('invite','recommendation','request_status') then
 select * into r from coach_requests where id=rid for update;
 if r.id is null or not coaching_admin(r.organization_id) or not coaching_enabled(r.organization_id) then raise exception 'Not authorized';end if;
 if operation='request_status' then
 if payload->>'status' not in ('matching','cancelled','closed') or r.status='converted_to_engagement' then raise exception 'Invalid request transition';end if;
 update coach_requests set status=payload->>'status',selected_invitation_id=null,leader_accepted_at=null where id=rid;
 update coaching_invitations set status='withdrawn',updated_at=stamp where coach_request_id=rid and status in ('pending','viewed','interested','converted');result:=rid;
 else
 if r.status in ('draft','engagement_setup','converted_to_engagement','cancelled','closed') then raise exception 'Request is not accepting invitations';end if;
 cid:=(payload->>'coach_id')::uuid;
 override_capacity:=coalesce((payload->>'capacity_override')::boolean,false);
 if (override_capacity or operation='recommendation') and (not coaching_platform_admin() or nullif(trim(payload->>'admin_reason'),'') is null) then raise exception 'Platform administrator and an intervention reason required';end if;
 if operation='recommendation' then
 if r.matching_run_id is null then raise exception 'Generate matches first';end if;
 if not exists(select 1 from coach_profiles where id=cid and profile_status='approved') then raise exception 'Approved coach required';end if;
 insert into coaching_match_results(coach_request_id,coach_id,run_id,match_score,factor_scores,match_reasons,unmet_preferences,excluded,capacity_override,admin_reason,matching_version)
 select rid,cid,r.matching_run_id,coalesce((select match_score from coaching_match_results where coach_request_id=rid and coach_id=cid order by created_at desc limit 1),0),'{}','["Platform administrator recommendation"]','[]',coalesce((payload->>'excluded')::boolean,false),override_capacity,payload->>'admin_reason','admin-v1' returning id into result;
 else
 perform 1 from coach_profiles where id=cid for update;
 if not coaching_internal.eligible(cid,override_capacity) then raise exception 'Coach is unavailable or at capacity';end if;
 update coaching_invitations set status='expired',updated_at=stamp where coach_request_id=rid and coach_id=cid and status in ('pending','viewed') and expires_at<=stamp;
 insert into coaching_invitations(coach_request_id,organization_id,coach_id,requested_for_user_id,invited_by,message,capacity_override) values(rid,r.organization_id,cid,r.requested_for_user_id,actor,payload->>'message',override_capacity) returning id into result;
 update coach_requests set status='coach_invited' where id=rid;
 perform coaching_internal.notify(rid,'coach_invitation_received',result,array[(select user_id from coach_profiles where id=cid)]);
 end if;end if;
 elsif operation in ('invitation_response','withdraw_invitation','leader_decision','intro') then
 select * into i from coaching_invitations where id=item;
 select * into r from coach_requests where id=i.coach_request_id for update;
 select * into i from coaching_invitations where id=item for update;
 rid:=r.id;
 if i.id is null then raise exception 'Invitation not found';end if;
 if operation='withdraw_invitation' then
 if not coaching_admin(i.organization_id) or i.status='converted' then raise exception 'Not authorized';end if;
 update coaching_invitations set status='withdrawn',updated_at=stamp where id=item;result:=item;
 elsif operation='invitation_response' then
 if not coaching_internal.owner(i.coach_id) or not exists(select 1 from coach_profiles where id=i.coach_id and profile_status='approved') or not coaching_enabled(i.organization_id) or r.status in ('engagement_setup','converted_to_engagement','cancelled','closed') or i.status not in ('pending','viewed','interested') or i.expires_at<=stamp then raise exception 'Opportunity is no longer available';end if;
 decision:=payload->>'decision';
 if decision='question' then update coaching_invitations set admin_question=payload->>'response_message',updated_at=stamp where id=item;
 elsif decision in ('viewed','interested','declined') then
 if i.status='interested' and decision='viewed' then raise exception 'Already interested';end if;
 update coaching_invitations set status=decision,responded_at=case when decision='viewed' then responded_at else stamp end,response_message=payload->>'response_message',decline_reason=payload->>'decline_reason',updated_at=stamp where id=item;
 if decision='interested' then update coach_requests set status='leader_review' where id=rid;
 elsif decision='declined' and not exists(select 1 from coaching_invitations where coach_request_id=rid and status='interested') then update coach_requests set status='reviewing_matches' where id=rid;end if;
 else raise exception 'Invalid response';end if;
 result:=item;
 perform coaching_internal.notify(rid,'coach_'||decision,result,case when decision='interested' then array[r.requested_for_user_id] else '{}'::uuid[] end);
 elsif operation='leader_decision' then
 if r.requested_for_user_id<>actor or r.status<>'leader_review' or i.status<>'interested' or not coaching_enabled(r.organization_id) then raise exception 'Leader review not available';end if;
 if payload->>'decision'='accept' then
 update coach_requests set selected_invitation_id=i.id,coach_id=i.coach_id,leader_accepted_at=stamp,status='engagement_setup' where id=rid;
 update coaching_invitations set status=case when id=i.id then 'converted' else 'withdrawn' end,updated_at=stamp where coach_request_id=rid and status in ('pending','viewed','interested');
 perform coaching_internal.notify(rid,'leader_accepted_coach',item,array[(select user_id from coach_profiles where id=i.coach_id)]);
 elsif payload->>'decision'='another' then update coaching_invitations set status='withdrawn',updated_at=stamp where id=item;update coach_requests set status='reviewing_matches' where id=rid;
 else raise exception 'Invalid leader decision';end if;result:=item;
 else
 if i.status not in ('interested','converted') or not coaching_enabled(r.organization_id) or not (r.requested_for_user_id=actor or coaching_internal.owner(i.coach_id) or coaching_admin(i.organization_id)) then raise exception 'Not authorized';end if;
 if actor<>r.requested_for_user_id and r.leader_accepted_at is null and not exists(select 1 from coaching_intro_meetings where coach_request_id=rid and coach_id=i.coach_id) then raise exception 'The leader must request an introduction before meeting coordination';end if;
 decision:=coalesce(payload->>'status','requested');
 if decision='requested' and exists(select 1 from coaching_intro_meetings where coach_request_id=rid and coach_id=i.coach_id and status in ('scheduled','completed')) then raise exception 'Introduction already arranged';end if;
 if decision='scheduled' and not (coaching_internal.owner(i.coach_id) or coaching_admin(i.organization_id)) then raise exception 'Coach or administrator must confirm the meeting';end if;
 starts:=nullif(payload->>'scheduled_start_at','')::timestamptz;ends:=nullif(payload->>'scheduled_end_at','')::timestamptz;
 insert into coaching_intro_meetings(coach_request_id,coach_id,coachee_user_id,scheduled_start_at,scheduled_end_at,format,location_or_link,status) values(rid,i.coach_id,r.requested_for_user_id,starts,ends,coalesce(payload->>'format','video'),payload->>'location_or_link',decision) on conflict(coach_request_id,coach_id) do update set scheduled_start_at=excluded.scheduled_start_at,scheduled_end_at=excluded.scheduled_end_at,format=excluded.format,location_or_link=excluded.location_or_link,status=excluded.status,updated_at=stamp returning id into result;
 perform coaching_internal.notify(rid,'intro_meeting_'||decision,result,array[r.requested_for_user_id,(select user_id from coach_profiles where id=i.coach_id)]);
 end if;
 elsif operation='setup_engagement' then
 select * into r from coach_requests where id=rid for update;
 if r.id is null or not coaching_admin(r.organization_id) or not coaching_enabled(r.organization_id) or r.status<>'engagement_setup' or r.leader_accepted_at is null then raise exception 'Leader acceptance and active Coaching are required';end if;
 result:=coaching_mutate_sprint1('create_engagement',payload||jsonb_build_object('id',rid,'coachee_user_id',r.requested_for_user_id,'title',coalesce(payload->>'title',r.request_title)));
 update coaching_engagements set consent_policy_version=2,organization_objectives=payload->>'organization_objectives',planned_end_date=(payload->>'planned_end_date')::date,planned_sessions=(payload->>'planned_sessions')::integer,planned_hours=(payload->>'planned_hours')::numeric where id=result;
 eid:=result;
 perform coaching_internal.notify(rid,'consent_required',result,array[r.requested_for_user_id,(select user_id from coach_profiles where id=r.coach_id)]);
 elsif operation in ('availability_rule','availability_exception','availability_remove') then
 cid:=(payload->>'coach_id')::uuid;
 if not coaching_internal.owner(cid) then raise exception 'Coach can manage only their own availability';end if;
 perform 1 from coach_profiles where id=cid for update;
 zone:=coalesce(nullif(payload->>'timezone',''),(select timezone from coach_profiles where id=cid));
 if not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'Unknown time zone';end if;
 if operation='availability_rule' then
 insert into coach_availability_rules(coach_id,day_of_week,start_time,end_time,timezone,effective_start_date,effective_end_date) values(cid,(payload->>'day_of_week')::integer,(payload->>'start_time')::time,(payload->>'end_time')::time,zone,coalesce(nullif(payload->>'effective_start_date','')::date,current_date),nullif(payload->>'effective_end_date','')::date) returning id into result;
 elsif operation='availability_exception' then
 insert into coach_availability_exceptions(coach_id,exception_date,start_time,end_time,timezone,exception_type,notes) values(cid,(payload->>'exception_date')::date,nullif(payload->>'start_time','')::time,nullif(payload->>'end_time','')::time,zone,payload->>'exception_type',payload->>'notes') returning id into result;
 else
 if payload->>'kind'='rule' then update coach_availability_rules set active=false,updated_at=stamp where id=item and coach_id=cid returning id into result;
 else delete from coach_availability_exceptions where id=item and coach_id=cid returning id into result;end if;
 end if;
 elsif operation in ('schedule_session','session_change','resolve_session_change') then
 if operation='schedule_session' then select * into e from coaching_engagements where id=eid for update;
 else select * into s from coaching_sessions where id=case when operation='session_change' then item else (select session_id from coaching_session_changes where id=item) end;select * into e from coaching_engagements where id=s.engagement_id for update;eid:=e.id;end if;
 if e.id is null or e.status<>'active' or not exists(select 1 from coach_profiles where id=e.coach_id and profile_status='approved') or not coaching_enabled(e.organization_id) or not (coaching_is_coach(eid) or coaching_is_client(eid)) then raise exception 'Active engagement and participant access required';end if;
 if operation='schedule_session' then
 starts:=(payload->>'scheduled_start_at')::timestamptz;ends:=(payload->>'scheduled_end_at')::timestamptz;
 perform 1 from coach_profiles where id=e.coach_id for update;
 if starts<=stamp or not coaching_internal.slot_available(e.coach_id,starts,ends) then raise exception 'Selected time is unavailable';end if;
 insert into coaching_sessions(engagement_id,coach_id,coachee_user_id,session_date,scheduled_start_at,scheduled_end_at,session_format,coaching_category,compensation_category,status)
 values(eid,e.coach_id,e.coachee_user_id,(starts at time zone (select timezone from coach_profiles where id=e.coach_id))::date,starts,ends,coalesce(payload->>'session_format','video'),'individual',case when e.funding_type='pro_bono' then 'pro_bono' else 'paid' end,'scheduled') returning id into result;
 ev:='session_scheduled';
 elsif operation='session_change' then
 if s.status<>'scheduled' then raise exception 'Only scheduled sessions can be changed';end if;
 insert into coaching_session_changes(session_id,requested_by,change_type,original_start_at,requested_start_at,requested_end_at,reason) values(s.id,actor,payload->>'change_type',s.scheduled_start_at,nullif(payload->>'requested_start_at','')::timestamptz,nullif(payload->>'requested_end_at','')::timestamptz,payload->>'reason') returning id into result;ev:='session_change_requested';
 else
 if not coaching_is_coach(eid) then raise exception 'Coach must resolve session changes';end if;
 select * into change from coaching_session_changes where id=item for update;
 select * into s from coaching_sessions where id=change.session_id for update;
 if change.status<>'pending' or s.status<>'scheduled' or s.scheduled_start_at is distinct from change.original_start_at then raise exception 'Session change is no longer current';end if;
 if payload->>'decision'='approve' then
 if change.change_type='reschedule' then
 perform 1 from coach_profiles where id=e.coach_id for update;
 if change.requested_start_at<=stamp or not coaching_internal.slot_available(e.coach_id,change.requested_start_at,change.requested_end_at,s.id) then raise exception 'Requested time unavailable';end if;
 update coaching_sessions set scheduled_start_at=change.requested_start_at,scheduled_end_at=change.requested_end_at,session_date=(change.requested_start_at at time zone (select timezone from coach_profiles where id=e.coach_id))::date,coachee_confirmed=false,coach_confirmed=false where id=s.id;ev:='session_rescheduled';
 else update coaching_sessions set status='cancelled' where id=s.id;ev:='session_cancelled';end if;
 update coaching_session_changes set status='completed',resolved_at=stamp where id=item;
 else update coaching_session_changes set status='declined',resolved_at=stamp where id=item;ev:='session_change_declined';end if;result:=item;
 end if;
 perform coaching_internal.notify(e.coach_request_id,ev,result,array[e.coachee_user_id,(select user_id from coach_profiles where id=e.coach_id)]);
 elsif operation in ('closeout','extend_engagement') then
 select * into e from coaching_engagements where id=eid for update;
 if e.id is null then raise exception 'Engagement not found';end if;
 if operation='extend_engagement' then
 if not coaching_admin(e.organization_id) or not coaching_enabled(e.organization_id) or e.status not in ('active','paused') then raise exception 'Not authorized';end if;
 if (payload->>'planned_end_date')::date<=e.planned_end_date or (payload->>'planned_sessions')::integer<e.planned_sessions or (payload->>'planned_hours')::numeric<e.planned_hours then raise exception 'Extension must increase the end date and cannot reduce the plan';end if;
 insert into platform_audit_events(actor_profile_id,organization_id,event_type,details) values((select id from profiles where auth_user_id=actor),e.organization_id,'coaching.extension_before',jsonb_build_object('engagement_id',eid,'end_date',e.planned_end_date,'sessions',e.planned_sessions,'hours',e.planned_hours));
 update coaching_engagements set planned_end_date=(payload->>'planned_end_date')::date,planned_sessions=(payload->>'planned_sessions')::integer,planned_hours=(payload->>'planned_hours')::numeric where id=eid;result:=eid;
 else
 if not coaching_can_read(eid,'organization_shared') or (e.planned_end_date is null or e.planned_end_date>current_date+30) then raise exception 'Closeout is available within 30 days of the planned end, with sharing consent';end if;
 insert into coaching_engagement_closeouts(engagement_id) values(eid) on conflict do nothing;
 if coaching_is_coach(eid) then update coaching_engagement_closeouts set coach_shared_summary=payload->>'summary',coach_completed_at=stamp,additional_coaching_recommended=coalesce((payload->>'continue_recommended')::boolean,false) where engagement_id=eid;
 elsif coaching_is_client(eid) then update coaching_engagement_closeouts set coachee_shared_reflection=payload->>'summary',coachee_completed_at=stamp,continue_recommended=coalesce((payload->>'continue_recommended')::boolean,false) where engagement_id=eid;
 elsif coaching_admin(e.organization_id) then update coaching_engagement_closeouts set organization_outcome_notes=payload->>'summary',organization_completed_at=stamp where engagement_id=eid;else raise exception 'Not authorized';end if;
 if nullif(payload->>'final_status','') is not null then
 if not coaching_admin(e.organization_id) then raise exception 'Organization administrator must finalize closeout';end if;
 if not exists(select 1 from coaching_engagement_closeouts where engagement_id=eid and coach_completed_at is not null and coachee_completed_at is not null and organization_completed_at is not null) then raise exception 'All three parties must complete closeout';end if;
 update coaching_engagement_closeouts set final_status=payload->>'final_status' where engagement_id=eid;
 update coaching_engagements set status=case when payload->>'final_status' in ('extended','renewed') then 'paused' when payload->>'final_status'='terminated' then 'cancelled' else 'completed' end,actual_end_date=case when payload->>'final_status' in ('completed','terminated') then current_date else null end where id=eid;
 end if;
 select id into result from coaching_engagement_closeouts where engagement_id=eid;
 end if;
 elsif operation='notification_read' then update notifications set read_at=stamp where id=item and recipient_user_id=actor returning id into result;
 else
 -- Prevent the Sprint 1 fast path from bypassing Sprint 2 acceptance and scheduling.
 if operation='create_engagement' and exists(select 1 from coach_requests where id=item and workflow_version=2) then raise exception 'Use engagement setup after leader acceptance';end if;
 if operation='session' and payload->>'status'='scheduled' then return coaching_mutate('schedule_session',payload);end if;
 if operation='engagement_status' and payload->>'status'='active' then
 select * into e from coaching_engagements where id=eid;perform 1 from coach_profiles where id=e.coach_id for update;
 if e.status<>'active' and not coaching_internal.eligible(e.coach_id,exists(select 1 from coaching_invitations where id=(select selected_invitation_id from coach_requests where id=e.coach_request_id) and capacity_override)) then raise exception 'Coach unavailable or at capacity';end if;
 end if;
 result:=coaching_mutate_sprint1(operation,payload);
 if operation='consent' and payload->>'consent_given'='false' and payload->>'consent_type' in ('coaching_record_retention','credential_verification','development_data_access','organization_reporting') then update coaching_engagements set status='paused' where id=eid and status='active' and consent_policy_version=2;end if;
 if operation='engagement_status' and payload->>'status'='active' then
 select * into e from coaching_engagements where id=eid;
 perform coaching_internal.notify(e.coach_request_id,'engagement_activated',eid,array[e.coachee_user_id,(select user_id from coach_profiles where id=e.coach_id)]);
 elsif operation='review_opt_in' and payload->>'decision'='approved' then
 for recipient in select p.auth_user_id from profiles p where p.organization_id=(select organization_id from coaching_opt_in_requests where id=item) and p.role in ('system_admin','hospital_admin') loop insert into notifications(recipient_user_id,event_type,title,href,dedupe_key) values(recipient,'coaching_access_approved','Coaching access approved','/coaching','access:'||item::text) on conflict do nothing;end loop;
 end if;
 return result;
 end if;
 if result is null then raise exception 'No authorized record was changed';end if;
 insert into platform_audit_events(actor_profile_id,organization_id,event_type,details) values((select id from profiles where auth_user_id=actor),coalesce(r.organization_id,e.organization_id,org),'coaching.'||operation,jsonb_build_object('actor_user_id',actor,'request_id',rid,'engagement_id',eid,'record_id',result,'capacity_override',override_capacity,'admin_reason',case when operation in ('invite','recommendation') and coaching_platform_admin() then payload->>'admin_reason' else null end,'planned_end_date',case when operation='extend_engagement' then payload->>'planned_end_date' else null end,'planned_sessions',case when operation='extend_engagement' then payload->>'planned_sessions' else null end,'planned_hours',case when operation='extend_engagement' then payload->>'planned_hours' else null end));
 return result;
end $$;
create function public.coaching_notifications() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not coaching_identity_enabled() then raise exception 'Not authorized';end if;
 insert into notifications(recipient_user_id,event_type,title,href,dedupe_key)
 select auth.uid(),case when s.scheduled_start_at<now() then 'session_log_incomplete' else 'upcoming_session' end,case when s.scheduled_start_at<now() then 'Session log incomplete' else 'Upcoming coaching session' end,'/coaching/clients/'||s.engagement_id||'?tab=Schedule',case when s.scheduled_start_at<now() then 'incomplete:' else 'upcoming:' end||s.id::text||':'||s.scheduled_start_at::text
 from coaching_sessions s where s.status='scheduled' and s.scheduled_start_at<now()+interval '24 hours' and (coaching_is_coach(s.engagement_id) or (coaching_is_client(s.engagement_id) and s.scheduled_start_at>=now())) on conflict do nothing;
 insert into notifications(recipient_user_id,event_type,title,href,dedupe_key)
 select auth.uid(),'action_due','Coaching action due','/coaching/clients/'||a.engagement_id||'?tab=Actions','action:'||a.id::text||':'||a.due_date::text from coaching_actions a where a.due_date<=current_date+1 and a.status not in ('completed','cancelled') and coaching_can_read(a.engagement_id,a.visibility) and (coaching_is_coach(a.engagement_id) or coaching_is_client(a.engagement_id)) on conflict do nothing;
 insert into notifications(recipient_user_id,event_type,title,href,dedupe_key)
 select auth.uid(),'engagement_nearing_completion','Coaching engagement nearing completion','/coaching/clients/'||e.id||'?tab=Closeout','closeout:'||e.id::text||':'||e.planned_end_date::text from coaching_engagements e where status='active' and planned_end_date<=current_date+30 and (coaching_is_coach(e.id) or coaching_is_client(e.id) or coaching_admin(e.organization_id)) on conflict do nothing;
 return (select coalesce(jsonb_agg(to_jsonb(n)-'email_claim_token' order by created_at desc),'[]') from notifications n where recipient_user_id=auth.uid());
end $$;
create function public.coaching_availability_summary(cid uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not coaching_identity_enabled() or (not coaching_internal.owner(cid) and (not coaching_enabled(current_profile_organization_id()) or exists(select 1 from coach_profiles where user_id=auth.uid()))) then raise exception 'Availability details require active Coaching';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('day_of_week',day_of_week,'start_time',start_time,'end_time',end_time,'timezone',timezone,'effective_start_date',effective_start_date,'effective_end_date',effective_end_date)),'[]') from coach_availability_rules where coach_id=cid and active and (effective_end_date is null or effective_end_date>=current_date));
end $$;
create or replace function public.coaching_marketplace() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'display_name',c.display_name,'photo_url',c.photo_url,'headline',c.headline,'short_bio',c.short_bio,'full_bio',c.full_bio,
 'city',c.city,'state_region',c.state_region,'country',c.country,'coaching_philosophy',c.coaching_philosophy,'languages',c.languages,
 'years_coaching',c.years_coaching,'years_leadership_experience',c.years_leadership_experience,'icf_credential',c.icf_credential,
 'credential_expired',c.icf_credential_expiration_date<current_date,'virtual_available',c.virtual_available,'in_person_available',c.in_person_available,
 'approved_at',c.approved_at,
 'availability_status',c.availability_status,
 'specialties',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_specialties j join public.coaching_specialties s on s.id=j.specialty_id where j.coach_id=c.id),
 'industries',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_industries j join public.industries s on s.id=j.industry_id where j.coach_id=c.id),
 'leadership_levels',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_leadership_levels j join public.leadership_levels s on s.id=j.leadership_level_id where j.coach_id=c.id)
 ) order by c.approved_at desc),'[]') from public.coach_profiles c where c.profile_status='approved' and public.coaching_actor() is not null
$$;

create function public.coaching_engagement_progress(eid uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e coaching_engagements;begin
 select * into e from coaching_engagements where id=eid;
 if e.id is null or not (coaching_is_coach(eid) or coaching_is_client(eid) or coaching_admin(e.organization_id)) then raise exception 'Not authorized';end if;
 return jsonb_build_object('Completed Sessions',(select count(*) from coaching_sessions where engagement_id=eid and status='completed'),'Planned Sessions',coalesce(e.planned_sessions,0),'Completed Hours',coaching_hours(eid),'Planned Hours',coalesce(e.planned_hours,0),
 'Active Shared Goals',(select count(*) from coaching_goals where engagement_id=eid and status='active' and visibility<>'coach_private' and coaching_can_read(eid,visibility)),
 'Achieved Shared Goals',(select count(*) from coaching_goals where engagement_id=eid and status='achieved' and visibility<>'coach_private' and coaching_can_read(eid,visibility)),
 'Completed Shared Actions',(select count(*) from coaching_actions where engagement_id=eid and status='completed' and visibility<>'coach_private' and coaching_can_read(eid,visibility)),
 'Days Remaining',greatest(coalesce(e.planned_end_date-current_date,0),0));
end $$;
create function public.coaching_operations_summary() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not coaching_platform_admin() then raise exception 'Platform administrator required';end if;
 return jsonb_build_object('Approved Coaches',(select count(*) from coach_profiles where profile_status='approved'),'Coaches Accepting Clients',(select count(*) from coach_profiles where profile_status='approved' and accepting_clients),'Organizations with Coaching',(select count(*) from organization_features where feature_key='coaching' and status='active' and (expires_at is null or expires_at>now())),'Open Coaching Requests',(select count(*) from coach_requests where status not in ('closed','cancelled','converted_to_engagement')),'Pending Coach Invitations',(select count(*) from coaching_invitations where status in ('pending','viewed') and expires_at>now()),'Active Engagements',(select count(*) from coaching_engagements where status='active'),'Sessions This Month',(select count(*) from coaching_sessions where session_date>=date_trunc('month',current_date)::date and session_date<(date_trunc('month',current_date)+interval '1 month')::date));
end $$;
-- Service-only email outbox: no recipient addresses returned to browser clients.
create function public.coaching_email_claim(actor uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare token uuid:=gen_random_uuid();result jsonb;begin
 with claimed as (select id from notifications where created_by_user_id=actor and email_sent_at is null and (email_attempted_at is null or email_attempted_at<now()-interval '5 minutes') order by created_at for update skip locked limit 30)
 update notifications set email_attempted_at=now(),email_claim_token=token where id in (select id from claimed);
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'claim',token,'title',n.title,'href',n.href,'email',u.email)),'[]') into result from notifications n join auth.users u on u.id=n.recipient_user_id where n.email_claim_token=token and u.email is not null;return result;
end $$;
create function public.coaching_email_complete(notification_id uuid,claim uuid) returns void language sql security definer set search_path=public as $$ update notifications set email_sent_at=now() where id=notification_id and email_claim_token=claim $$;
-- No client can call the compatibility writer directly.
do $$ declare f record;begin
 for f in select oid::regprocedure as signature,proname from pg_proc where pronamespace='public'::regnamespace and proname like 'coaching_%' loop
 execute format('revoke all on function %s from public,anon',f.signature);
 if f.proname not in ('coaching_mutate_sprint1','coaching_email_claim','coaching_email_complete') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='coaching_internal'::regnamespace loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;
end $$;
grant execute on function coaching_internal.owner(uuid),coaching_internal.request_admin(uuid),coaching_internal.request_client(uuid) to authenticated;
revoke all on function public.coaching_email_claim(uuid),public.coaching_email_complete(uuid,uuid) from authenticated;
grant execute on function public.coaching_email_claim(uuid),public.coaching_email_complete(uuid,uuid) to service_role;
commit;
