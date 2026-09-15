\set ON_ERROR_STOP on
begin;
create schema coaching_test;
create function coaching_test.uid(n integer) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
create function coaching_test.login(n integer) returns text language sql as $$ select set_config('request.jwt.claim.sub',coaching_test.uid(n)::text,false) $$;
create function coaching_test.assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function coaching_test.reject(statement text,label text) returns void language plpgsql as $$ begin begin execute statement; exception when others then raise notice 'PASS: % (%)',label,sqlerrm; return; end; raise exception 'FAIL: % unexpectedly allowed',label; end $$;
grant usage on schema coaching_test to authenticated;
grant execute on all functions in schema coaching_test to authenticated;
insert into auth.users select coaching_test.uid(n) from generate_series(1,8) n;
insert into organizations(id,name) values(coaching_test.uid(101),'Organization A'),(coaching_test.uid(102),'Organization B');
insert into profiles(auth_user_id,organization_id,role,full_name,email) values
(coaching_test.uid(1),coaching_test.uid(101),'system_admin','Platform Admin','admin@example.test'),
(coaching_test.uid(2),coaching_test.uid(101),'hospital_admin','Org A Admin','a@example.test'),
(coaching_test.uid(3),coaching_test.uid(102),'hospital_admin','Org B Admin','b@example.test'),
(coaching_test.uid(6),coaching_test.uid(101),'candidate','Client A','client-a@example.test'),
(coaching_test.uid(7),coaching_test.uid(102),'candidate','Client B','client-b@example.test'),
(coaching_test.uid(8),coaching_test.uid(101),'mentor','Other User','other@example.test');
insert into coach_profiles(id,user_id,display_name,profile_status,icf_credential_number,email) values
(coaching_test.uid(104),coaching_test.uid(4),'Coach A','approved','SECRET-CREDENTIAL','private-coach@example.test'),
(coaching_test.uid(105),coaching_test.uid(5),'Coach B','approved','SECRET-B','private-b@example.test'),
(coaching_test.uid(106),null,'Pending Coach','pending_review',null,null);
insert into candidates(id,organization_id,target_role_id) values(coaching_test.uid(201),coaching_test.uid(101),coaching_test.uid(301));
insert into role_competencies values(coaching_test.uid(401),coaching_test.uid(101),coaching_test.uid(301),'Communication','Role-specific development information');
insert into development_records(id,organization_id,candidate_id,experience_title,mentee_task) values(coaching_test.uid(402),coaching_test.uid(101),coaching_test.uid(201),'Development experience','Selected client task');
insert into organization_users(id,profile_id,organization_id,candidate_id) values(coaching_test.uid(501),(select id from profiles where auth_user_id=coaching_test.uid(6)),coaching_test.uid(101),coaching_test.uid(201));
insert into roles values(coaching_test.uid(301),coaching_test.uid(101),'Executive Leader');
insert into coach_specialties(coach_id,specialty_id) select coaching_test.uid(104),id from coaching_specialties where name='Communication';
update role_competencies set name='Communication' where id=coaching_test.uid(401);
update coach_profiles set timezone='America/Denver',languages=array['English'],icf_credential='pcc',years_coaching=10 where id=coaching_test.uid(104);
update auth.users set email='test-'||id::text||'@example.test';
set role authenticated;
select coaching_test.login(2);
select coaching_test.assert(coaching_marketplace()->0->>'availability_status'='available','General availability visible without activation');
select coaching_test.reject($$select coaching_available_slots(coaching_test.uid(104),current_date+2)$$,'Inactive organization cannot query exact availability');
select coaching_test.reject($$select coaching_mutate('request_save',jsonb_build_object('requested_for_user_id',coaching_test.uid(6),'request_title','Test','submit','true'))$$,'Inactive organization cannot create formal request');
select coaching_mutate('opt_in','{}') as access_id \gset
select coaching_test.login(1);
select coaching_mutate('review_opt_in',jsonb_build_object('id',:'access_id','decision','approved'));
select coaching_test.login(2);
select coaching_test.assert(coaching_request_context(coaching_test.uid(6))->>'target_role'='Executive Leader','Existing target role loads without duplication');
select coaching_test.reject($$select coaching_request_context(coaching_test.uid(7))$$,'Cannot import another organization leader context');
select coaching_mutate('request_save',jsonb_build_object('requested_for_user_id',coaching_test.uid(6),'request_title','Executive Communication','request_reason','SECRET HR INFORMATION','development_focus','SECRET DEVELOPMENT PLAN','submit','true','objectives',jsonb_build_array('Communication'),'context_categories',jsonb_build_array('competencies'),'competency_ids',jsonb_build_array(coaching_test.uid(401)),'specialty_ids',jsonb_build_array((select id from coaching_specialties where name='Communication')),'preferred_credential','pcc','timezone','America/Denver','language','English')) as request_id \gset
select set_config('coaching_test.request',:'request_id',false);
select coaching_run_matching(:'request_id') as run1 \gset
select coaching_test.assert(jsonb_array_length(coaching_workflow_matches(:'request_id'))=2,'Approved available coaches matched');
select coaching_test.assert((coaching_workflow_matches(:'request_id')->0->>'match_score')::numeric=100,'Explicitly matching preferences earn the configured points');
select coaching_test.assert(coaching_workflow_matches(:'request_id')->0->>'coach_id'=coaching_test.uid(104)::text,'Matching coach ranked first');
select coaching_run_matching(:'request_id') as run2 \gset
select coaching_test.assert((select count(distinct run_id) from coaching_match_results where coach_request_id=:'request_id')=2,'Matching history is retained');
select coaching_test.reject($$select coaching_mutate('create_engagement',jsonb_build_object('id',current_setting('coaching_test.request')))$$,'Legacy fast path cannot bypass leader acceptance');
select coaching_mutate('invite',jsonb_build_object('request_id',:'request_id','coach_id',coaching_test.uid(104))) as invitation_id \gset
select set_config('coaching_test.invitation',:'invitation_id',false);
select coaching_test.login(5);
select coaching_test.assert(coaching_opportunities()='[]'::jsonb,'Coach cannot retrieve another coach opportunities');
select coaching_test.assert((select count(*) from coaching_invitations)=0,'Raw invitations hide prospective client identities');
select coaching_test.reject($$select coaching_available_slots(coaching_test.uid(104),current_date+2)$$,'Coach cannot retrieve another coach exact availability');
select coaching_test.reject($$select coaching_mutate('invitation_response',jsonb_build_object('id',current_setting('coaching_test.invitation'),'decision','interested'))$$,'Coach cannot answer another coach invitation');
select coaching_test.login(4);
select coaching_test.assert(jsonb_array_length(coaching_opportunities())=1,'Invited coach sees opportunity');
select coaching_test.assert(coaching_opportunities()::text not like '%SECRET%' and coaching_opportunities()::text not like '%Client A%' and coaching_opportunities()::text not like '%'||coaching_test.uid(6)::text||'%','Opportunity projection omits identity and confidential development context');
select coaching_test.reject($$select coaching_workflow_matches(current_setting('coaching_test.request')::uuid)$$,'Coach cannot retrieve other coaches match scores');
select coaching_mutate('invitation_response',jsonb_build_object('id',:'invitation_id','decision','viewed'));
select coaching_mutate('invitation_response',jsonb_build_object('id',:'invitation_id','decision','interested'));
select coaching_test.reject($$select coaching_mutate('intro',jsonb_build_object('id',current_setting('coaching_test.invitation'),'status','requested'))$$,'Prospective coach cannot reveal leader identity by creating an introduction');
select coaching_test.login(6);
select coaching_test.assert(coaching_workflow_requests()->0->>'status'='leader_review','Interested coach triggers leader review');
select coaching_test.assert(coaching_workflow_requests()::text not like '%SECRET%','Leader review excludes internal request narrative');
select coaching_mutate('intro',jsonb_build_object('id',:'invitation_id','status','requested'));
select coaching_test.login(4);
select coaching_mutate('intro',jsonb_build_object('id',:'invitation_id','status','scheduled','scheduled_start_at',(current_date+1)::timestamp at time zone 'UTC','scheduled_end_at',((current_date+1)::timestamp at time zone 'UTC')+interval '30 minutes','location_or_link','https://example.test/intro'));
select coaching_test.assert((select count(*) from coaching_intro_meetings where coach_request_id=:'request_id')=1,'Scheduling updates the requested introduction without duplicating it');
select coaching_test.login(6);
select coaching_mutate('leader_decision',jsonb_build_object('id',:'invitation_id','decision','accept'));
select coaching_test.login(2);
select coaching_mutate('setup_engagement',jsonb_build_object('request_id',:'request_id','title','Executive development','start_date',current_date,'planned_end_date',current_date+20,'planned_sessions',5,'planned_hours',5,'organization_objectives','Shared organization purpose')) as engagement_id \gset
select set_config('coaching_test.engagement',:'engagement_id',false);
select coaching_test.reject($$select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'status','active'))$$,'Sprint 2 activation requires all required consents');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','coaching_record_retention','consent_given',true));
select coaching_test.login(2);
select coaching_test.reject($$select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'status','active'))$$,'Record retention alone no longer activates Sprint 2 engagement');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type',k,'consent_given',true)) from unnest(array['credential_verification','development_data_access','organization_reporting']) k;
select coaching_mutate('data_permission',jsonb_build_object('engagement_id',:'engagement_id','data_type','competencies','data_id',coaching_test.uid(401)));
select coaching_test.login(2);
select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',:'engagement_id','status','active'));
select coaching_test.login(4);
select coaching_mutate('availability_rule',jsonb_build_object('coach_id',coaching_test.uid(104),'day_of_week',extract(dow from current_date+2),'start_time','09:00','end_time','13:00','timezone','America/Denver'));
select coaching_test.assert(jsonb_array_length(coaching_available_slots(coaching_test.uid(104),current_date+2,60))=13,'Hourly slots generated in coach time zone at 15-minute intervals');
select coaching_available_slots(coaching_test.uid(104),current_date+2,60)->0->>'start' as slot_start,coaching_available_slots(coaching_test.uid(104),current_date+2,60)->0->>'end' as slot_end \gset
select coaching_mutate('schedule_session',jsonb_build_object('engagement_id',:'engagement_id','scheduled_start_at',:'slot_start','scheduled_end_at',:'slot_end','session_format','video')) as session_id \gset
select set_config('coaching_test.session',:'session_id',false);
select set_config('coaching_test.slot_start',:'slot_start',false);
select set_config('coaching_test.slot_end',:'slot_end',false);
select coaching_test.reject($$select coaching_mutate('schedule_session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'scheduled_start_at',current_setting('coaching_test.slot_start'),'scheduled_end_at',current_setting('coaching_test.slot_end')))$$,'Overlapping booking rejected');
select coaching_test.login(6);
select coaching_test.assert(jsonb_array_length(coaching_available_slots(coaching_test.uid(104),current_date+2,60,null,:'engagement_id'))=9,'Leader sees remaining authorized slots');
select coaching_mutate('session_change',jsonb_build_object('id',:'session_id','change_type','reschedule','requested_start_at',(:'slot_start')::timestamptz+interval '2 hours','requested_end_at',(:'slot_end')::timestamptz+interval '2 hours')) as change_id \gset
select coaching_test.login(4);
select coaching_mutate('resolve_session_change',jsonb_build_object('id',:'change_id','decision','approve'));
select coaching_test.assert((select scheduled_start_at from coaching_sessions where id=:'session_id')=(:'slot_start')::timestamptz+interval '2 hours','Reschedule updates the original session');
select coaching_mutate('availability_exception',jsonb_build_object('coach_id',coaching_test.uid(104),'exception_date',current_date+3,'exception_type','unavailable','timezone','America/Denver'));
select coaching_test.assert(coaching_available_slots(coaching_test.uid(104),current_date+3,60)='[]'::jsonb,'Blocked date has no availability');
select coaching_test.assert(jsonb_array_length(coaching_development(:'engagement_id'))=1,'Explicitly consented development record accessible');
select coaching_mutate('note',jsonb_build_object('engagement_id',:'engagement_id','title','Private note','content','SECRET PRIVATE COACH NOTE'));
select coaching_test.login(2);
select coaching_test.assert((select count(*) from coaching_notes)=0,'Organization cannot retrieve coach-private notes via direct database query');
select coaching_test.reject($$select coaching_mutate_sprint1('engagement_status','{}')$$,'Internal compatibility RPC is not callable by clients');
select coaching_test.reject($$select coaching_email_claim(coaching_test.uid(2))$$,'Email outbox does not expose recipient addresses to clients');
select coaching_test.login(6);
select coaching_mutate('data_permission',jsonb_build_object('engagement_id',:'engagement_id','id',(select id from coaching_data_permissions where engagement_id=:'engagement_id'),'revoke',true));
select coaching_test.login(4);
select coaching_test.assert(coaching_development(:'engagement_id')='[]'::jsonb,'Permission revocation immediately blocks source access');
select coaching_mutate('session',jsonb_build_object('id',:'session_id','engagement_id',:'engagement_id','session_date',current_date+2,'status','completed','scheduled_start_at',(:'slot_start')::timestamptz+interval '2 hours','scheduled_end_at',(:'slot_end')::timestamptz+interval '2 hours','actual_start_at',(:'slot_start')::timestamptz+interval '2 hours','actual_end_at',(:'slot_end')::timestamptz+interval '2 hours','coaching_category','individual','compensation_category','paid'));
select coaching_test.assert((coaching_credential_log()->0->>'duration_minutes')::numeric=60,'Scheduled/completed session reaches Sprint 1 coaching log');
select coaching_test.reject($$select coaching_mutate('schedule_session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'scheduled_start_at','2026-09-17T10:00','scheduled_end_at','2026-09-17T11:00'))$$,'Offset-free timestamps are rejected');
select coaching_mutate('availability_rule',jsonb_build_object('coach_id',coaching_test.uid(104),'day_of_week',0,'start_time','00:00','end_time','04:00','timezone','America/Denver','effective_start_date','2027-03-14','effective_end_date','2027-03-14'));
select coaching_test.assert(jsonb_array_length(coaching_available_slots(coaching_test.uid(104),'2027-03-14',60))=9,'DST spring-forward skips the nonexistent hour');
-- Daylight-saving fall-back: one local hour occurs twice, with distinct UTC slots.
select coaching_mutate('availability_rule',jsonb_build_object('coach_id',coaching_test.uid(104),'day_of_week',0,'start_time','00:00','end_time','04:00','timezone','America/Denver','effective_start_date','2026-11-01','effective_end_date','2026-11-01'));
select coaching_test.assert(jsonb_array_length(coaching_available_slots(coaching_test.uid(104),'2026-11-01',60))=17,'DST fall-back preserves both repeated-hour UTC slots');
select coaching_test.assert((select count(*) from jsonb_array_elements(coaching_available_slots(coaching_test.uid(104),'2026-11-01',60)) x where (x->>'start')::timestamptz at time zone 'America/Denver'='2026-11-01 01:00'::timestamp)=2,'Repeated local 1 AM has two distinct bookable instants');
select coaching_available_slots(coaching_test.uid(104),current_date+2,60)->0->>'start' as cancel_start,coaching_available_slots(coaching_test.uid(104),current_date+2,60)->0->>'end' as cancel_end \gset
select coaching_mutate('schedule_session',jsonb_build_object('engagement_id',:'engagement_id','scheduled_start_at',:'cancel_start','scheduled_end_at',:'cancel_end')) as cancel_session \gset
select coaching_test.login(6);
select coaching_mutate('session_change',jsonb_build_object('id',:'cancel_session','change_type','cancel')) as cancel_change \gset
select coaching_test.login(4);
select coaching_mutate('resolve_session_change',jsonb_build_object('id',:'cancel_change','decision','approve'));
select coaching_test.assert((select status from coaching_sessions where id=:'cancel_session')='cancelled','Approved cancellation cancels the session');
select coaching_test.login(1);
select coaching_test.reject($$select coaching_mutate('weights','{"weights":{"specialty":20,"competency":20,"industry":15,"leadership_level":15,"credential":10,"format":5,"availability":5,"geography":5}}')$$,'Weights that do not sum to 100 are rejected');
select coaching_test.assert((coaching_operations_summary()->>'Sessions This Month')::integer>=1,'Platform operations uses safe session aggregates');
select coaching_test.login(4);
select coaching_mutate('closeout',jsonb_build_object('engagement_id',:'engagement_id','summary','Shared coaching recommendations'));
select coaching_test.login(6);
select coaching_mutate('closeout',jsonb_build_object('engagement_id',:'engagement_id','summary','Shared client reflection'));
select coaching_test.login(2);
select coaching_mutate('closeout',jsonb_build_object('engagement_id',:'engagement_id','summary','Organization objectives addressed','final_status','completed'));
select coaching_test.assert((select status from coaching_engagements where id=:'engagement_id')='completed','Three-party closeout completes engagement');
select coaching_test.assert(jsonb_array_length(coaching_notifications())>0,'In-app workflow notifications delivered');
select coaching_test.assert((select count(*) from notifications where recipient_user_id<>auth.uid())=0,'Notifications remain recipient-private');
reset role;
update coach_profiles set accepting_clients=false where id=coaching_test.uid(105);
update coach_profiles set max_active_clients=1 where id=coaching_test.uid(104);
-- The closed engagement does not consume capacity; create a legacy active fixture for the capacity test.
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,title,created_by,status) values(coaching_test.uid(777),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'Capacity fixture',coaching_test.uid(2),'requested');
insert into coaching_consents(engagement_id,organization_id,coach_id,coachee_user_id,consent_type,consent_version,consent_text,consent_given) values(coaching_test.uid(777),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'coaching_record_retention','test','Test',true);
update coaching_engagements set status='active' where id=coaching_test.uid(777);
set role authenticated;
select coaching_test.login(2);
select coaching_mutate('request_save',jsonb_build_object('requested_for_user_id',coaching_test.uid(6),'request_title','Capacity request','submit','true')) as capacity_request \gset
select coaching_run_matching(:'capacity_request');
select coaching_test.assert(coaching_workflow_matches(:'capacity_request')='[]'::jsonb,'Capacity and not-accepting-clients exclude coaches from matching');
select set_config('coaching_test.capacity_request',:'capacity_request',false);
select coaching_test.reject($$select coaching_mutate('invite',jsonb_build_object('request_id',current_setting('coaching_test.capacity_request'),'coach_id',coaching_test.uid(104),'capacity_override',true,'admin_reason','Attempt'))$$,'Organization admin cannot override coach capacity');
select coaching_test.login(1);
select coaching_mutate('invite',jsonb_build_object('request_id',:'capacity_request','coach_id',coaching_test.uid(104),'capacity_override',true,'admin_reason','Approved operational override'));
select coaching_test.assert(exists(select 1 from coaching_invitations where coach_request_id=:'capacity_request' and capacity_override),'Platform capacity override is explicit and stored');
reset role;
rollback;
