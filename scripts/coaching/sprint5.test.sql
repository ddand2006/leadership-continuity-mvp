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

insert into organization_features(organization_id,feature_key,status) values(coaching_test.uid(101),'coaching','active');
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,candidate_id,title,status,created_by) values(coaching_test.uid(801),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),coaching_test.uid(201),'Completed development engagement','completed',coaching_test.uid(2));
set role authenticated;select coaching_test.login(2);
select coaching_scale_mutate('program',jsonb_build_object('name','Emerging Leaders','start_date',current_date,'status','active','budget_amount',10000)) as program_id \gset
select coaching_test.assert(coaching_scale_read()->'programs'->0->>'name'='Emerging Leaders','Organization can create a coaching program');
select coaching_scale_mutate('participant',jsonb_build_object('program_id',:'program_id','candidate_id',coaching_test.uid(201),'engagement_id',coaching_test.uid(801),'status','active'));
select coaching_scale_mutate('roi',jsonb_build_object('engagement_id',coaching_test.uid(801),'measure_name','Leadership continuity measure','measure_type','custom','baseline_value',2,'target_value',4,'actual_value',3,'financial_value',5000,'measurement_method','Organization entered comparison','data_sources','Internal project register','assumptions','Association only; no causal attribution','period_start',current_date-30,'period_end',current_date));
select coaching_test.assert(coaching_scale_read()->'roi'->0->>'value_label'='Organization-provided estimate','ROI retains methodology and estimate disclosure');
select coaching_scale_mutate('saved_coach',jsonb_build_object('coach_id',coaching_test.uid(104),'preferred',true,'approved_for_organization',true));
select coaching_test.assert((select x->>'our_coach' from jsonb_array_elements(coaching_marketplace()) x where x->>'id'=coaching_test.uid(104)::text)='true','Organization coach network is projected without changing scores');
select coaching_scale_mutate('feedback',jsonb_build_object('engagement_id',coaching_test.uid(801),'respondent_type','organization','overall_experience',4,'comments','PRIVATE ORGANIZATION FEEDBACK'));
select coaching_scale_refresh();
select coaching_test.assert(coaching_scale_read('analytics')->'snapshot'->'metrics'->>'Completed engagements'='1','Organization analytics reuse completed engagements');
select coaching_test.assert(coaching_scale_read('analytics')::text not like '%PRIVATE%','Analytics never include feedback narratives');
select coaching_test.login(3);
select coaching_test.assert(coaching_scale_read()->'programs'='[]'::jsonb and coaching_scale_read()->'roi'='[]'::jsonb,'Other organization cannot access programs or ROI');
select coaching_test.reject($$select coaching_scale_read('analytics',jsonb_build_object('organization',coaching_test.uid(101)))$$,'Other organization cannot select another analytics scope');
select coaching_test.reject($$select coaching_scale_mutate('participant',jsonb_build_object('program_id',(select id from coaching_programs limit 1),'candidate_id',coaching_test.uid(201),'status','active'))$$,'Direct program access cannot bypass authorization');
select coaching_test.login(6);
select coaching_scale_mutate('feedback',jsonb_build_object('engagement_id',coaching_test.uid(801),'respondent_type','coachee','overall_experience',5,'comments','PRIVATE CLIENT FEEDBACK'));
select coaching_test.reject($$select coaching_scale_mutate('feedback',jsonb_build_object('engagement_id',coaching_test.uid(801),'respondent_type','coachee','overall_experience',5))$$,'Duplicate closeout feedback is rejected');
select coaching_test.reject($$select coaching_scale_refresh()$$,'Client cannot refresh organization analytics');
select coaching_scale_mutate('flag',jsonb_build_object('engagement_id',coaching_test.uid(801),'flag_type','client_concern','severity','review','description','PRIVATE QUALITY CONCERN')) as flag_id \gset
select coaching_test.login(4);
select coaching_test.assert(coaching_scale_read()->'feedback'='[]'::jsonb and coaching_scale_read()->'flags'='[]'::jsonb,'Coach cannot see private feedback or unshared concerns');
select coaching_scale_mutate('professional_development',jsonb_build_object('activity_type','coaching_supervision','title','Reflective practice','completion_date',current_date,'hours',2,'supervisor','Professional supervisor','notes','No client discussion recorded'));
select coaching_test.assert(jsonb_array_length(coaching_scale_read()->'professional_development')=1,'Coach records professional development');
select coaching_test.reject($$select coaching_scale_mutate('marketplace_status',jsonb_build_object('coach_id',coaching_test.uid(104),'status','approved','reason','Self approval'))$$,'Coach cannot change eligibility decisions');
select coaching_test.login(1);
select coaching_scale_mutate('flag_review',jsonb_build_object('id',:'flag_id','status','coach_response','content','Please describe administrative scheduling practices.','visibility','coach_platform'));
select coaching_scale_run_daily();
select coaching_test.assert(jsonb_array_length(coaching_scale_read()->'feedback')=2,'Platform may review private feedback');
select coaching_scale_refresh();
select coaching_test.assert(coaching_scale_read('analytics')->'snapshot'->'supply' is not null,'Platform supply-demand refresh works');
select coaching_test.login(4);
select coaching_test.assert(coaching_scale_read()::text not like '%PRIVATE%','Coach projection excludes private concern description and written feedback');
select coaching_test.assert((select q->>'metric_value' from jsonb_array_elements(coaching_scale_read()->'quality') q where q->>'metric_type'='coachee_experience') is null,'Small feedback samples are suppressed');
select coaching_scale_mutate('flag_response',jsonb_build_object('id',:'flag_id','content','I will review scheduling practices.'));
select coaching_test.login(1);
select coaching_scale_mutate('credential',jsonb_build_object('coach_id',coaching_test.uid(104),'credential','pcc','credential_number','PRIVATE-CREDENTIAL','expiration_date',current_date+20,'verification_status','verified','verification_source','Fictional issuer verification'));
select coaching_scale_run_daily();
select coaching_test.assert((select x->>'icf_credential' from jsonb_array_elements(coaching_marketplace()) x where x->>'id'=coaching_test.uid(104)::text)='pcc','Current verified credential appears in marketplace');
select coaching_test.assert(coaching_marketplace()::text not like '%PRIVATE-CREDENTIAL%','Marketplace never exposes credential number');
reset role;update coach_profiles set icf_credential_expiration_date=current_date-1 where id=coaching_test.uid(104);
set role authenticated;select coaching_test.login(2);
select coaching_test.assert((select x->>'icf_credential' from jsonb_array_elements(coaching_marketplace()) x where x->>'id'=coaching_test.uid(104)::text)='none','Expired badge disappears without waiting for daily refresh');
select coaching_scale_mutate('renewal',jsonb_build_object('engagement_id',coaching_test.uid(801),'renewal_type','continue_same_coach','focus','New leadership objective')) as renewal_request \gset
select coaching_test.assert((select status from coach_requests where id=:'renewal_request')='draft','Renewal starts an editable new request, not an active engagement');
select coaching_test.reject($$select coaching_scale_mutate('renewal',jsonb_build_object('engagement_id',coaching_test.uid(801),'renewal_type','new_coach'))$$,'Duplicate active renewal is rejected');
select coaching_test.reject($$select * from coaching_feedback$$,'Direct feedback table access is denied');
select coaching_test.reject($$select coaching_scale_mutate('roi',jsonb_build_object('measure_name','Bad number','measure_type','custom','actual_value','NaN'))$$,'Nonfinite ROI values are rejected');
select coaching_test.login(1);
select coaching_scale_mutate('config',jsonb_build_object('version','scale-test-v2','minimum_outcome_sample_size',5,'minimum_feedback_sample_size',5,'outcome_matching_enabled',true,'requirements',jsonb_build_object('credential',true,'agreement',false,'payment',false,'orientation',false),'healthy_ratio',2,'watch_ratio',1,'critical_ratio',0.5));
select coaching_test.assert(coaching_marketplace()='[]'::jsonb,'Configured credential requirement excludes unverified and expired coaches');
select coaching_test.reject($$select coaching_scale_mutate('config',jsonb_build_object('version','bad','minimum_outcome_sample_size',1,'minimum_feedback_sample_size',1,'requirements',jsonb_build_object('credential',false,'agreement',false,'payment',false,'orientation',false),'healthy_ratio',2,'watch_ratio',1,'critical_ratio',0.5))$$,'Unsafe minimum samples are rejected');
select coaching_scale_mutate('config',jsonb_build_object('version','scale-test-v3','minimum_outcome_sample_size',5,'minimum_feedback_sample_size',5,'outcome_matching_enabled',true,'requirements',jsonb_build_object('credential',false,'agreement',false,'payment',false,'orientation',false),'healthy_ratio',2,'watch_ratio',1,'critical_ratio',0.5));
select coaching_test.login(2);
select coaching_mutate('request_save',jsonb_build_object('id',:'renewal_request','requested_for_user_id',coaching_test.uid(6),'request_title','Continuation','objectives',jsonb_build_array('Communication'),'submit',true));
select coaching_run_matching(:'renewal_request') as run_id \gset
select coaching_test.assert((select (factor_scores->'shared_outcomes'->>'weight')::numeric=0 from coaching_match_results where run_id=:'run_id' and coach_id=coaching_test.uid(104)),'Matching omits outcome weight below the sample threshold');
reset role;
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,candidate_id,title,status,created_by) select coaching_test.uid(n),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),coaching_test.uid(201),'Threshold fixture','completed',coaching_test.uid(2) from generate_series(802,805) n;
insert into coaching_feedback(engagement_id,coach_id,submitted_by,respondent_type,overall_experience) select coaching_test.uid(n),coaching_test.uid(104),coaching_test.uid(6),'coachee',4 from generate_series(802,805) n;
insert into coaching_consents(engagement_id,organization_id,coach_id,coachee_user_id,consent_type,consent_version,consent_text,consent_given) select coaching_test.uid(n),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'organization_reporting','test','Fictional sharing consent',true from generate_series(801,805) n;
insert into coaching_goals(engagement_id,title,status,visibility,created_by) select coaching_test.uid(n),'Shared completed goal','achieved','organization_shared',coaching_test.uid(4) from generate_series(801,805) n;
set role authenticated;select coaching_test.login(1);select coaching_scale_run_daily();
select coaching_test.login(4);
select coaching_test.assert((select (q->>'metric_value')::numeric from jsonb_array_elements(coaching_scale_read()->'quality') q where q->>'metric_type'='coachee_experience')=4.2,'Exactly five distinct engagements unlock aggregate feedback with sample context');
select coaching_test.login(2);select coaching_run_matching(:'renewal_request') as scored_run \gset
select coaching_test.assert((select (factor_scores->'shared_outcomes'->>'weight')::numeric=5 and (factor_scores->'shared_outcomes'->>'sample_size')::int=5 from coaching_match_results where run_id=:'scored_run' and coach_id=coaching_test.uid(104)),'Fresh consented outcomes contribute only after five completed engagements');
select coaching_test.assert((select count(distinct run_id) from coaching_match_results where coach_request_id=:'renewal_request')=2,'Matching v3 retains prior matching runs');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',coaching_test.uid(801),'consent_type','organization_reporting','consent_given',false));
select coaching_test.login(2);
select coaching_test.assert(coaching_scale_read('analytics')->'snapshot'='null'::jsonb,'Consent revocation invalidates cached organization reports immediately');
select coaching_run_matching(:'renewal_request') as revoked_run \gset
select coaching_test.assert((select (factor_scores->'shared_outcomes'->>'weight')::numeric=0 from coaching_match_results where run_id=:'revoked_run' and coach_id=coaching_test.uid(104)),'Revocation removes historical outcome weighting until valid data is refreshed');
reset role;
insert into coaching_invitations(id,coach_request_id,organization_id,coach_id,requested_for_user_id,invited_by) values(coaching_test.uid(950),:'renewal_request',coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),coaching_test.uid(2));
set role authenticated;select coaching_test.login(4);
select coaching_scale_mutate('conflict',jsonb_build_object('coach_request_id',:'renewal_request','conflict_type','prior_relationship','description','Prior professional relationship for platform review')) as conflict_id \gset
select coaching_test.reject($$select coaching_mutate('invitation_response',jsonb_build_object('id',coaching_test.uid(950),'decision','interested'))$$,'Declared conflicts block accepting an opportunity until human review');
select coaching_test.login(1);
select coaching_scale_mutate('conflict_review',jsonb_build_object('id',:'conflict_id','status','cleared','reason','Human review completed; permitted with agreed boundaries'));
select coaching_test.login(4);
select coaching_mutate('invitation_response',jsonb_build_object('id',coaching_test.uid(950),'decision','interested'));
select coaching_test.assert((select x->>'status' from jsonb_array_elements(coaching_opportunities()) x where x->>'id'=coaching_test.uid(950)::text)='interested','Human clearance restores the existing invitation workflow');
select coaching_scale_mutate('application',jsonb_build_object('display_name','Coach A','status','submitted')) as application_id \gset
select coaching_test.assert(coaching_scale_read()->'applications'->0->>'status'='submitted','Coach submits an application');
select coaching_test.login(1);
select coaching_scale_mutate('agreement_publish',jsonb_build_object('version','TEST-1','title','Fictional marketplace agreement','terms','Fictional terms reviewed by platform.')) as agreement_id \gset
select coaching_scale_mutate('training_assign',jsonb_build_object('coach_id',coaching_test.uid(104),'title','Privacy orientation','instructions','Complete fictional orientation')) as training_id \gset
select coaching_test.login(4);
select coaching_scale_mutate('agreement_accept',jsonb_build_object('id',:'agreement_id','attest',true));
select coaching_scale_mutate('training_complete',jsonb_build_object('id',:'training_id'));
select coaching_test.login(1);
select coaching_scale_mutate('training_verify',jsonb_build_object('id',:'training_id'));
select coaching_test.assert((select x->'readiness'->>'orientation' from jsonb_array_elements(coaching_scale_read()->'coaches') x where x->>'id'=coaching_test.uid(104)::text)='true','Orientation requires completion and platform verification');
select coaching_scale_mutate('retention',jsonb_build_object('record_category','commercial_records','disposition','review','legal_basis','Review contractual and legal requirements before any action'));
select coaching_test.login(4);
select coaching_scale_mutate('privacy_request',jsonb_build_object('subject_user_id',coaching_test.uid(4),'action','restrict_processing','categories',jsonb_build_array('analytics'),'reason','Review processing request')) as privacy_id \gset
select coaching_test.login(1);
select coaching_test.reject(format('select coaching_scale_mutate(''privacy_review'',jsonb_build_object(''id'',%L,''status'',''completed'',''decision_reason'',''Reviewed''))',:'privacy_id'),'Privacy completion requires documented execution');
rollback;
