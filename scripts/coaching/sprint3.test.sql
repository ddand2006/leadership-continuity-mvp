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
insert into organization_features(organization_id,feature_key,status) values(coaching_test.uid(101),'coaching','active');
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,title,created_by) values(coaching_test.uid(601),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'Commerce test engagement',coaching_test.uid(2));
set role authenticated;
select coaching_test.login(1);
select coaching_commerce_mutate('settings',jsonb_build_object('marketplace_pricing','request_quote','payout_policy','manual','compensation_trigger','coach_confirmed','revenue_model','markup','platform_fee',0,'agreement_version','test-1','agreement_text','Fictional test agreement. Organization authorizes coaching delivery. Cancellation reviewed by platform.','coach_terms','Fictional coach terms. Completed documented sessions are eligible for compensation.','terms_ready',true));
select coaching_commerce_mutate('package',jsonb_build_object('name','Test 6 Month','pricing_model','fixed_package','base_price',3000,'included_sessions',12,'included_hours',12,'duration_months',6,'session_duration_minutes',60,'active',true,'publicly_visible',true)) as package_id \gset
select coaching_commerce_mutate('rate',jsonb_build_object('coach_id',coaching_test.uid(104),'compensation_model','per_session','rate',175,'effective_start_date',current_date)) as rate_id \gset
select coaching_commerce_mutate('pricing',jsonb_build_object('organization_id',coaching_test.uid(101),'package_id',:'package_id','pricing_model','fixed_package','price',2800,'effective_start_date',current_date));
select coaching_commerce_mutate('quote',jsonb_build_object('engagement_id',coaching_test.uid(601),'package_id',:'package_id','billing_model','monthly','valid_until',current_date+14,'custom_price',1)) as quote_id \gset
select set_config('coaching_test.quote',:'quote_id',false);
select coaching_test.assert(coaching_commerce_read('admin')->'coaching_quotes'->0->>'total_amount'='2800.00','Organization override wins over package and untrusted custom amount');
select coaching_commerce_mutate('quote_send',jsonb_build_object('id',:'quote_id'));
select coaching_test.login(3);
select coaching_test.assert(coaching_commerce_read('billing')->'coaching_quotes'='[]'::jsonb,'Organization B cannot read Organization A quote');
select coaching_test.reject($$select coaching_commerce_mutate('quote_accept',jsonb_build_object('id',current_setting('coaching_test.quote')))$$,'Organization B cannot accept another organization quote');
select coaching_test.login(6);
select coaching_test.reject($$select coaching_commerce_read('billing')$$,'Coachee cannot read financial data');
select coaching_test.reject($$select * from coaching_payments$$,'Direct payment REST is denied');
select coaching_test.login(2);
select coaching_test.assert(coaching_commerce_read('marketplace')->'packages'='[]'::jsonb,'Request-quote marketplace mode hides prices at API level');
select coaching_test.assert(coaching_commerce_read('billing')::text not like '%compensation_snapshot%' and coaching_commerce_read('billing')->'coaching_platform_revenue'='[]'::jsonb,'Buyer cannot retrieve compensation or platform revenue');
select coaching_commerce_mutate('quote_accept',jsonb_build_object('id',:'quote_id')) as agreement_id \gset
select set_config('coaching_test.agreement',:'agreement_id',false);
select coaching_test.reject($$select coaching_commerce_mutate('agreement_accept',jsonb_build_object('id',current_setting('coaching_test.agreement'),'name','Valid Name','title','CEO'))$$,'Missing attestation checkbox cannot bypass server validation');
select coaching_commerce_mutate('agreement_accept',jsonb_build_object('id',:'agreement_id','name','Authorized Buyer','title','CEO','attest',true));
select coaching_test.assert(jsonb_array_length(coaching_commerce_read('billing')->'coaching_billing_schedule')=6,'Monthly schedule created');
select coaching_commerce_mutate('agreement_accept',jsonb_build_object('id',:'agreement_id','name','Authorized Buyer','title','CEO','attest',true));
select coaching_test.assert(jsonb_array_length(coaching_commerce_read('billing')->'coaching_billing_schedule')=6,'Repeated acceptance cannot duplicate installments');
select coaching_test.assert((select sum((v->>'amount')::numeric) from jsonb_array_elements(coaching_commerce_read('billing')->'coaching_billing_schedule') v)=2800,'Installment rounding preserves exact quote total');
select coaching_test.login(4);
select coaching_test.assert(coaching_commerce_read('earnings')::text not like '%organization_price%' and coaching_commerce_read('earnings')->'coaching_platform_revenue'='[]'::jsonb,'Coach cannot retrieve buyer price or platform margin');
select coaching_commerce_mutate('coach_accept',jsonb_build_object('id',:'agreement_id','name','Coach A','title','Coach','attest',true));
select coaching_test.login(1);
select coaching_commerce_mutate('package',jsonb_build_object('id',:'package_id','name','Test 6 Month','pricing_model','fixed_package','base_price',9000,'included_sessions',12,'included_hours',12,'duration_months',6,'active',true));
select coaching_test.assert(coaching_commerce_read('admin')->'coaching_commercial_agreements'->0->>'organization_price'='2800.00','Package edits do not change accepted agreement');
select coaching_test.login(2);
select (v->>'id') as installment_id from jsonb_array_elements(coaching_commerce_read('billing')->'coaching_billing_schedule') v order by (v->>'installment_number')::int limit 1 \gset
select coaching_commerce_mutate('payment_prepare',jsonb_build_object('id',:'installment_id','amount',1)) as payment_id \gset
select set_config('coaching_test.payment',:'payment_id',false);
select coaching_test.assert(coaching_commerce_read('billing')->'coaching_payments'->0->>'amount'='466.67','Payment amount derives from frozen installment');
select coaching_test.reject($$select coaching_commerce_provider('event','{}')$$,'Authenticated users cannot forge provider events');
select coaching_test.login(6);
select coaching_mutate('consent',jsonb_build_object('engagement_id',coaching_test.uid(601),'consent_type','coaching_record_retention','consent_given',true));
select coaching_test.login(2);
select coaching_test.reject($$select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',coaching_test.uid(601),'status','active'))$$,'Commercial gate blocks unpaid activation despite coaching consent');
reset role;
set role service_role;
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_success','event_type','payment_intent.succeeded','payment_id',:'payment_id','payment_intent_id','pi_test','amount',466.67,'currency','usd','paid',true,'paid_at',now()));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_success','event_type','payment_intent.succeeded','payment_id',:'payment_id','payment_intent_id','pi_test','amount',466.67,'currency','usd','paid',true,'paid_at',now()));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_checkout','event_type','checkout.session.completed','payment_id',:'payment_id','amount',466.67,'currency','usd','paid',true,'paid_at',now()));
reset role;
select coaching_test.assert((select count(*) from coaching_platform_revenue where payment_id=:'payment_id')=1,'Duplicate and distinct success events record payment once');
select coaching_test.assert((select commercial_status from coaching_commercial_controls where engagement_id=coaching_test.uid(601))='active','Paid current monthly installment clears commercial gate');
select coaching_test.reject($$update coaching_commercial_agreements set organization_price=1 where engagement_id=coaching_test.uid(601)$$,'Frozen agreement protected even from accidental privileged edit');
set role authenticated;
select coaching_test.login(2);
select coaching_mutate('engagement_status',jsonb_build_object('engagement_id',coaching_test.uid(601),'status','active'));
reset role;
insert into coaching_sessions(id,engagement_id,coach_id,coachee_user_id,session_date,status) values(coaching_test.uid(701),coaching_test.uid(601),coaching_test.uid(104),coaching_test.uid(6),current_date,'scheduled');
select coaching_test.assert((select count(*) from coach_compensation_ledger)=0,'Scheduled session does not earn compensation');
update coaching_sessions set status='completed',actual_start_at=now()-interval '1 hour',actual_end_at=now(),coaching_category='individual',compensation_category='paid' where id=coaching_test.uid(701);
select coaching_test.assert((select count(*) from coach_compensation_ledger)=0,'Configured documentation confirmation required');
update coaching_sessions set coach_confirmed=true where id=coaching_test.uid(701);
update coaching_sessions set coach_confirmed=true where id=coaching_test.uid(701);
select coaching_test.assert((select count(*) from coach_compensation_ledger)=1 and (select net_amount from coach_compensation_ledger limit 1)=175,'Completed documented session earns exactly once at frozen rate');
select coaching_test.reject($$update coaching_sessions set actual_end_at=actual_end_at+interval '1 hour' where id=coaching_test.uid(701)$$,'Earned duration cannot silently change');
insert into coaching_notes(engagement_id,coach_id,coachee_user_id,title,content,created_by) values(coaching_test.uid(601),coaching_test.uid(104),coaching_test.uid(6),'Private','CONFIDENTIAL COACH NOTE',coaching_test.uid(4));
set role authenticated;
select coaching_test.login(2);
select coaching_test.assert((select count(*) from coaching_notes)=0,'Billing organization admin cannot read private coaching notes');
select coaching_test.assert(coaching_commerce_read('billing')::text not like '%CONFIDENTIAL%','Finance projections do not pull coaching content');
select coaching_commerce_mutate('refund_request',jsonb_build_object('id',:'payment_id','amount',100,'reason','Approved unused session refund','request_key',coaching_test.uid(801))) as refund_id \gset
select set_config('coaching_test.refund',:'refund_id',false);
select coaching_test.reject($$select coaching_commerce_mutate('refund_request',jsonb_build_object('id',current_setting('coaching_test.payment'),'amount',100,'reason','Retry','request_key',coaching_test.uid(801)))$$,'Refund request retry cannot create duplicate refund reservation');
select coaching_test.reject($$select coaching_commerce_mutate('refund_request',jsonb_build_object('id',current_setting('coaching_test.payment'),'amount',400,'reason','Over refund'))$$,'Concurrent pending refund reservations cap total');
select coaching_test.reject($$select coaching_commerce_mutate('refund_approve',jsonb_build_object('id',current_setting('coaching_test.refund')))$$,'Organization cannot approve own refund');
select coaching_test.login(1);
select coaching_commerce_mutate('refund_approve',jsonb_build_object('id',:'refund_id'));
reset role;set role service_role;
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_refund','event_type','refund.updated','refund_record_id',:'refund_id','refund_id','re_test','amount',100,'status','succeeded'));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_refund','event_type','refund.updated','refund_record_id',:'refund_id','refund_id','re_test','amount',100,'status','succeeded'));
reset role;
select coaching_test.assert((select sum(organization_revenue) from coaching_platform_revenue)=466.67 and (select sum(refund_amount) from coaching_platform_revenue)=100,'Refund adds reversal without deleting original receipt');
select coaching_test.assert((select status from coaching_payments where id=:'payment_id')='partially_refunded','Partial refund preserves payment status');
select coaching_test.assert((select count(*) from coach_compensation_ledger)=1,'Refund does not silently claw back earned compensation');
set role authenticated;
select coaching_test.login(5);
select coaching_test.assert(coaching_commerce_read('earnings')->'coach_compensation_ledger'='[]'::jsonb and coaching_commerce_read('earnings')->'coaching_commercial_agreements'='[]'::jsonb,'Coach B cannot see Coach A financial records');
select coaching_test.reject($$select * from coaching_platform_revenue$$,'Platform ledger direct access denied');
select coaching_test.login(1);
select coaching_test.assert(jsonb_array_length(coaching_commerce_read('admin')->'coaching_platform_revenue')=3,'Platform sees payment, cost and refund ledger entries');

-- Remaining monthly installment: manual payment, fee arrival, failure ordering and payout tests.
select (v->>'id') as manual_installment from jsonb_array_elements(coaching_commerce_read('admin')->'coaching_billing_schedule') v where v->>'status'='pending' order by (v->>'installment_number')::int limit 1 \gset
select coaching_commerce_mutate('manual_payment',jsonb_build_object('id',:'manual_installment','amount',466.67,'date',current_date,'method','check','reference','CHECK-100','notes','Fictional received check')) as manual_payment \gset
select coaching_test.assert((select v->>'status' from jsonb_array_elements(coaching_commerce_read('admin')->'coaching_payments') v where v->>'id'=:'manual_payment')='paid','Manual payment creates normal paid record');
select (v->>'id') as earning_id from jsonb_array_elements(coaching_commerce_read('admin')->'coach_compensation_ledger') v limit 1 \gset
select coaching_commerce_mutate('approve_compensation',jsonb_build_object('id',:'earning_id'));
reset role;
insert into coach_payment_accounts(coach_id,stripe_connect_account_id,account_status,payouts_enabled) values(coaching_test.uid(104),'acct_test','active',true);
set role authenticated;select coaching_test.login(1);
select coaching_commerce_mutate('payout_prepare',jsonb_build_object('coach_id',coaching_test.uid(104))) as payout_id \gset
select coaching_test.reject($$select coaching_commerce_mutate('payout_prepare',jsonb_build_object('coach_id',coaching_test.uid(104)))$$,'Repeated payout preparation cannot duplicate approved balance');
reset role;set role service_role;
select coaching_commerce_provider('payout',jsonb_build_object('id',:'payout_id'));
select coaching_commerce_provider('payout_saved',jsonb_build_object('id',:'payout_id','transfer_id','tr_test'));
select coaching_commerce_provider('payout_saved',jsonb_build_object('id',:'payout_id','transfer_id','tr_test'));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_fee','event_type','payment_intent.succeeded','payment_id',:'payment_id','amount',466.67,'currency','usd','paid',true,'paid_at',now(),'fee',13.83));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_latefailure','event_type','payment_intent.payment_failed','payment_id',:'payment_id','amount',466.67,'currency','usd','failed',true));
select coaching_commerce_provider('event',jsonb_build_object('event_id','evt_wrongamount','event_type','payment_intent.succeeded','payment_id',:'payment_id','amount',1,'currency','usd','paid',true,'paid_at',now()));
reset role;
select coaching_test.assert((select status from coach_compensation_ledger where id=:'earning_id')='paid' and (select count(*) from coach_payouts)=1,'Payout completion pays reserved earnings once');
select coaching_test.assert((select sum(payment_processing_cost) from coaching_platform_revenue)=13.83,'Late processing fee recorded once without changing receipt');
select coaching_test.assert((select status from coaching_payments where id=:'payment_id')='partially_refunded','Out-of-order failure cannot regress successful payment');
select coaching_test.assert((select processing_status from payment_webhook_events where provider_event_id='evt_wrongamount')='failed','Incorrect provider amount rejected and logged for retry');
select coaching_test.assert((select count(*) from notifications where recipient_user_id=coaching_test.uid(6) and event_type in ('payment_failed','payment_required','refund_completed','invoice_past_due'))=0,'Payment issues never notify coachee');
select coaching_test.reject($$update coaching_platform_revenue set organization_revenue=0$$,'Revenue history is append-only');
select coaching_test.reject($$delete from coach_compensation_ledger$$,'Compensation history cannot be deleted');
set role authenticated;select coaching_test.login(2);
select coaching_test.reject($$select coaching_commerce_mutate('package',jsonb_build_object('name','Unauthorized'))$$,'Buyer cannot configure prices');
reset role;
update organizations set manual_access_status='payment_hold' where id=coaching_test.uid(101);
set role authenticated;select coaching_test.login(2);
select coaching_test.assert(jsonb_array_length(coaching_commerce_read('billing')->'coaching_payments')=2,'Billing remains accessible to resolve organization payment hold');
reset role;
update organizations set manual_access_status='active' where id=coaching_test.uid(101);
insert into coaching_engagements(id,organization_id,coach_id,coachee_user_id,title,created_by) values(coaching_test.uid(602),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'Hourly compensation',coaching_test.uid(2)),(coaching_test.uid(603),coaching_test.uid(101),coaching_test.uid(104),coaching_test.uid(6),'Fixed compensation',coaching_test.uid(2));
set role authenticated;select coaching_test.login(1);
select coaching_commerce_mutate('package',jsonb_build_object('name','Hourly test','pricing_model','per_hour','base_price',120,'included_sessions',2,'included_hours',2,'duration_months',1,'active',true)) as hourly_package \gset
select coaching_commerce_mutate('rate',jsonb_build_object('engagement_id',coaching_test.uid(602),'compensation_model','per_hour','rate',90,'effective_start_date',current_date));
select coaching_commerce_mutate('quote',jsonb_build_object('engagement_id',coaching_test.uid(602),'package_id',:'hourly_package','billing_model','per_session','valid_until',current_date+7)) as hourly_quote \gset
select coaching_commerce_mutate('quote_send',jsonb_build_object('id',:'hourly_quote'));
select coaching_test.login(2);
select coaching_commerce_mutate('quote_accept',jsonb_build_object('id',:'hourly_quote')) as hourly_agreement \gset
select coaching_commerce_mutate('agreement_accept',jsonb_build_object('id',:'hourly_agreement','name','Buyer','title','CEO','attest',true));
select coaching_test.login(4);
select coaching_commerce_mutate('coach_accept',jsonb_build_object('id',:'hourly_agreement','name','Coach','title','Coach','attest',true));
reset role;
insert into coaching_sessions(id,engagement_id,coach_id,coachee_user_id,session_date,status,actual_start_at,actual_end_at,coaching_category,compensation_category,coach_confirmed) values(coaching_test.uid(702),coaching_test.uid(602),coaching_test.uid(104),coaching_test.uid(6),current_date,'completed',now()-interval '90 minutes',now(),'individual','paid',true);
select coaching_test.assert((select net_amount from coach_compensation_ledger where session_id=coaching_test.uid(702))=135,'Hourly compensation uses actual verified duration at frozen rate');
select coaching_test.assert((select amount from coaching_billing_schedule where session_id=coaching_test.uid(702))=120,'Per-session billing is created only for verified completed session');
insert into coaching_sessions(id,engagement_id,coach_id,coachee_user_id,session_date,status) values(coaching_test.uid(703),coaching_test.uid(602),coaching_test.uid(104),coaching_test.uid(6),current_date,'cancelled');
set role authenticated;select coaching_test.login(1);
select coaching_commerce_mutate('disposition',jsonb_build_object('session_id',coaching_test.uid(703),'organization_charge_amount',20,'coach_compensation_amount',30,'reason','Documented late cancellation policy'));
select coaching_test.reject($$select coaching_commerce_mutate('disposition',jsonb_build_object('session_id',coaching_test.uid(703),'organization_charge_amount',20,'coach_compensation_amount',30,'reason','Duplicate disposition'))$$,'Cancellation disposition cannot be charged twice');
select coaching_commerce_mutate('rate',jsonb_build_object('engagement_id',coaching_test.uid(603),'compensation_model','fixed_engagement','rate',100,'effective_start_date',current_date));
select coaching_commerce_mutate('quote',jsonb_build_object('engagement_id',coaching_test.uid(603),'package_id',:'hourly_package','billing_model','custom','valid_until',current_date+7,'installments',jsonb_build_array(jsonb_build_object('amount',120,'due_date',current_date),jsonb_build_object('amount',120,'due_date',current_date+30)))) as fixed_quote \gset
select coaching_commerce_mutate('quote_send',jsonb_build_object('id',:'fixed_quote'));
select coaching_test.login(2);
select coaching_commerce_mutate('quote_accept',jsonb_build_object('id',:'fixed_quote')) as fixed_agreement \gset
select coaching_commerce_mutate('agreement_accept',jsonb_build_object('id',:'fixed_agreement','name','Buyer','title','CEO','attest',true));
select coaching_test.login(4);
select coaching_commerce_mutate('coach_accept',jsonb_build_object('id',:'fixed_agreement','name','Coach','title','Coach','attest',true));
reset role;
select coaching_test.assert((select sum(amount) from coaching_billing_schedule where agreement_id=:'fixed_agreement')=240,'Custom installments preserve contracted total');
update coaching_engagements set status='completed' where id=coaching_test.uid(603);
select coaching_test.assert((select net_amount from coach_compensation_ledger where engagement_id=coaching_test.uid(603))=100,'Fixed engagement compensation is earned at operational completion');
select coaching_test.assert((select net_amount from coach_compensation_ledger where session_id=coaching_test.uid(703))=30,'Cancellation compensation is separate from scheduled-session earnings');
set role authenticated;select coaching_test.login(1);
select coaching_test.reject($$select coaching_commerce_mutate('package',jsonb_build_object('name','Bad price','pricing_model','fixed_package','base_price','NaN'))$$,'Non-finite numeric prices are rejected');
rollback;
