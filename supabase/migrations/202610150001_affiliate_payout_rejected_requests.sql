begin;

-- A rejected Stripe v1 request stays cached under its idempotency key. Keep
-- uncertain requests stable, and retire a key only after a definitive rejection.
alter table public.affiliate_earnings add column payout_retry_key text;

create or replace function public.reserve_affiliate_payout(invoice text, actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e affiliate_earnings; a affiliate_connect_accounts; request_key text;
begin
 if not exists(select 1 from profiles where auth_user_id=actor and role='system_admin' and deleted_at is null) then raise exception 'Platform administrator required';end if;
 select * into e from affiliate_earnings where invoice_id=invoice for update;
 if not found or e.payout_transfer_id is not null or e.reconciliation_required or e.status not in ('payable','processing') or e.commission_cents<=0 or e.hold_until>now() then raise exception 'Commission unavailable for payout';end if;
 select * into a from affiliate_connect_accounts where affiliate_id=e.affiliate_id and livemode=e.livemode;
 if a.account_id is null or not a.details_submitted or not a.payouts_enabled or not a.transfers_active then raise exception 'Stripe payout account is not ready';end if;
 if e.status='processing' and e.payout_processing_started_at<now()-interval '23 hours' then raise exception 'Payout retry window ended; reconcile with Stripe before retrying';end if;
 -- Preserve the pre-migration key for already-started requests.
 request_key:=coalesce(e.payout_retry_key,'affiliate-payout-'||invoice);
 update affiliate_earnings set status='processing',payout_retry_key=request_key,payout_processing_started_at=coalesce(payout_processing_started_at,now()),payout_approved_by=actor,payout_approved_at=coalesce(payout_approved_at,now()),payout_attempts=payout_attempts+1,last_payout_error=null where invoice_id=invoice;
 return to_jsonb(e)||jsonb_build_object('account_id',a.account_id,'payout_retry_key',request_key);
end $$;

create function public.reject_affiliate_payout(invoice text, request_key text, stripe_request text) returns boolean
language plpgsql security definer set search_path=public as $$
declare e affiliate_earnings;
begin
 if request_key is null or stripe_request is null or stripe_request='' then raise exception 'Provider rejection receipt required';end if;
 select * into e from affiliate_earnings where invoice_id=invoice for update;
 if not found or e.status<>'processing' or e.payout_transfer_id is not null or e.payout_retry_key is distinct from request_key then return false;end if;
 insert into affiliate_earning_events(invoice_id,event_key,event_type,details)
 values(invoice,request_key||':rejected','payout_rejected',jsonb_build_object('code','balance_insufficient','request_key',request_key,'stripe_request_id',stripe_request,'approved_by',e.payout_approved_by));
 update affiliate_earnings set status='payable',payout_retry_key='affiliate-payout-'||invoice||'-'||gen_random_uuid()::text,
 payout_processing_started_at=null,payout_approved_at=null,payout_approved_by=null,
 last_payout_error='Stripe rejected this request because available funds were insufficient. Fund Stripe, then approve a new transfer request.'
 where invoice_id=invoice;
 return true;
end $$;

revoke all on function public.reject_affiliate_payout(text,text,text) from public,anon,authenticated;
grant execute on function public.reject_affiliate_payout(text,text,text) to service_role;
commit;
