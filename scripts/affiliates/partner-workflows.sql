-- Disposable database only, after the coaching/affiliate migrations and fixture bootstrap.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check(ok boolean,label text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception 'Failed: %',label;end if;end $$;
create function pg_temp.denied(query text,label text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then return; end;
 raise exception 'Missing rejection: %',label;
end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','platform@example.invalid',now()),
 ('22222222-2222-4222-8222-222222222222','partner@example.invalid',now()),
 ('33333333-3333-4333-8333-333333333333','coach@example.invalid',now()),
 ('44444444-4444-4444-8444-444444444444','other@example.invalid',now()),
 ('55555555-5555-4555-8555-555555555555','company@example.invalid',now());
insert into organizations(id,name) values('11111111-0000-4000-8000-000000000000','Fixture company');
insert into profiles(auth_user_id,organization_id,role,full_name) values
 ('11111111-1111-4111-8111-111111111111','11111111-0000-4000-8000-000000000000','system_admin','Platform'),
 ('55555555-5555-4555-8555-555555555555','11111111-0000-4000-8000-000000000000','hospital_admin','Company');
insert into partner_applications(id,auth_user_id,organization_name,contact_name,email) values
 ('22222222-0000-4000-8000-000000000000','22222222-2222-4222-8222-222222222222','Fixture Partner','Partner Owner','partner@example.invalid');
select pg_temp.denied($$select review_partner_application('22222222-0000-4000-8000-000000000000','approved','55555555-5555-4555-8555-555555555555')$$,'company cannot approve partners');
select review_partner_application('22222222-0000-4000-8000-000000000000','approved','11111111-1111-4111-8111-111111111111');
select review_partner_application('22222222-0000-4000-8000-000000000000','approved','11111111-1111-4111-8111-111111111111');
select pg_temp.check((select count(*)=1 from affiliates),'approval retry creates one affiliate');
select pg_temp.check((select initial_bps=0 and published_branding is null and agreement_accepted_at is null from affiliates),'approval does not invent rates or publish an agreement');
select affiliate_id as aid from partner_applications \gset
select pg_temp.check(affiliate_member_role(:'aid','22222222-2222-4222-8222-222222222222')='owner','explicit owner membership');
update affiliates set payout_email='different@example.invalid' where id=:'aid';
select pg_temp.check(affiliate_member_role(:'aid','22222222-2222-4222-8222-222222222222')='owner','payment email changes preserve ownership');
select review_partner_application('22222222-0000-4000-8000-000000000000','suspended','11111111-1111-4111-8111-111111111111');
select pg_temp.check(affiliate_member_role(:'aid','22222222-2222-4222-8222-222222222222') is null,'suspension blocks membership');
select review_partner_application('22222222-0000-4000-8000-000000000000','approved','11111111-1111-4111-8111-111111111111');
select link_partner_coach('22222222-0000-4000-8000-000000000000','33333333-3333-4333-8333-333333333333','Coach Example','coach@example.invalid','Leadership');
update coach_profiles set full_bio='Existing biography' where user_id='33333333-3333-4333-8333-333333333333';
select link_partner_coach('22222222-0000-4000-8000-000000000000','33333333-3333-4333-8333-333333333333','Changed name','coach@example.invalid','Other');
select pg_temp.check((select count(*)=1 from coach_profiles),'coach invitations reuse one profile');
select pg_temp.check((select full_bio='Existing biography' from coach_profiles),'invitation does not overwrite profile');
select pg_temp.check((select count(*)=1 from partner_coaches),'retry preserves one roster entry');
select id as roster from partner_coaches \gset
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
select pg_temp.denied(format('select confirm_partner_coach(%L,true)',:'roster'),'other user cannot accept affiliation');
select pg_temp.check(not coaching_preview_allowed(),'unassigned outsider cannot open coaching');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select pg_temp.check(coaching_preview_allowed(),'verified invited coach can onboard');
select pg_temp.check(partner_complete_coach_onboarding()=(select id from coach_profiles where user_id=auth.uid()),'signed-in coach onboarding resolves canonical profile');
select confirm_partner_coach(:'roster',true);
select pg_temp.check(jsonb_array_length(partner_marketplace_affiliations())=0,'draft coach is not published');
update coach_profiles set profile_status='approved',marketplace_status='approved',approved_at=now();
select pg_temp.check(jsonb_array_length(partner_marketplace_affiliations())=1,'approved coach shows accepted partner affiliation');
select confirm_partner_coach(:'roster',false);
select pg_temp.check(jsonb_array_length(partner_marketplace_affiliations())=0,'leaving roster removes partner badge');
select link_partner_coach('22222222-0000-4000-8000-000000000000','33333333-3333-4333-8333-333333333333','Coach Example','coach@example.invalid','Leadership');
select pg_temp.check((select invitation_status='invited' from partner_coaches),'reinviting a former coach requires fresh acceptance');
select pg_temp.check(jsonb_array_length(partner_marketplace_affiliations())=0,'reinvitation does not publish affiliation automatically');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
select pg_temp.check(coaching_preview_allowed(),'verified company admin can browse coaching');
select pg_temp.check(not has_function_privilege('authenticated','review_partner_application(uuid,text,uuid,text)','execute'),'partner approval is service-only');
select pg_temp.check(not has_table_privilege('authenticated','affiliate_memberships','select'),'membership records are not exposed directly');

update affiliates set published_branding=draft_branding,agreement_accepted_at=now(),initial_bps=2000,renewal_bps=1000,payout_country='US' where id=:'aid';
insert into organizations(id,name,affiliate_id) values('66666666-0000-4000-8000-000000000000','Referred company',:'aid');
select record_affiliate_earning(jsonb_build_object('invoice_id','fixture_invoice','affiliate_id',:'aid','organization_id','66666666-0000-4000-8000-000000000000','subscription_id','fixture_sub','livemode',true,'currency','usd','eligible_cents',100000,'commission_cents',20000,'rate_bps',2000,'renewal_number',0,'status','pending','reason','Verified fixture receipt','charge_ids',jsonb_build_array('fixture_charge'),'invoice_created_at',now()-interval '20 days','checked_at',now(),'hold_until',now()-interval '6 days','billing_period_start',now()-interval '20 days'));
select pg_temp.check((select count(*)=1 from affiliate_referral_conversions),'initial payment establishes renewal anchor');
update affiliates set payout_country='CA' where id=:'aid';
select pg_temp.check((select onboarding_started_at is null from affiliate_connect_accounts),'ledger placeholder does not start Stripe onboarding');
select begin_affiliate_connect(:'aid',true);
select pg_temp.denied(format('update affiliates set payout_country=''GB'' where id=%L',:'aid'),'onboarding locks payout contact');
update affiliate_connect_accounts set account_id='fixture_account',details_submitted=true,payouts_enabled=true,transfers_active=true;
update affiliate_earnings set status='payable' where invoice_id='fixture_invoice';
select pg_temp.denied($$select reserve_affiliate_payout('fixture_invoice','55555555-5555-4555-8555-555555555555')$$,'company cannot authorize money movement');
select reserve_affiliate_payout('fixture_invoice','11111111-1111-4111-8111-111111111111')->>'payout_retry_key' as payout_key \gset
select pg_temp.check(reserve_affiliate_payout('fixture_invoice','11111111-1111-4111-8111-111111111111')->>'payout_retry_key'=:'payout_key','processing retries preserve their provider request key');
select pg_temp.check(not reject_affiliate_payout('fixture_invoice','different-request','req_wrong'),'stale rejection cannot release a reservation');
select pg_temp.check(reject_affiliate_payout('fixture_invoice',:'payout_key','req_insufficient'),'definitive rejection releases the matching reservation');
select pg_temp.check((select status='payable' and payout_retry_key<>:'payout_key' and payout_processing_started_at is null from affiliate_earnings where invoice_id='fixture_invoice'),'rejected request is retired before another approval');
select pg_temp.check(not reject_affiliate_payout('fixture_invoice',:'payout_key','req_insufficient'),'duplicate rejection cannot retire another key');
select pg_temp.check(not has_function_privilege('authenticated','reject_affiliate_payout(text,text,text)','execute'),'provider rejection receipts are service-only');
select reserve_affiliate_payout('fixture_invoice','11111111-1111-4111-8111-111111111111');
select pg_temp.check(not reject_affiliate_payout('fixture_invoice',:'payout_key','req_late'),'late rejection cannot release a newer processing request');
select finish_affiliate_payout('fixture_invoice','fixture_transfer');
select finish_affiliate_payout('fixture_invoice','fixture_transfer');
select pg_temp.check((select count(*)=1 from affiliate_earning_events where event_type='payout_transferred'),'payout receipt is idempotent');
select record_affiliate_earning(jsonb_build_object('invoice_id','fixture_invoice','affiliate_id',:'aid','organization_id','66666666-0000-4000-8000-000000000000','subscription_id','fixture_sub','livemode',true,'currency','usd','eligible_cents',50000,'commission_cents',10000,'rate_bps',2000,'renewal_number',0,'status','pending','reason','Partial refund','charge_ids',jsonb_build_array('fixture_charge'),'invoice_created_at',now()-interval '20 days','checked_at',now()));
select pg_temp.check((select status='paid' and paid_commission_cents=20000 and adjustment_cents=-10000 and reconciliation_required from affiliate_earnings),'refund preserves payout and creates adjustment');
select finish_affiliate_reversal('fixture_invoice','fixture_reversal',10000);
select finish_affiliate_reversal('fixture_invoice','fixture_reversal',10000);
select pg_temp.check((select reversed_commission_cents=10000 and adjustment_cents=0 and not reconciliation_required from affiliate_earnings),'reversal is recorded exactly once');
select pg_temp.denied($$select reserve_affiliate_payout('fixture_invoice','11111111-1111-4111-8111-111111111111')$$,'paid commission cannot reopen');
select 'Partner and payout workflow checks passed' as result;
rollback;
