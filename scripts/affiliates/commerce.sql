-- Disposable local database only, following foundation.sql and commerce migration.
begin;
select public.record_affiliate_earning(jsonb_build_object('invoice_id','in_test','affiliate_id','11111111-1111-4111-8111-111111111111','organization_id','22222222-2222-4222-8222-222222222222','subscription_id','sub_test','livemode',false,'currency','usd','eligible_cents',300000,'commission_cents',60000,'rate_bps',2000,'renewal_number',0,'status','awaiting_review','reason','test','charge_ids','[]'::jsonb,'invoice_created_at',now(),'checked_at',now()));
select public.record_affiliate_earning(to_jsonb(e)) from public.affiliate_earnings e where invoice_id='in_test';
do $$ begin
 if (select count(*) from public.affiliate_earnings where invoice_id='in_test')<>1 then raise exception 'Duplicate event counted twice'; end if;
end $$;
select public.record_affiliate_earning(to_jsonb(e)||'{"invoice_id":"in_duplicate"}'::jsonb) from public.affiliate_earnings e where invoice_id='in_test';
do $$ begin
 if exists(select 1 from public.affiliate_earnings where status<>'held' or commission_cents<>0) then raise exception 'Duplicate annual invoice was not held'; end if;
 if has_function_privilege('authenticated','public.record_affiliate_earning(jsonb)','EXECUTE') then raise exception 'Client can write earnings'; end if;
end $$;
update public.affiliates set payout_email='owner@example.invalid',payout_country='US' where id='11111111-1111-4111-8111-111111111111';
insert into public.affiliate_connect_accounts(affiliate_id,livemode) values('11111111-1111-4111-8111-111111111111',false);
do $$ begin
 begin
  update public.affiliates set payout_email='attacker@example.invalid' where id='11111111-1111-4111-8111-111111111111';
  raise exception 'Expected locked payout contact';
 exception when raise_exception then if SQLERRM <> 'Payout contact is locked after Stripe setup starts' then raise; end if; end;
end $$;
rollback;
select 'Commerce database checks passed' as result;
