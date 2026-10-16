begin;
create table public.affiliate_referral_conversions (
 organization_id uuid primary key references organizations(id),
 invoice_id text not null,
 billing_period_start timestamptz not null
);
alter table public.affiliate_referral_conversions enable row level security;
revoke all on public.affiliate_referral_conversions from public,anon,authenticated;
grant all on public.affiliate_referral_conversions to service_role;
alter table affiliate_connect_accounts add column onboarding_started_at timestamptz;
update affiliate_connect_accounts set onboarding_started_at=requested_at;
create or replace function public.protect_affiliate_payout_contact() returns trigger
language plpgsql set search_path=public as $$
begin
 if (new.payout_email,new.payout_country) is distinct from (old.payout_email,old.payout_country)
 and exists(select 1 from affiliate_connect_accounts where affiliate_id=old.id and (account_id is not null or onboarding_started_at is not null)) then
  raise exception 'Payout contact is locked after Stripe setup starts';
 end if;
 return new;
end $$;
create function public.begin_affiliate_connect(affiliate uuid, live boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r affiliate_connect_accounts;
begin
 insert into affiliate_connect_accounts(affiliate_id,livemode) values(affiliate,live) on conflict do nothing;
 select * into r from affiliate_connect_accounts where affiliate_id=affiliate and livemode=live for update;
 if r.onboarding_started_at is null then
  update affiliate_connect_accounts set onboarding_started_at=now(),requested_at=now() where affiliate_id=affiliate and livemode=live returning * into r;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.begin_affiliate_connect(uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_affiliate_connect(uuid,boolean) to service_role;

-- Established initial commissions keep their renewal rights.
insert into affiliate_referral_conversions(organization_id,invoice_id,billing_period_start)
select distinct on(organization_id) organization_id,invoice_id,invoice_created_at from affiliate_earnings
where renewal_number=0 and commission_cents>0 and status in ('pending','payable','paid') order by organization_id,invoice_created_at;

alter table affiliate_earnings add column billing_period_start timestamptz,
 add column paid_commission_cents bigint,
 add column reversed_commission_cents bigint not null default 0,
 add column adjustment_cents bigint not null default 0,
 add column reconciliation_required boolean not null default false,
 add column payout_processing_started_at timestamptz,
 add column last_payout_error text;
update affiliate_earnings set paid_commission_cents=commission_cents where status='paid';
alter table affiliate_earnings drop constraint affiliate_earnings_status_check;
alter table affiliate_earnings add constraint affiliate_earnings_status_check check(status in ('pending','held','payable','processing','paid','reversed','disputed','awaiting_review','ineligible'));
create table affiliate_earning_events (
 id uuid primary key default gen_random_uuid(),invoice_id text not null references affiliate_earnings(invoice_id),
 event_key text not null unique,event_type text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table affiliate_earning_events enable row level security;
revoke all on affiliate_earning_events from public,anon,authenticated;
grant all on affiliate_earning_events to service_role;

create or replace function public.record_affiliate_earning(payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare r affiliate_earnings; oldrow affiliate_earnings; duplicate_period boolean;
begin
 r:=jsonb_populate_record(null::affiliate_earnings,payload);
 perform 1 from organizations where id=r.organization_id and affiliate_id=r.affiliate_id for update;
 if not found then raise exception 'Affiliate attribution mismatch'; end if;
 -- An account reservation is bookkeeping only; it does not start Stripe onboarding.
 insert into affiliate_connect_accounts(affiliate_id,livemode) values(r.affiliate_id,r.livemode) on conflict do nothing;
 select * into oldrow from affiliate_earnings where invoice_id=r.invoice_id for update;
 if found and (oldrow.payout_transfer_id is not null or oldrow.status='processing') then
  update affiliate_earnings set adjustment_cents=r.commission_cents-coalesce(oldrow.paid_commission_cents,oldrow.commission_cents)+oldrow.reversed_commission_cents,
   reconciliation_required=(r.commission_cents<>coalesce(oldrow.paid_commission_cents,oldrow.commission_cents)-oldrow.reversed_commission_cents or r.status='held'),
   checked_at=r.checked_at,reason=case when r.commission_cents<>coalesce(oldrow.paid_commission_cents,oldrow.commission_cents)-oldrow.reversed_commission_cents or r.status='held' then 'Recorded payout retained. Payment adjustment requires administrator reconciliation.' else oldrow.reason end
   where invoice_id=r.invoice_id;
  insert into affiliate_earning_events(invoice_id,event_key,event_type,details)
   values(r.invoice_id,r.invoice_id||':assessment:'||r.status||':'||r.commission_cents,'payment_reassessed',jsonb_build_object('assessed_commission_cents',r.commission_cents,'reason',r.reason)) on conflict do nothing;
  return;
 end if;
 select exists(select 1 from affiliate_earnings where organization_id=r.organization_id and livemode=r.livemode and renewal_number=r.renewal_number and invoice_id<>r.invoice_id) into duplicate_period;
 if duplicate_period then
  r.status:='held';r.commission_cents:=0;r.reason:='Multiple invoices for this annual period require reconciliation.';
  update affiliate_earnings set status=case when payout_transfer_id is null and status<>'processing' then 'held' else status end,
   reconciliation_required=case when payout_transfer_id is not null or status='processing' then true else reconciliation_required end,
   reason=r.reason where organization_id=r.organization_id and livemode=r.livemode and renewal_number=r.renewal_number;
 end if;
 insert into affiliate_earnings(invoice_id,affiliate_id,organization_id,subscription_id,livemode,currency,eligible_cents,commission_cents,rate_bps,renewal_number,status,reason,charge_ids,invoice_created_at,checked_at,hold_until,billing_period_start)
 values(r.invoice_id,r.affiliate_id,r.organization_id,r.subscription_id,r.livemode,r.currency,r.eligible_cents,r.commission_cents,r.rate_bps,r.renewal_number,r.status,r.reason,r.charge_ids,r.invoice_created_at,r.checked_at,r.hold_until,r.billing_period_start)
 on conflict(invoice_id) do update set eligible_cents=excluded.eligible_cents,commission_cents=excluded.commission_cents,rate_bps=excluded.rate_bps,renewal_number=excluded.renewal_number,
 status=case when affiliate_earnings.status='payable' and excluded.status='pending' and excluded.hold_until<=now() then 'payable' else excluded.status end,
 reason=excluded.reason,charge_ids=excluded.charge_ids,checked_at=excluded.checked_at,hold_until=excluded.hold_until,billing_period_start=excluded.billing_period_start;
 if r.status='pending' and r.renewal_number=0 and r.billing_period_start is not null then
  insert into affiliate_referral_conversions(organization_id,invoice_id,billing_period_start) values(r.organization_id,r.invoice_id,r.billing_period_start) on conflict do nothing;
 end if;
end $$;

create function public.reserve_affiliate_payout(invoice text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e affiliate_earnings; a affiliate_connect_accounts;
begin
 if not exists(select 1 from profiles where auth_user_id=actor and role='system_admin' and deleted_at is null) then raise exception 'Platform administrator required';end if;
 select * into e from affiliate_earnings where invoice_id=invoice for update;
 if not found or e.payout_transfer_id is not null or e.reconciliation_required or e.status not in ('payable','processing') or e.commission_cents<=0 or e.hold_until>now() then raise exception 'Commission unavailable for payout';end if;
 select * into a from affiliate_connect_accounts where affiliate_id=e.affiliate_id and livemode=e.livemode;
 if a.account_id is null or not a.details_submitted or not a.payouts_enabled or not a.transfers_active then raise exception 'Stripe payout account is not ready';end if;
 if e.status='processing' and e.payout_processing_started_at<now()-interval '23 hours' then raise exception 'Payout retry window ended; reconcile with Stripe before retrying';end if;
 update affiliate_earnings set status='processing',payout_processing_started_at=coalesce(payout_processing_started_at,now()),payout_approved_by=actor,payout_approved_at=coalesce(payout_approved_at,now()),payout_attempts=payout_attempts+1,last_payout_error=null where invoice_id=invoice;
 return to_jsonb(e)||jsonb_build_object('account_id',a.account_id);
end $$;
create function public.finish_affiliate_payout(invoice text, transfer text, amount bigint default null) returns void
language plpgsql security definer set search_path=public as $$
declare e affiliate_earnings;
begin
 select * into e from affiliate_earnings where invoice_id=invoice for update;
 if e.payout_transfer_id is not null then
  if e.payout_transfer_id=transfer and coalesce(amount,e.paid_commission_cents)=e.paid_commission_cents then return; end if;
  raise exception 'A different payout receipt is already recorded';
 end if;
 update affiliate_earnings set status='paid',payout_transfer_id=transfer,paid_at=coalesce(paid_at,now()),paid_commission_cents=coalesce(amount,commission_cents),adjustment_cents=adjustment_cents+commission_cents-coalesce(amount,commission_cents),reconciliation_required=reconciliation_required or commission_cents<>coalesce(amount,commission_cents),
 reason=case when reconciliation_required then reason else 'Stripe transfer completed.' end,last_payout_error=null
 where invoice_id=invoice and (payout_transfer_id is null and status in ('processing','payable','held','awaiting_review') or payout_transfer_id=transfer);
 if not found then raise exception 'Payout reservation missing';end if;
 insert into affiliate_earning_events(invoice_id,event_key,event_type,details) values(invoice,transfer,'payout_transferred',jsonb_build_object('transfer_id',transfer)) on conflict do nothing;
end $$;
create function public.finish_affiliate_reversal(invoice text, reversal text, amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare inserted uuid;
begin
 insert into affiliate_earning_events(invoice_id,event_key,event_type,details) values(invoice,reversal,'transfer_reversed',jsonb_build_object('amount_cents',amount)) on conflict do nothing returning id into inserted;
 if inserted is not null then
  update affiliate_earnings set reversed_commission_cents=reversed_commission_cents+amount,adjustment_cents=adjustment_cents+amount,
   reconciliation_required=(adjustment_cents+amount<>0),reversed_at=now() where invoice_id=invoice;
 end if;
end $$;
revoke all on function public.reserve_affiliate_payout(text,uuid),public.finish_affiliate_payout(text,text,bigint),public.finish_affiliate_reversal(text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_affiliate_payout(text,uuid),public.finish_affiliate_payout(text,text,bigint),public.finish_affiliate_reversal(text,text,bigint) to service_role;
commit;
