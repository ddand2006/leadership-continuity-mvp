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
insert into role_competencies(id,organization_id,role_id,name,definition) values(coaching_test.uid(401),coaching_test.uid(101),coaching_test.uid(301),'Communication','Role-specific development information');
insert into development_records(id,organization_id,candidate_id,experience_title,mentee_task) values(coaching_test.uid(402),coaching_test.uid(101),coaching_test.uid(201),'Development experience','Selected client task');
insert into organization_users(id,profile_id,organization_id,candidate_id) values(coaching_test.uid(501),(select id from profiles where auth_user_id=coaching_test.uid(6)),coaching_test.uid(101),coaching_test.uid(201));
insert into roles(id,organization_id,title) values(coaching_test.uid(301),coaching_test.uid(101),'Executive Leader');
insert into coach_specialties(coach_id,specialty_id) select coaching_test.uid(104),id from coaching_specialties where name='Communication';
update role_competencies set name='Communication' where id=coaching_test.uid(401);
update coach_profiles set timezone='America/Denver',languages=array['English'],icf_credential='pcc',years_coaching=10 where id=coaching_test.uid(104);
update auth.users set email='test-'||id::text||'@example.test';
update candidates set full_name='Candidate A' where id=coaching_test.uid(201);
update organization_users set status='active',auth_user_id=coaching_test.uid(6) where candidate_id=coaching_test.uid(201);
update development_records set role_id=coaching_test.uid(301),status='in_progress' where id=coaching_test.uid(402);
insert into role_competencies(id,organization_id,role_id,name,definition,target_score) values(coaching_test.uid(403),coaching_test.uid(101),coaching_test.uid(301),'Technical Accounting Knowledge','Technical knowledge',4),(coaching_test.uid(404),coaching_test.uid(101),coaching_test.uid(301),'Unassessed Competency','No assessment available',4);
insert into interview_panels(id,organization_id,candidate_id,role_id,panel_name,date_completed) values(coaching_test.uid(601),coaching_test.uid(101),coaching_test.uid(201),coaching_test.uid(301),'Completed assessment',current_date);
insert into interview_scores(organization_id,panel_id,competency_id,score_numeric,evidence_notes,concern_notes) values(coaching_test.uid(101),coaching_test.uid(601),coaching_test.uid(401),2,'SECRET INTERVIEW NOTES','SECRET CONCERNS'),(coaching_test.uid(101),coaching_test.uid(601),coaching_test.uid(403),2,'SECRET INTERVIEW NOTES','SECRET CONCERNS');
insert into mentor_role_assignments(id,organization_id,candidate_id,role_id,mentor_profile_id,status) values(coaching_test.uid(701),coaching_test.uid(101),coaching_test.uid(201),coaching_test.uid(301),(select id from profiles where auth_user_id=coaching_test.uid(8)),'active');
set role authenticated;select coaching_test.login(2);
select coaching_test.assert(development_intelligence_analyze(coaching_test.uid(201))=2,'Existing scores identify two sourced gaps');
select coaching_test.assert(development_intelligence_analyze(coaching_test.uid(201))=0,'Repeated analysis does not duplicate needs');
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'needs')=2,'Missing competency assessment is not a development gap');
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))::text not like '%SECRET%','Source adapter omits interview narratives');
select v->>'id' as need_id from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'needs') v where v->>'title'='Communication' \gset
select set_config('coaching_test.need',:'need_id',false);
select v->>'id' as rec_id from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'recommendations') v where v->>'development_need_id'=:'need_id' \gset
select coaching_test.assert((select v->'recommendation_data'->>'coaching_suitable' from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'recommendations') v where v->>'development_need_id'=:'need_id')='true','Communication rule recommends coaching with rationale');
select coaching_test.assert((select v->'recommendation_data'->>'coaching_suitable' from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'recommendations') v where v->>'development_need_id'<>:'need_id')='false','Technical knowledge does not automatically recommend coaching');
select coaching_test.reject($$select development_intelligence_mutate('coaching_request',jsonb_build_object('development_need_id',current_setting('coaching_test.need')))$$,'Inactive coaching blocks requests but not recommendations');
select coaching_test.login(3);
select coaching_test.reject($$select development_intelligence_read(coaching_test.uid(201))$$,'Other organization cannot access candidate intelligence');
select coaching_test.reject($$select development_intelligence_analyze(coaching_test.uid(201))$$,'Other organization cannot analyze candidate');
select coaching_test.login(6);
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'needs')=2,'Candidate reads permitted own needs');
select coaching_test.reject($$select development_intelligence_mutate('readiness',jsonb_build_object('candidate_id',coaching_test.uid(201),'match_status','match','readiness_score',100,'reason','Self promotion'))$$,'Candidate cannot update readiness');
select coaching_test.login(8);
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'needs')=2,'Assigned active mentor can read candidate development');
select coaching_test.login(2);
select development_intelligence_mutate('recommendation',jsonb_build_object('id',:'rec_id','status','modified','focus','Practice concise executive recommendations and gather feedback.'));
select coaching_test.assert((select v->>'reviewed_by' from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'recommendations') v where v->>'id'=:'rec_id')=coaching_test.uid(2)::text,'Human modification records reviewer while retaining system recommendation');
reset role;
insert into organization_features(organization_id,feature_key,status) values(coaching_test.uid(101),'coaching','active');
set role authenticated;select coaching_test.login(2);
select development_intelligence_mutate('coaching_request',jsonb_build_object('development_need_id',:'need_id')) as request_id \gset
select coaching_test.assert((select candidate_id from coach_requests where id=:'request_id')=coaching_test.uid(201) and (select status from coach_requests where id=:'request_id')='draft','Development need prepopulates editable Sprint 2 draft');
select coaching_test.assert((select development_focus from coach_requests where id=:'request_id')='Practice concise executive recommendations and gather feedback.','Human-reviewed focus prepopulates the request');
select coaching_mutate('request_save',jsonb_build_object('id',:'request_id','requested_for_user_id',coaching_test.uid(6),'request_title','Communication development','objectives',jsonb_build_array('Communication'),'competency_ids',jsonb_build_array(coaching_test.uid(401)),'context_categories',jsonb_build_array('competencies'),'submit',true));
select coaching_run_matching(:'request_id') as run_id \gset
select coaching_test.assert((select bool_and(matching_version='v2-development') from coaching_match_results where run_id=:'run_id'),'Development-linked requests use matching version 2');
select coaching_test.assert((select bool_and((factor_scores->'development_need'->>'points')::numeric=0) from coaching_match_results where run_id=:'run_id'),'Missing verified coach experience receives no invented points');
select coaching_test.login(1);
select development_intelligence_mutate('experience',jsonb_build_object('coach_id',coaching_test.uid(104),'need_type','executive_communication','target_role_title','Executive Leader','description','Fictional platform-verified leadership coaching experience'));
select coaching_test.login(2);select coaching_run_matching(:'request_id') as run2 \gset
select coaching_test.assert((select (factor_scores->'development_need'->>'points')::numeric=15 and (factor_scores->'target_role'->>'points')::numeric=10 from coaching_match_results where run_id=:'run2' and coach_id=coaching_test.uid(104)),'Verified development and target-role experience improve explainable match');
select coaching_test.assert((select count(distinct run_id) from coaching_match_results where coach_request_id=:'request_id')=2,'Matching history remains intact');
reset role;
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,candidate_id,title,created_by) values(coaching_test.uid(801),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),coaching_test.uid(201),'Development coaching',coaching_test.uid(2));
insert into coaching_notes(engagement_id,coach_id,coachee_user_id,title,content,created_by) values(coaching_test.uid(801),coaching_test.uid(104),coaching_test.uid(6),'PRIVATE COACH NOTE','NEVER EXPORT THIS PRIVATE NARRATIVE',coaching_test.uid(4));
insert into coaching_sessions(engagement_id,coach_id,coachee_user_id,session_date,status,actual_start_at,actual_end_at,coaching_category,compensation_category,coach_confirmed) values(coaching_test.uid(801),coaching_test.uid(104),coaching_test.uid(6),current_date,'completed',now()-interval '1 hour',now(),'individual','paid',true);
select coaching_test.assert((select count(*) from development_evidence)=0,'Completing a session does not create organizational evidence');
select coaching_test.assert((select count(*) from candidate_role_matches)=0,'Analysis, matching and session completion never update readiness');
set role authenticated;select coaching_test.login(4);
select coaching_test.assert(development_intelligence_read(null,coaching_test.uid(801))->'sources'='[]'::jsonb and development_intelligence_read(null,coaching_test.uid(801))->'needs'='[]'::jsonb,'Coach has no automatic development context');
select coaching_test.reject($$select coaching_development(coaching_test.uid(801),true)$$,'Coach cannot enumerate unshared development records');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',coaching_test.uid(801),'consent_type','development_data_access','consent_given',true));
select coaching_mutate('data_permission',jsonb_build_object('engagement_id',coaching_test.uid(801),'data_type','development_need','data_id',:'need_id')) as permission_id \gset
select coaching_test.login(4);
select coaching_test.assert(jsonb_array_length(development_intelligence_read(null,coaching_test.uid(801))->'needs')=1,'Coach receives only the client-selected development need');
select development_intelligence_mutate('focus',jsonb_build_object('engagement_id',coaching_test.uid(801),'development_need_id',:'need_id','title','Executive presentation practice','description','Practice measurable shared leadership objective')) as focus_id \gset
select development_intelligence_mutate('evidence',jsonb_build_object('engagement_id',coaching_test.uid(801),'development_need_id',:'need_id','evidence_type','coach_shared_milestone','title','Presentation practice completed','description','Leader demonstrated clear recommendations during agreed exercise.','evidence_date',current_date,'request_key',coaching_test.uid(901))) as evidence_id \gset
select set_config('coaching_test.evidence',:'evidence_id',false);
select development_intelligence_mutate('progress',jsonb_build_object('engagement_id',coaching_test.uid(801),'development_need_id',:'need_id','review_type','30_day','progress_status','progressing','evidence_summary','Shared practice review','evidence_ids',jsonb_build_array(:'evidence_id'))) as progress_id \gset
select development_intelligence_mutate('outcome',jsonb_build_object('engagement_id',coaching_test.uid(801),'development_need_id',:'need_id','measure_type','behavior_frequency','measurement_source','Agreed practice checklist','baseline_value',1,'final_value',3,'evidence_id',:'evidence_id')) as outcome_id \gset
select coaching_test.reject($$select development_intelligence_mutate('outcome',jsonb_build_object('engagement_id',coaching_test.uid(801),'measure_type','custom','measurement_source','Test','final_value','NaN'))$$,'Nonfinite outcome values are rejected');
select coaching_test.login(2);
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))->'reviews'='[]'::jsonb and development_intelligence_read(coaching_test.uid(201))->'outcomes'='[]'::jsonb,'Private progress and outcomes are excluded from organization views');
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))->'evidence'='[]'::jsonb,'Organization cannot read unapproved coaching milestone');
select coaching_test.assert(development_intelligence_outcomes()::text not like '%PRIVATE%' and development_intelligence_outcomes()::text not like '%NARRATIVE%','Analytics omit confidential coaching notes');
select coaching_test.login(6);
select coaching_test.reject($$select development_intelligence_mutate('evidence_share',jsonb_build_object('id',current_setting('coaching_test.evidence'),'visibility','readiness_review'))$$,'Readiness sharing requires organization-reporting consent');
select coaching_mutate('consent',jsonb_build_object('engagement_id',coaching_test.uid(801),'consent_type','organization_reporting','consent_given',true));
select development_intelligence_mutate('evidence_share',jsonb_build_object('id',:'evidence_id','visibility','readiness_review'));
select development_intelligence_mutate('progress_share',jsonb_build_object('engagement_id',coaching_test.uid(801),'id',:'progress_id','visibility','organization'));
select development_intelligence_mutate('outcome_share',jsonb_build_object('engagement_id',coaching_test.uid(801),'id',:'outcome_id','visibility','organization'));
select coaching_test.login(2);
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'reviews')=1 and jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'outcomes')=1,'Client-approved progress and outcomes become visible');
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'evidence')=1,'Client-approved milestone enters authorized readiness evidence');
select development_intelligence_mutate('evidence_verify',jsonb_build_object('id',:'evidence_id'));
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))->>'system_recommendation' like '%human readiness review%','New verified evidence recommends human review');
select development_intelligence_mutate('readiness',jsonb_build_object('candidate_id',coaching_test.uid(201),'match_status','not_yet','readiness_score',65,'reason','Human review of shared development evidence; additional observed practice required.','evidence_ids',jsonb_build_array(:'evidence_id')));
select coaching_test.assert((development_intelligence_read(coaching_test.uid(201))->'current_readiness'->>'readiness_score')::numeric=65,'Authorized human review uses existing readiness record');
select coaching_test.assert(jsonb_array_length(development_intelligence_read(coaching_test.uid(201))->'readiness_history')=1,'Readiness history preserves actor, reason and evidence references');
select coaching_test.login(6);
select coaching_mutate('data_permission',jsonb_build_object('engagement_id',coaching_test.uid(801),'id',:'permission_id','revoke',true));
select coaching_test.login(4);
select coaching_test.assert(development_intelligence_read(null,coaching_test.uid(801))->'needs'='[]'::jsonb,'Revocation immediately removes development need from coach context');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',coaching_test.uid(801),'consent_type','organization_reporting','consent_given',false));
select coaching_test.login(2);
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))->'evidence'='[]'::jsonb,'Reporting consent revocation removes coaching evidence from organization views');
select coaching_test.reject($$select * from development_evidence$$,'Raw evidence table access cannot bypass projections');
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))->'reviews'='[]'::jsonb and development_intelligence_read(coaching_test.uid(201))->'outcomes'='[]'::jsonb,'Reporting revocation also removes progress and outcomes');
select coaching_test.reject($$select development_intelligence_mutate('readiness',jsonb_build_object('candidate_id',coaching_test.uid(201),'reason','Missing human decision'))$$,'Readiness requires an explicit human decision');
select coaching_test.login(5);
select coaching_test.reject($$select development_intelligence_read(null,coaching_test.uid(801))$$,'Unassigned coach cannot read engagement intelligence');
reset role;
insert into candidate_strengths values(coaching_test.uid(999),coaching_test.uid(101),coaching_test.uid(201),'Strategic',1,'Thinking','SECRET STRENGTHS NOTES',now());
insert into review_360_cycles values(coaching_test.uid(910),coaching_test.uid(101),coaching_test.uid(201),null,coaching_test.uid(301),'completed',now(),3);
insert into review_360_snapshot_competencies values(coaching_test.uid(911),coaching_test.uid(101),coaching_test.uid(910),coaching_test.uid(401),'Communication',4);
insert into review_360_respondents select coaching_test.uid(n),coaching_test.uid(101),coaching_test.uid(910),'completed','peer','peer' from generate_series(920,922) n;
insert into review_360_ratings select coaching_test.uid(n+10),coaching_test.uid(101),coaching_test.uid(910),coaching_test.uid(n),coaching_test.uid(911),3,false,'SECRET RAW 360 COMMENT' from generate_series(920,921) n;
set role authenticated;select coaching_test.login(2);
select coaching_test.assert(not exists(select 1 from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'sources') s where s->>'data_type'='360_review'),'Below-threshold 360 ratings remain unavailable');
reset role;
insert into review_360_ratings values(coaching_test.uid(932),coaching_test.uid(101),coaching_test.uid(910),coaching_test.uid(922),coaching_test.uid(911),3,false,'SECRET RAW 360 COMMENT');
set role authenticated;select coaching_test.login(2);
select coaching_test.assert(exists(select 1 from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'sources') s where s->>'data_type'='360_review' and (s->>'current_level')::numeric=3),'Released thresholded 360 aggregate becomes available');
select coaching_test.assert(development_intelligence_read(coaching_test.uid(201))::text not like '%SECRET%','Strengths and released 360 sources omit raw confidential text');
reset role;update review_360_cycles set results_released_at=null;
set role authenticated;select coaching_test.login(2);
select coaching_test.assert(not exists(select 1 from jsonb_array_elements(development_intelligence_read(coaching_test.uid(201))->'sources') s where s->>'data_type'='360_review'),'Withdrawal of 360 release removes source access');
rollback;
