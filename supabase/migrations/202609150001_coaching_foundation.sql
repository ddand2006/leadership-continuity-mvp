-- Leader Continuity coaching. All mutations use authenticated, validated RPCs.
-- Coach identities are auth users, independent of organization membership.
begin;
create table public.organization_features (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 feature_key text not null, status text not null default 'available' check(status in ('available','trial','active','suspended','expired','disabled')),
 activated_at timestamptz, activated_by uuid, expires_at timestamptz, metadata jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,feature_key)
);
create table public.coach_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id),
 first_name text, last_name text, display_name text not null, email text, phone text, photo_url text,
 headline text, short_bio text, full_bio text, city text, state_region text, country text, timezone text default 'UTC',
 years_coaching integer check(years_coaching>=0), years_leadership_experience integer check(years_leadership_experience>=0),
 coaching_philosophy text, languages text[] not null default '{}',
 icf_credential text not null default 'none' check(icf_credential in ('none','acc','pcc','mcc','other')),
 icf_credential_number text, icf_credential_issue_date date, icf_credential_expiration_date date,
 credential_verification_status text not null default 'unverified' check(credential_verification_status in ('unverified','pending','verified','expired','rejected')),
 virtual_available boolean not null default true, in_person_available boolean not null default false,
 accepting_clients boolean not null default true,
 availability_status text not null default 'available' check(availability_status in ('available','limited','unavailable')),
 max_active_clients integer check(max_active_clients>0),
 profile_status text not null default 'draft' check(profile_status in ('draft','pending_review','approved','suspended','inactive')),
 approved_at timestamptz, approved_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.coaching_specialties (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text, sort_order integer default 0, active boolean not null default true);
create table public.industries (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text, sort_order integer default 0, active boolean not null default true);
create table public.leadership_levels (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, description text, sort_order integer default 0, active boolean not null default true);
create table public.coach_specialties (coach_id uuid references public.coach_profiles(id) on delete cascade, specialty_id uuid references public.coaching_specialties(id), primary_specialty boolean not null default false, primary key(coach_id,specialty_id));
create table public.coach_industries (coach_id uuid references public.coach_profiles(id) on delete cascade, industry_id uuid references public.industries(id), primary_specialty boolean not null default false, primary key(coach_id,industry_id));
create table public.coach_leadership_levels (coach_id uuid references public.coach_profiles(id) on delete cascade, leadership_level_id uuid references public.leadership_levels(id), primary_specialty boolean not null default false, primary key(coach_id,leadership_level_id));
create table public.coaching_opt_in_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), requested_by uuid not null,
 status text not null default 'pending' check(status in ('pending','approved','declined','cancelled')), notes text,
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid
);
create unique index coaching_pending_opt_in on public.coaching_opt_in_requests(organization_id) where status='pending';
create table public.coach_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), coach_id uuid not null references public.coach_profiles(id),
 requested_for_user_id uuid references auth.users(id), requested_by uuid not null, request_reason text, development_focus text,
 status text not null default 'submitted' check(status in ('draft','submitted','under_review','coach_contacted','accepted','declined','cancelled','converted_to_engagement')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.coaching_engagements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), coach_id uuid not null references public.coach_profiles(id),
 coachee_user_id uuid not null references auth.users(id), candidate_id uuid references public.candidates(id),
 coach_request_id uuid unique references public.coach_requests(id),
 engagement_type text not null default 'leadership_development' check(engagement_type in ('executive_coaching','leadership_development','succession_readiness','executive_transition','performance_coaching','career_coaching','onboarding_coaching','custom')),
 title text not null, organization_objectives text, visibility text not null default 'organization_shared' check(visibility='organization_shared'),
 start_date date, planned_end_date date, actual_end_date date, planned_sessions integer check(planned_sessions>0), planned_hours numeric(8,2) check(planned_hours>0),
 funding_type text not null default 'organization_paid' check(funding_type in ('organization_paid','individual_paid','platform_sponsored','pro_bono','other')),
 status text not null default 'requested' check(status in ('requested','coach_invited','coach_accepted','coachee_invited','coachee_accepted','active','paused','completed','cancelled','declined')),
 progress text not null default 'Not Started' check(progress in ('Not Started','In Progress','On Track','Needs Attention','Completed')),
 created_by uuid not null, approved_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(planned_end_date is null or start_date is null or planned_end_date>=start_date)
);
create table public.coaching_consents (
 id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id),
 organization_id uuid not null references public.organizations(id), coach_id uuid not null references public.coach_profiles(id), coachee_user_id uuid not null references auth.users(id),
 consent_type text not null check(consent_type in ('coaching_record_retention','credential_verification','development_data_access','organization_reporting','session_recording','other')),
 consent_version text not null, consent_text text not null, consent_given boolean not null, consent_date timestamptz not null default now(),
 consent_method text not null default 'electronic_attestation' check(consent_method in ('electronic_attestation','electronic_signature','uploaded_document','written','admin_recorded')),
 ip_address text, user_agent text, revoked boolean not null default false, revoked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.coaching_sessions (
 id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id),
 coach_id uuid not null references public.coach_profiles(id), coachee_user_id uuid not null references auth.users(id), session_date date not null,
 scheduled_start_at timestamptz, scheduled_end_at timestamptz, actual_start_at timestamptz, actual_end_at timestamptz,
 duration_minutes numeric(10,2), session_format text not null default 'video' check(session_format in ('video','phone','in_person','other')),
 coaching_category text check(coaching_category in ('individual','group','team')), compensation_category text check(compensation_category in ('paid','pro_bono')),
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','no_show','rescheduled')),
 location_or_platform text, coach_confirmed boolean not null default false, coachee_confirmed boolean not null default false,
 coach_confirmed_at timestamptz, coachee_confirmed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at>scheduled_start_at),
 check(actual_end_at is null or actual_start_at is null or actual_end_at>actual_start_at),
 check(status<>'completed' or (actual_start_at is not null and actual_end_at is not null and duration_minutes>0 and coaching_category is not null and compensation_category is not null))
);
create table public.coaching_notes (id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id), session_id uuid references public.coaching_sessions(id), coach_id uuid not null references public.coach_profiles(id), coachee_user_id uuid not null references auth.users(id), note_type text not null default 'private_coach_note' check(note_type in ('private_coach_note','shared_session_note','client_reflection','organization_update','general')), title text not null, content text not null, visibility text not null default 'coach_private' check(visibility in ('coach_private','coach_client','organization_shared')), created_by uuid not null, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.coaching_goals (id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id), competency_id uuid references public.role_competencies(id), development_plan_item_id uuid references public.development_records(id), readiness_dimension_id uuid, title text not null, description text, baseline_text text, target_text text, status text not null default 'planned' check(status in ('planned','active','achieved','paused','discontinued')), target_date date, completion_date date, visibility text not null default 'coach_client' check(visibility in ('coach_private','coach_client','organization_shared')), created_by uuid not null, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.coaching_actions (id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id), goal_id uuid references public.coaching_goals(id), assigned_by uuid, assigned_to uuid, title text not null, description text, assigned_date date default current_date, due_date date, completed_date date, status text not null default 'assigned' check(status in ('assigned','in_progress','completed','cancelled','overdue')), client_reflection text, coach_feedback text, visibility text not null default 'coach_client' check(visibility in ('coach_private','coach_client','organization_shared')), created_by uuid not null, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.coaching_data_permissions (
 id uuid primary key default gen_random_uuid(), engagement_id uuid not null references public.coaching_engagements(id),
 data_type text not null check(data_type in ('role_composite','competencies','clifton_strengths','assessment','360_review','development_plan','mentor_plan','project','training','readiness')),
 data_id uuid not null, permission_level text not null default 'view' check(permission_level='view'),
 granted_by uuid not null, granted_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index coaching_data_permission_active on public.coaching_data_permissions(engagement_id,data_type,data_id) where revoked_at is null;
-- Never put confidential narrative text into the administrative audit trail.
create function public.coaching_identity_enabled() returns boolean language sql stable security definer set search_path=public as $$
 select public.coaching_preview_allowed() and auth.uid() is not null
 and not exists(select 1 from public.organization_users where auth_user_id=auth.uid() and (status in ('suspended','archived') or deleted_at is not null))
 and not exists(select 1 from public.profiles p join public.organizations o on o.id=p.organization_id where p.auth_user_id=auth.uid() and (p.deleted_at is not null or (o.manual_access_status='payment_hold' and p.role<>'system_admin')))
$$;
create function public.coaching_actor() returns uuid language sql stable security definer set search_path=public as $$
 select auth_user_id from public.profiles where auth_user_id=auth.uid() and public.coaching_identity_enabled() and deleted_at is null limit 1
$$;
create function public.coaching_admin(org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where auth_user_id=auth.uid() and public.coaching_identity_enabled() and deleted_at is null and
 (role='system_admin' or (organization_id=org and role='hospital_admin')))
$$;
create function public.coaching_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where auth_user_id=auth.uid() and public.coaching_identity_enabled() and deleted_at is null and role='system_admin')
$$;
create function public.coaching_enabled(org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_features where organization_id=org and feature_key='coaching' and status='active' and (expires_at is null or expires_at>now()))
$$;
create function public.coaching_is_coach(eid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.coaching_engagements e join public.coach_profiles c on c.id=e.coach_id where e.id=eid and public.coaching_identity_enabled() and c.user_id=auth.uid() and c.profile_status='approved')
$$;
create function public.coaching_is_client(eid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.coaching_engagements where id=eid and public.coaching_identity_enabled() and coachee_user_id=auth.uid())
$$;
create function public.coaching_has_consent(eid uuid, kind text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select consent_given and not revoked from public.coaching_consents where engagement_id=eid and consent_type=kind order by consent_date desc, created_at desc, id desc limit 1),false)
$$;
create function public.coaching_can_read(eid uuid, scope text) returns boolean language sql stable security definer set search_path=public as $$
 select public.coaching_is_coach(eid) or (scope in ('coach_client','organization_shared') and public.coaching_is_client(eid)) or
 (scope='organization_shared' and public.coaching_has_consent(eid,'organization_reporting') and exists(select 1 from public.coaching_engagements where id=eid and public.coaching_admin(organization_id)))
$$;
create function public.coaching_session_duration() returns trigger language plpgsql set search_path=public as $$
begin
 new.duration_minutes:=case when new.status='completed' then round(extract(epoch from(new.actual_end_at-new.actual_start_at))/60,2) else null end;
 return new;
end $$;
create trigger coaching_session_duration before insert or update on public.coaching_sessions for each row execute function public.coaching_session_duration();
create function public.coaching_engagement_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where auth_user_id=new.coachee_user_id and organization_id=new.organization_id and deleted_at is null) then raise exception 'Client must belong to the engagement organization'; end if;
 if new.candidate_id is not null and not exists(select 1 from public.candidates where id=new.candidate_id and organization_id=new.organization_id) then raise exception 'Invalid candidate'; end if;
 if new.status='active' and (not public.coaching_enabled(new.organization_id) or not exists(select 1 from public.coach_profiles where id=new.coach_id and profile_status='approved' and user_id is not null) or not public.coaching_has_consent(new.id,'coaching_record_retention')) then raise exception 'Active Coaching, an approved coach account, and record-retention consent are required'; end if;
 return new;
end $$;
create trigger coaching_engagement_guard before insert or update on public.coaching_engagements for each row execute function public.coaching_engagement_guard();
alter table public.organization_features enable row level security;
revoke all on public.organization_features from anon, authenticated;
grant select on public.organization_features to authenticated;
create policy organization_features_read on public.organization_features for select to authenticated using (public.coaching_identity_enabled() and (organization_id=public.current_profile_organization_id() or public.coaching_platform_admin()));
create trigger coaching_updated_at before update on public.organization_features for each row execute function public.set_updated_at();
alter table public.coach_profiles enable row level security;
revoke all on public.coach_profiles from anon, authenticated;
grant select on public.coach_profiles to authenticated;
create policy coach_profiles_read on public.coach_profiles for select to authenticated using (public.coaching_identity_enabled() and (user_id=auth.uid() or public.coaching_platform_admin()));
create trigger coaching_updated_at before update on public.coach_profiles for each row execute function public.set_updated_at();
alter table public.coaching_opt_in_requests enable row level security;
revoke all on public.coaching_opt_in_requests from anon, authenticated;
grant select on public.coaching_opt_in_requests to authenticated;
create policy coaching_opt_in_requests_read on public.coaching_opt_in_requests for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_admin(organization_id)));
alter table public.coach_requests enable row level security;
revoke all on public.coach_requests from anon, authenticated;
grant select on public.coach_requests to authenticated;
create policy coach_requests_read on public.coach_requests for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_admin(organization_id)));
create trigger coaching_updated_at before update on public.coach_requests for each row execute function public.set_updated_at();
alter table public.coaching_engagements enable row level security;
revoke all on public.coaching_engagements from anon, authenticated;
grant select on public.coaching_engagements to authenticated;
create policy coaching_engagements_read on public.coaching_engagements for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_is_coach(id) or public.coaching_is_client(id) or public.coaching_admin(organization_id)));
create trigger coaching_updated_at before update on public.coaching_engagements for each row execute function public.set_updated_at();
alter table public.coaching_sessions enable row level security;
revoke all on public.coaching_sessions from anon, authenticated;
grant select on public.coaching_sessions to authenticated;
create policy coaching_sessions_read on public.coaching_sessions for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_is_coach(engagement_id) or public.coaching_is_client(engagement_id) or public.coaching_admin((select organization_id from public.coaching_engagements where id=engagement_id))));
create trigger coaching_updated_at before update on public.coaching_sessions for each row execute function public.set_updated_at();
alter table public.coaching_consents enable row level security;
revoke all on public.coaching_consents from anon, authenticated;
grant select on public.coaching_consents to authenticated;
create policy coaching_consents_read on public.coaching_consents for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_is_coach(engagement_id) or public.coaching_is_client(engagement_id)));
create trigger coaching_updated_at before update on public.coaching_consents for each row execute function public.set_updated_at();
alter table public.coaching_data_permissions enable row level security;
revoke all on public.coaching_data_permissions from anon, authenticated;
grant select on public.coaching_data_permissions to authenticated;
create policy coaching_data_permissions_read on public.coaching_data_permissions for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_is_coach(engagement_id) or public.coaching_is_client(engagement_id)));
alter table public.coaching_notes enable row level security;
revoke all on public.coaching_notes from anon, authenticated;
grant select on public.coaching_notes to authenticated;
create policy coaching_notes_read on public.coaching_notes for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_can_read(engagement_id,visibility)));
create trigger coaching_updated_at before update on public.coaching_notes for each row execute function public.set_updated_at();
alter table public.coaching_goals enable row level security;
revoke all on public.coaching_goals from anon, authenticated;
grant select on public.coaching_goals to authenticated;
create policy coaching_goals_read on public.coaching_goals for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_can_read(engagement_id,visibility)));
create trigger coaching_updated_at before update on public.coaching_goals for each row execute function public.set_updated_at();
alter table public.coaching_actions enable row level security;
revoke all on public.coaching_actions from anon, authenticated;
grant select on public.coaching_actions to authenticated;
create policy coaching_actions_read on public.coaching_actions for select to authenticated using (public.coaching_identity_enabled() and (public.coaching_can_read(engagement_id,visibility)));
create trigger coaching_updated_at before update on public.coaching_actions for each row execute function public.set_updated_at();
alter table public.coaching_specialties enable row level security;
revoke all on public.coaching_specialties from anon, authenticated;
grant select on public.coaching_specialties to authenticated;
create policy coaching_specialties_read on public.coaching_specialties for select to authenticated using (public.coaching_identity_enabled() and (auth.uid() is not null));
alter table public.industries enable row level security;
revoke all on public.industries from anon, authenticated;
grant select on public.industries to authenticated;
create policy industries_read on public.industries for select to authenticated using (public.coaching_identity_enabled() and (auth.uid() is not null));
alter table public.leadership_levels enable row level security;
revoke all on public.leadership_levels from anon, authenticated;
grant select on public.leadership_levels to authenticated;
create policy leadership_levels_read on public.leadership_levels for select to authenticated using (public.coaching_identity_enabled() and (auth.uid() is not null));
alter table public.coach_specialties enable row level security;
revoke all on public.coach_specialties from anon, authenticated;
grant select on public.coach_specialties to authenticated;
create policy coach_specialties_read on public.coach_specialties for select to authenticated using (public.coaching_identity_enabled() and (exists(select 1 from public.coach_profiles c where c.id=coach_id and (c.profile_status='approved' or c.user_id=auth.uid() or public.coaching_platform_admin()))));
alter table public.coach_industries enable row level security;
revoke all on public.coach_industries from anon, authenticated;
grant select on public.coach_industries to authenticated;
create policy coach_industries_read on public.coach_industries for select to authenticated using (public.coaching_identity_enabled() and (exists(select 1 from public.coach_profiles c where c.id=coach_id and (c.profile_status='approved' or c.user_id=auth.uid() or public.coaching_platform_admin()))));
alter table public.coach_leadership_levels enable row level security;
revoke all on public.coach_leadership_levels from anon, authenticated;
grant select on public.coach_leadership_levels to authenticated;
create policy coach_leadership_levels_read on public.coach_leadership_levels for select to authenticated using (public.coaching_identity_enabled() and (exists(select 1 from public.coach_profiles c where c.id=coach_id and (c.profile_status='approved' or c.user_id=auth.uid() or public.coaching_platform_admin()))));
create index on public.coaching_sessions(engagement_id);
create index on public.coaching_consents(engagement_id);
create index on public.coaching_notes(engagement_id);
create index on public.coaching_goals(engagement_id);
create index on public.coaching_actions(engagement_id);
create index on public.coaching_data_permissions(engagement_id);
create index on public.coaching_engagements(coach_id);
create index on public.coaching_engagements(coachee_user_id);
create index on public.coaching_engagements(organization_id);
-- Explicit projection is essential: RLS alone cannot hide profile contact/credential fields.
create function public.coaching_marketplace() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'display_name',c.display_name,'photo_url',c.photo_url,'headline',c.headline,'short_bio',c.short_bio,'full_bio',c.full_bio,
 'city',c.city,'state_region',c.state_region,'country',c.country,'coaching_philosophy',c.coaching_philosophy,'languages',c.languages,
 'years_coaching',c.years_coaching,'years_leadership_experience',c.years_leadership_experience,'icf_credential',c.icf_credential,
 'credential_expired',c.icf_credential_expiration_date<current_date,'virtual_available',c.virtual_available,'in_person_available',c.in_person_available,
 'approved_at',c.approved_at,
 'availability_status',case when public.coaching_enabled(public.current_profile_organization_id()) then c.availability_status else null end,
 'specialties',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_specialties j join public.coaching_specialties s on s.id=j.specialty_id where j.coach_id=c.id),
 'industries',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_industries j join public.industries s on s.id=j.industry_id where j.coach_id=c.id),
 'leadership_levels',(select coalesce(jsonb_agg(s.name),'[]') from public.coach_leadership_levels j join public.leadership_levels s on s.id=j.leadership_level_id where j.coach_id=c.id)
 ) order by c.approved_at desc),'[]') from public.coach_profiles c where c.profile_status='approved' and public.coaching_actor() is not null
$$;
create function public.coaching_directory(eid uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('client',p.full_name,'organization',o.name,'coach',c.display_name)
 from public.coaching_engagements e join public.profiles p on p.auth_user_id=e.coachee_user_id join public.organizations o on o.id=e.organization_id join public.coach_profiles c on c.id=e.coach_id
 where e.id=eid and (public.coaching_is_coach(eid) or public.coaching_is_client(eid) or public.coaching_admin(e.organization_id))
$$;
create function public.coaching_credential_log() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'engagement_id',e.id,'client_id',e.coachee_user_id,'client_name',p.full_name,
 'client_email',case when public.coaching_has_consent(e.id,'credential_verification') then p.email else null end,
 'organization_id',e.organization_id,'organization',o.name,'relationship_start',e.start_date,'relationship_end',e.actual_end_date,
 'session_date',s.session_date,'duration_minutes',s.duration_minutes,'compensation_category',s.compensation_category,'coaching_category',s.coaching_category,
 'consent_recorded',public.coaching_has_consent(e.id,'credential_verification'),'engagement_status',e.status) order by s.session_date desc),'[]')
 from public.coaching_sessions s join public.coaching_engagements e on e.id=s.engagement_id join public.profiles p on p.auth_user_id=e.coachee_user_id join public.organizations o on o.id=e.organization_id
 where s.status='completed' and public.coaching_is_coach(e.id)
$$;
-- Organization reporting uses an aggregate projection; session narratives remain private.
drop policy coaching_sessions_read on public.coaching_sessions;
create policy coaching_sessions_read on public.coaching_sessions for select to authenticated using(public.coaching_is_coach(engagement_id) or public.coaching_is_client(engagement_id));
create function public.coaching_hours(eid uuid, date_from date default null, date_to date default null) returns numeric language sql stable security definer set search_path=public as $$
 select coalesce(sum(duration_minutes)/60,0) from public.coaching_sessions where engagement_id=eid and status='completed' and (date_from is null or session_date>=date_from) and (date_to is null or session_date<=date_to) and
 (public.coaching_is_coach(eid) or public.coaching_is_client(eid) or exists(select 1 from public.coaching_engagements where id=eid and public.coaching_admin(organization_id)))
$$;
-- Source records stay in Leader Continuity. This projection is the only outside-coach access path.
create function public.coaching_development(eid uuid, available boolean default false) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.coaching_engagements; result jsonb;
begin
 select * into e from public.coaching_engagements where id=eid;
 if not(public.coaching_is_client(eid) or public.coaching_is_coach(eid)) then raise exception 'Not authorized'; end if;
 if available and not public.coaching_is_client(eid) then raise exception 'Only the client may select data to share'; end if;
 if not available and not public.coaching_has_consent(eid,'development_data_access') then return '[]'; end if;
 select coalesce(jsonb_agg(x.record),'[]') into result from (
 select 'competencies' as kind,c.id,jsonb_build_object('id',c.id,'data_type','competencies','title',c.name,'description',c.definition) as record
 from public.role_competencies c join public.candidates ca on ca.target_role_id=c.role_id where ca.id=e.candidate_id and ca.organization_id=e.organization_id and c.organization_id=e.organization_id
 union all
 select 'development_plan',d.id,jsonb_build_object('id',d.id,'data_type','development_plan','title',d.experience_title,'description',d.mentee_task)
 from public.development_records d where d.candidate_id=e.candidate_id and d.organization_id=e.organization_id
 ) x where available or exists(select 1 from public.coaching_data_permissions p where p.engagement_id=eid and p.data_type=x.kind and p.data_id=x.id and p.revoked_at is null);
 return result;
end $$;
create function public.coaching_mutate(operation text, payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); org uuid:=public.current_profile_organization_id(); eid uuid:=(payload->>'engagement_id')::uuid;
 rid uuid:=(payload->>'id')::uuid; result uuid; e public.coaching_engagements; c public.coach_profiles; r public.coach_requests;
 kind text; scope text; txt text; target uuid; stamp timestamptz:=clock_timestamp();
begin
 if actor is null or not public.coaching_identity_enabled() then raise exception 'An active account is required'; end if;
 if operation='opt_in' then
  if not public.coaching_admin(org) then raise exception 'Organization administrator required'; end if;
  insert into public.coaching_opt_in_requests(organization_id,requested_by,notes) values(org,actor,left(payload->>'notes',4000))
   on conflict(organization_id) where status='pending' do update set requested_by=coaching_opt_in_requests.requested_by returning id into result;
 elsif operation='review_opt_in' then
  if not public.coaching_platform_admin() then raise exception 'Platform administrator required'; end if;
  update public.coaching_opt_in_requests set status=case when payload->>'decision'='approved' then 'approved' else 'declined' end,reviewed_at=stamp,reviewed_by=actor where id=rid and status='pending' returning organization_id,id into org,result;
  if result is null then raise exception 'Pending request not found'; end if;
  if payload->>'decision'='approved' then
   insert into public.organization_features(organization_id,feature_key,status,activated_at,activated_by) values(org,'coaching','active',stamp,actor)
   on conflict(organization_id,feature_key) do update set status='active',activated_at=stamp,activated_by=actor,expires_at=null;
  end if;
 elsif operation in ('save_profile','review_profile') then
  if rid is not null then select * into c from public.coach_profiles where id=rid for update; end if;
  if not public.coaching_platform_admin() and (c.user_id is distinct from actor or operation='review_profile') then raise exception 'Not authorized'; end if;
  if operation='review_profile' then
   update public.coach_profiles set profile_status=coalesce(payload->>'profile_status',profile_status),credential_verification_status=coalesce(payload->>'credential_verification_status',credential_verification_status),approved_at=case when payload->>'profile_status'='approved' then stamp else approved_at end,approved_by=case when payload->>'profile_status'='approved' then actor else approved_by end where id=rid returning id into result;
  else
   if nullif(trim(payload->>'display_name'),'') is null then raise exception 'Coach name required'; end if;
   if rid is null then insert into public.coach_profiles(display_name) values(payload->>'display_name') returning id into rid; end if;
   update public.coach_profiles set display_name=payload->>'display_name',headline=payload->>'headline',short_bio=payload->>'short_bio',full_bio=payload->>'full_bio',email=payload->>'email',phone=payload->>'phone',photo_url=payload->>'photo_url',city=payload->>'city',country=payload->>'country',timezone=coalesce(nullif(payload->>'timezone',''),'UTC'),coaching_philosophy=payload->>'coaching_philosophy',
    years_coaching=coalesce((payload->>'years_coaching')::integer,0),years_leadership_experience=coalesce((payload->>'years_leadership_experience')::integer,0),icf_credential=coalesce(payload->>'icf_credential','none'),icf_credential_number=payload->>'icf_credential_number',icf_credential_expiration_date=nullif(payload->>'icf_credential_expiration_date','')::date,
    virtual_available=coalesce((payload->>'virtual_available')::boolean,true),in_person_available=coalesce((payload->>'in_person_available')::boolean,false),availability_status=coalesce(payload->>'availability_status','available'),
    languages=coalesce(array(select jsonb_array_elements_text(payload->'languages')),'{}'),
    user_id=case when public.coaching_platform_admin() then coalesce(nullif(payload->>'user_id','')::uuid,user_id) else user_id end,
    profile_status=case when public.coaching_platform_admin() then profile_status else 'pending_review' end,
    credential_verification_status=case when public.coaching_platform_admin() then credential_verification_status else 'pending' end
   where id=rid returning id into result;
   delete from public.coach_specialties where coach_id=rid;
   insert into public.coach_specialties(coach_id,specialty_id) select rid,value::uuid from jsonb_array_elements_text(coalesce(payload->'specialty_ids','[]'));
   delete from public.coach_industries where coach_id=rid;
   insert into public.coach_industries(coach_id,industry_id) select rid,value::uuid from jsonb_array_elements_text(coalesce(payload->'industry_ids','[]'));
   delete from public.coach_leadership_levels where coach_id=rid;
   insert into public.coach_leadership_levels(coach_id,leadership_level_id) select rid,value::uuid from jsonb_array_elements_text(coalesce(payload->'leadership_level_ids','[]'));
  end if;
 elsif operation='request_coach' then
  if not public.coaching_admin(org) or not public.coaching_enabled(org) then raise exception 'Active Coaching and organization administrator access required'; end if;
  select * into c from public.coach_profiles where id=(payload->>'coach_id')::uuid and profile_status='approved' and availability_status<>'unavailable';
  if c.id is null then raise exception 'Coach unavailable'; end if;
  target:=nullif(payload->>'requested_for_user_id','')::uuid;
  if target is not null and not exists(select 1 from public.profiles where auth_user_id=target and organization_id=org and deleted_at is null) then raise exception 'Invalid client'; end if;
  insert into public.coach_requests(organization_id,coach_id,requested_for_user_id,requested_by,request_reason,development_focus) values(org,c.id,target,actor,payload->>'request_reason',payload->>'development_focus') returning id into result;
 elsif operation='create_engagement' then
  select * into r from public.coach_requests where id=rid for update;
  if r.id is null or not public.coaching_admin(r.organization_id) or not public.coaching_enabled(r.organization_id) then raise exception 'Not authorized'; end if;
  if r.status='converted_to_engagement' then raise exception 'Request already converted'; end if;
  target:=coalesce(nullif(payload->>'coachee_user_id','')::uuid,r.requested_for_user_id);
  if target is null then raise exception 'Select a client'; end if;
  if not exists(select 1 from public.coach_profiles where id=r.coach_id and profile_status='approved') then raise exception 'Approved coach required'; end if;
  insert into public.coaching_engagements(organization_id,coach_id,coachee_user_id,candidate_id,coach_request_id,title,organization_objectives,created_by,start_date,engagement_type,funding_type)
  values(r.organization_id,r.coach_id,target,(select ou.candidate_id from public.organization_users ou join public.profiles p on p.id=ou.profile_id where p.auth_user_id=target and ou.organization_id=r.organization_id limit 1),r.id,coalesce(nullif(payload->>'title',''),'Leadership coaching'),r.development_focus,actor,coalesce(nullif(payload->>'start_date','')::date,current_date),coalesce(payload->>'engagement_type','leadership_development'),coalesce(payload->>'funding_type','organization_paid')) returning id into result;
  update public.coach_requests set status='converted_to_engagement' where id=r.id;
 else
  select * into e from public.coaching_engagements where id=eid for update;
  if e.id is null then raise exception 'Engagement not found'; end if;
  if operation='engagement_status' then
   if not public.coaching_admin(e.organization_id) and not public.coaching_is_coach(eid) then raise exception 'Not authorized'; end if;
   update public.coaching_engagements set status=payload->>'status',actual_end_date=case when payload->>'status'='completed' then current_date else actual_end_date end where id=eid returning id into result;
  elsif operation='progress' then
   if not public.coaching_can_read(eid,'organization_shared') then raise exception 'Reporting consent required'; end if;
   update public.coaching_engagements set progress=payload->>'progress' where id=eid returning id into result;
  elsif operation='consent' then
   if not public.coaching_is_client(eid) then raise exception 'Only the client can give or revoke consent'; end if;
   kind:=payload->>'consent_type';
   txt:=case kind
    when 'coaching_record_retention' then 'I consent to my coach maintaining my name, contact information, relationship dates and coaching hours for coaching administration.'
    when 'credential_verification' then 'I authorize use of my coaching records and contact information for professional credential verification.'
    when 'development_data_access' then 'I authorize my coach to view the selected portions of my Leader Continuity development profile for this engagement.'
    when 'organization_reporting' then 'I authorize sharing high-level goals and progress with my organization. Confidential conversations and private notes remain private.' end;
   if txt is null then raise exception 'Unsupported consent template'; end if;
   update public.coaching_consents set revoked=true,revoked_at=stamp where engagement_id=eid and consent_type=kind and not revoked;
   insert into public.coaching_consents(engagement_id,organization_id,coach_id,coachee_user_id,consent_type,consent_version,consent_text,consent_given,consent_date)
   values(eid,e.organization_id,e.coach_id,e.coachee_user_id,kind,'2026-09-15',txt,coalesce((payload->>'consent_given')::boolean,false),stamp) returning id into result;
   if kind='development_data_access' and not (payload->>'consent_given')::boolean then update public.coaching_data_permissions set revoked_at=stamp where engagement_id=eid and revoked_at is null; end if;
   if kind='coaching_record_retention' and not (payload->>'consent_given')::boolean and e.status='active' then update public.coaching_engagements set status='paused' where id=eid; end if;
  elsif operation='data_permission' then
   if not public.coaching_is_client(eid) then raise exception 'Only the client may share development data'; end if;
   if payload->>'revoke'='true' then
    update public.coaching_data_permissions set revoked_at=stamp where id=rid and engagement_id=eid returning id into result;
   else
    if not public.coaching_has_consent(eid,'development_data_access') then raise exception 'Development consent required'; end if;
    if not exists(select 1 from jsonb_array_elements(public.coaching_development(eid,true)) x where x->>'id'=payload->>'data_id' and x->>'data_type'=payload->>'data_type') then raise exception 'Invalid development record'; end if;
    insert into public.coaching_data_permissions(engagement_id,data_type,data_id,granted_by) values(eid,payload->>'data_type',(payload->>'data_id')::uuid,actor) returning id into result;
   end if;
  elsif operation in ('session','confirm_session') then
   if operation='confirm_session' then
    if not public.coaching_is_client(eid) then raise exception 'Only the client may confirm'; end if;
    update public.coaching_sessions set coachee_confirmed=true,coachee_confirmed_at=stamp where id=rid and engagement_id=eid returning id into result;
   else
    if not public.coaching_is_coach(eid) or e.status<>'active' or not public.coaching_enabled(e.organization_id) or not public.coaching_has_consent(eid,'coaching_record_retention') then raise exception 'An active, consented engagement is required'; end if;
    if rid is null then insert into public.coaching_sessions(engagement_id,coach_id,coachee_user_id,session_date) values(eid,e.coach_id,e.coachee_user_id,(payload->>'session_date')::date) returning id into rid; end if;
    update public.coaching_sessions set session_date=(payload->>'session_date')::date,status=payload->>'status',actual_start_at=nullif(payload->>'actual_start_at','')::timestamptz,actual_end_at=nullif(payload->>'actual_end_at','')::timestamptz,scheduled_start_at=nullif(payload->>'scheduled_start_at','')::timestamptz,scheduled_end_at=nullif(payload->>'scheduled_end_at','')::timestamptz,coaching_category=payload->>'coaching_category',compensation_category=payload->>'compensation_category',session_format=coalesce(payload->>'session_format','video'),location_or_platform=payload->>'location_or_platform',coach_confirmed=true,coach_confirmed_at=stamp,coachee_confirmed=false,coachee_confirmed_at=null where id=rid and engagement_id=eid returning id into result;
   end if;
  elsif operation in ('note','goal','action','complete_action') then
   if not public.coaching_is_coach(eid) and not public.coaching_is_client(eid) then raise exception 'Not authorized'; end if;
   scope:=coalesce(payload->>'visibility',case when operation='note' and public.coaching_is_coach(eid) then 'coach_private' else 'coach_client' end);
   if scope='coach_private' and not public.coaching_is_coach(eid) then raise exception 'Coach-private records are restricted'; end if;
   if scope='organization_shared' and not public.coaching_has_consent(eid,'organization_reporting') then raise exception 'Organization reporting consent required'; end if;
   if operation='note' then
    if rid is not null then raise exception 'Create a new note to preserve the original record'; end if;
    if nullif(payload->>'session_id','') is not null and not exists(select 1 from public.coaching_sessions where id=(payload->>'session_id')::uuid and engagement_id=eid) then raise exception 'Invalid session'; end if;
    insert into public.coaching_notes(engagement_id,session_id,coach_id,coachee_user_id,note_type,title,content,visibility,created_by)
    values(eid,nullif(payload->>'session_id','')::uuid,e.coach_id,e.coachee_user_id,case when public.coaching_is_client(eid) and not public.coaching_is_coach(eid) then 'client_reflection' else coalesce(payload->>'note_type','private_coach_note') end,payload->>'title',payload->>'content',scope,actor) returning id into result;
   elsif operation='goal' then
    if not public.coaching_is_coach(eid) then raise exception 'Coach required'; end if;
    if nullif(payload->>'competency_id','') is not null and not exists(select 1 from jsonb_array_elements(public.coaching_development(eid)) x where x->>'id'=payload->>'competency_id' and x->>'data_type'='competencies') then raise exception 'Competency access not granted'; end if;
    if nullif(payload->>'development_plan_item_id','') is not null and not exists(select 1 from jsonb_array_elements(public.coaching_development(eid)) x where x->>'id'=payload->>'development_plan_item_id' and x->>'data_type'='development_plan') then raise exception 'Development access not granted'; end if;
    if rid is null then insert into public.coaching_goals(engagement_id,title,visibility,created_by) values(eid,payload->>'title',scope,actor) returning id into rid; end if;
    update public.coaching_goals set title=payload->>'title',description=payload->>'description',baseline_text=payload->>'baseline_text',target_text=payload->>'target_text',status=coalesce(payload->>'status','planned'),target_date=nullif(payload->>'target_date','')::date,completion_date=case when payload->>'status'='achieved' then current_date else null end,competency_id=nullif(payload->>'competency_id','')::uuid,development_plan_item_id=nullif(payload->>'development_plan_item_id','')::uuid,visibility=scope,updated_by=actor where id=rid and engagement_id=eid returning id into result;
   elsif operation='action' then
    if not public.coaching_is_coach(eid) then raise exception 'Coach required'; end if;
    if nullif(payload->>'goal_id','') is not null and not exists(select 1 from public.coaching_goals where id=(payload->>'goal_id')::uuid and engagement_id=eid and (visibility=scope or visibility='organization_shared' or (visibility='coach_client' and scope='coach_private'))) then raise exception 'Goal must belong to this engagement and permit this visibility'; end if;
    insert into public.coaching_actions(engagement_id,goal_id,assigned_by,assigned_to,title,description,due_date,visibility,created_by) values(eid,nullif(payload->>'goal_id','')::uuid,actor,e.coachee_user_id,payload->>'title',payload->>'description',nullif(payload->>'due_date','')::date,scope,actor) returning id into result;
   else
    if not public.coaching_is_client(eid) then raise exception 'Only the client may complete an action'; end if;
    update public.coaching_actions set status='completed',completed_date=current_date,updated_by=actor where id=rid and engagement_id=eid and visibility<>'coach_private' returning id into result;
   end if;
  else raise exception 'Unknown coaching operation';
  end if;
 end if;
 if result is null then raise exception 'Record not found or operation not permitted'; end if;
 insert into public.platform_audit_events(actor_profile_id,organization_id,event_type,details) values((select id from public.profiles where auth_user_id=actor),coalesce(e.organization_id,org),'coaching.'||operation,jsonb_build_object('actor_user_id',actor,'engagement_id',eid,'record_id',result));
 return result;
end $$;
insert into public.coaching_specialties(name,slug,sort_order) values('Executive Leadership','executive-leadership',0) on conflict(slug) do nothing;
insert into public.coaching_specialties(name,slug,sort_order) values('Emerging Leaders','emerging-leaders',1) on conflict(slug) do nothing;
insert into public.coaching_specialties(name,slug,sort_order) values('Succession Readiness','succession-readiness',2) on conflict(slug) do nothing;
insert into public.coaching_specialties(name,slug,sort_order) values('Executive Transition','executive-transition',3) on conflict(slug) do nothing;
insert into public.coaching_specialties(name,slug,sort_order) values('Communication','communication',4) on conflict(slug) do nothing;
insert into public.coaching_specialties(name,slug,sort_order) values('Conflict Management','conflict-management',5) on conflict(slug) do nothing;
insert into public.industries(name,slug,sort_order) values('Healthcare','healthcare',0) on conflict(slug) do nothing;
insert into public.industries(name,slug,sort_order) values('Rural Healthcare','rural-healthcare',1) on conflict(slug) do nothing;
insert into public.industries(name,slug,sort_order) values('Education','education',2) on conflict(slug) do nothing;
insert into public.industries(name,slug,sort_order) values('Nonprofit','nonprofit',3) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('Emerging Leader','emerging-leader',0) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('Supervisor','supervisor',1) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('Manager','manager',2) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('Director','director',3) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('Executive','executive',4) on conflict(slug) do nothing;
insert into public.leadership_levels(name,slug,sort_order) values('CEO','ceo',5) on conflict(slug) do nothing;
-- Restrict execution explicitly; Postgres grants new functions to PUBLIC by default.
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'coaching_%' loop
  execute format('revoke all on function %s from public, anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
commit;
