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
insert into candidates values(coaching_test.uid(201),coaching_test.uid(101),coaching_test.uid(301));
insert into role_competencies values(coaching_test.uid(401),coaching_test.uid(101),coaching_test.uid(301),'Communication','Role-specific development information');
insert into development_records values(coaching_test.uid(402),coaching_test.uid(101),coaching_test.uid(201),'Development experience','Selected client task');
insert into organization_users(id,profile_id,organization_id,candidate_id) values(coaching_test.uid(501),(select id from profiles where auth_user_id=coaching_test.uid(6)),coaching_test.uid(101),coaching_test.uid(201));
set role authenticated;
select coaching_test.login(2);
select coaching_test.assert(jsonb_array_length(coaching_marketplace())=2,'Non-opted-in organization sees approved coaches only');
select coaching_test.assert(not (coaching_marketplace()::text like '%SECRET%'),'Marketplace omits private credential fields');
select coaching_test.assert(not (coaching_marketplace()::text like '%private-coach%'),'Marketplace omits contact email');
select coaching_test.assert((coaching_marketplace()->0->>'availability_status') is null,'Availability hidden without entitlement');
select coaching_test.assert((select count(*) from coach_profiles)=0,'Raw coach profiles blocked for org admin');
select coaching_test.reject($$select coaching_mutate('request_coach',jsonb_build_object('coach_id',coaching_test.uid(104)))$$,'Locked organization cannot request coach');
select coaching_test.reject($$insert into organization_features(organization_id,feature_key,status) values(coaching_test.uid(101),'coaching','active')$$,'Client cannot forge entitlement');
select coaching_mutate('opt_in','{}') as opt_in_id \gset
select coaching_test.assert(coaching_mutate('opt_in','{}')=:'opt_in_id'::uuid,'Duplicate opt-in is idempotent');
select coaching_test.reject($$select coaching_mutate('review_opt_in','{}')$$,'Organization admin cannot self-approve entitlement');
select coaching_test.login(1);
select coaching_mutate('review_opt_in',jsonb_build_object('id',:'opt_in_id','decision','approved'));
select coaching_test.login(2);
select coaching_test.assert(coaching_enabled(coaching_test.uid(101)),'Admin approval enables Coaching');
select coaching_test.assert(coaching_marketplace()->0->>'availability_status'='available','Active organization sees availability');
select coaching_test.reject($$select coaching_mutate('request_coach',jsonb_build_object('coach_id',coaching_test.uid(104),'requested_for_user_id',coaching_test.uid(7)))$$,'Cross-organization client request rejected');
select coaching_mutate('request_coach',jsonb_build_object('coach_id',coaching_test.uid(104),'requested_for_user_id',coaching_test.uid(6),'request_reason','Development')) as request_id \gset
select coaching_mutate('create_engagement',jsonb_build_object('id',:'request_id','title','Leadership development')) as engagement_id \gset
select set_config('coaching_test.engagement',:'engagement_id',false);
select coaching_test.reject($$select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'status','active'))$$,'Activation requires consent');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','coaching_record_retention','consent_given',true));
select coaching_test.assert(not coaching_has_consent(:'engagement_id','development_data_access'),'Consent types remain independent');
select coaching_test.login(2);
select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',:'engagement_id','status','active'));
select coaching_test.login(4);
select coaching_test.assert((select count(*) from coaching_engagements)=1,'Outside coach accesses assigned engagement without org membership');
select coaching_mutate('note',jsonb_build_object('engagement_id',:'engagement_id','title','Private','content','Confidential coach narrative')) as private_note \gset
select coaching_mutate('note',jsonb_build_object('engagement_id',:'engagement_id','title','Shared','content','Client shared narrative','visibility','coach_client'));
select coaching_test.reject($$select coaching_mutate('note',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'title','org','content','unauthorized','visibility','organization_shared'))$$,'Organization sharing requires consent');
select coaching_mutate('session',jsonb_build_object('engagement_id',:'engagement_id','session_date','2026-09-15','status','completed','actual_start_at','2026-09-15T09:00:00-06:00','actual_end_at','2026-09-15T10:30:00-06:00','coaching_category','individual','compensation_category','paid')) as session_id \gset
select coaching_test.assert((select duration_minutes from coaching_sessions where id=:'session_id')=90,'Session duration calculated as 90 minutes');
select coaching_test.assert((coaching_credential_log()->0->>'duration_minutes')::numeric=90,'Completed session feeds credential log');
select coaching_test.assert(coaching_credential_log()->0->>'client_email' is null,'Credential contact export requires credential consent');
select coaching_test.reject($$select coaching_mutate('session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'session_date','2026-09-15','status','completed','coaching_category','individual','compensation_category','paid'))$$,'Completed session requires actual timestamps');
select coaching_test.reject($$select coaching_mutate('session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'session_date','2026-09-15','status','completed','actual_start_at','2026-09-15T10:00Z','actual_end_at','2026-09-15T09:00Z','coaching_category','individual','compensation_category','paid'))$$,'Negative duration rejected');
select coaching_test.reject($$select coaching_mutate('session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'session_date','2026-09-15','status','completed','actual_start_at','2026-09-15T09:00Z','actual_end_at','2026-09-15T10:00Z'))$$,'Completed session requires category and compensation');
select coaching_test.login(5);
select coaching_test.assert((select count(*) from coaching_notes)=0,'Coach B cannot read Coach A notes');
select coaching_test.assert((select count(*) from coaching_engagements)=0,'Coach B cannot read Coach A client data');
select coaching_test.assert(coaching_directory(:'engagement_id') is null,'Forged directory request reveals nothing');
select coaching_test.reject($$select coaching_mutate('note',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'title','Attack','content','Attack'))$$,'Coach B cannot write into Coach A engagement');
select coaching_test.login(6);
select coaching_test.assert((select count(*) from coaching_notes)=1,'Client can read coach-client but not coach-private notes');
select coaching_test.reject($$select coaching_mutate('note',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'title','Attack','content','Attack','visibility','coach_private'))$$,'Client cannot create coach-private records');
select coaching_mutate('confirm_session',jsonb_build_object('engagement_id',:'engagement_id','id',:'session_id'));
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','organization_reporting','consent_given',true));
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','credential_verification','consent_given',true));
select coaching_test.login(4);
select coaching_test.assert(coaching_credential_log()->0->>'client_email'='client-a@example.test','Credential consent permits client contact');
select coaching_mutate('note',jsonb_build_object('engagement_id',:'engagement_id','title','Org update','content','Shared progress','visibility','organization_shared'));
select coaching_mutate('goal',jsonb_build_object('engagement_id',:'engagement_id','title','Shared goal','visibility','organization_shared')) as goal_id \gset
select coaching_mutate('action',jsonb_build_object('engagement_id',:'engagement_id','goal_id',:'goal_id','title','Client action','visibility','coach_client')) as action_id \gset
select coaching_test.login(2);
select coaching_test.assert((select count(*) from coaching_notes)=1,'Org admin sees only organization-shared notes');
select coaching_test.assert((select count(*) from coaching_sessions)=0,'Org admin cannot read raw session narratives');
select coaching_test.assert(coaching_hours(:'engagement_id')=1.5,'Org admin receives aggregate hours');
select coaching_test.assert((select count(*) from coaching_goals)=1,'Org admin can see shared goals');
select coaching_test.assert((select count(*) from coaching_actions)=0,'Org admin cannot see client-shared actions');
select coaching_test.login(1);
select coaching_test.assert((select count(*) from coaching_notes)=1,'Platform admin does not bypass private-note confidentiality');
select coaching_test.login(3);
select coaching_test.assert((select count(*) from coaching_notes)=0,'Other organization admin sees no notes');
select coaching_test.assert((select count(*) from coaching_engagements)=0,'Other organization admin sees no engagements');
select coaching_test.login(8);
select coaching_test.assert((select count(*) from coaching_engagements)=0,'Unassigned mentor cannot browse engagements');
select coaching_test.login(6);
select coaching_test.assert(jsonb_array_length(coaching_development(:'engagement_id',true))=2,'Client can select existing development records');
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','development_data_access','consent_given',true));
select coaching_mutate('data_permission',jsonb_build_object('engagement_id',:'engagement_id','data_id',coaching_test.uid(401),'data_type','competencies'));
select coaching_test.reject($$select coaching_mutate('data_permission',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'data_id',coaching_test.uid(999),'data_type','competencies'))$$,'Cannot grant arbitrary source record');
select coaching_test.login(4);
select coaching_test.assert(jsonb_array_length(coaching_development(:'engagement_id'))=1,'Coach sees exactly the selected source record');
select coaching_test.reject($$select coaching_development(current_setting('coaching_test.engagement')::uuid,true)$$,'Coach cannot enumerate unshared source records');
select coaching_mutate('goal',jsonb_build_object('engagement_id',:'engagement_id','title','Linked goal','competency_id',coaching_test.uid(401)));
select coaching_test.assert(coaching_hours(:'engagement_id','2026-10-01',null)=0,'Quarter/date bounds exclude earlier sessions');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','development_data_access','consent_given',false));
select coaching_test.login(4);
select coaching_test.assert(coaching_development(:'engagement_id')='[]'::jsonb,'Revocation immediately blocks development access');
select coaching_test.reject($$select coaching_mutate('goal',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'title','Unauthorized link','competency_id',coaching_test.uid(401)))$$,'Cannot add source links after revocation');
select coaching_test.login(6);
select coaching_mutate('complete_action',jsonb_build_object('engagement_id',:'engagement_id','id',:'action_id'));
select coaching_test.assert((select status from coaching_actions where id=:'action_id')='completed','Client completes shared action');
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','organization_reporting','consent_given',false));
select coaching_test.login(2);
select coaching_test.assert((select count(*) from coaching_notes)=0,'Revoked reporting consent hides shared narratives');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',:'engagement_id','consent_type','coaching_record_retention','consent_given',false));
select coaching_test.assert((select status from coaching_engagements where id=:'engagement_id')='paused','Revoked record retention pauses engagement');
select coaching_test.login(4);
select coaching_test.reject($$select coaching_mutate('session',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'session_date','2026-09-15','status','scheduled'))$$,'Revoked retention blocks future session logging');
reset role;
insert into organization_users(id,auth_user_id,status) values(coaching_test.uid(599),coaching_test.uid(4),'suspended');
set role authenticated;
select coaching_test.login(4);
select coaching_test.assert((select count(*) from coaching_engagements)=0,'Suspended account cannot access coaching');
select coaching_test.reject($$select coaching_mutate('note',jsonb_build_object('engagement_id',current_setting('coaching_test.engagement'),'title','Blocked','content','Blocked'))$$,'Suspended account cannot write coaching content');
reset role;
rollback;
