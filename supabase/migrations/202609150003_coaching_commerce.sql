-- Commerce is isolated from coaching content. Existing engagements remain grandfathered until a quote is issued.
-- USD only in this release; no currency conversion. All amounts are exact decimal dollars.
begin;
create schema coaching_commerce_internal;
revoke all on schema coaching_commerce_internal from public,anon,authenticated;
create table public.coaching_packages(id uuid primary key default gen_random_uuid(), name text not null, slug text unique, description text, short_description text, pricing_model text not null check(pricing_model in ('fixed_package','per_session','per_hour','monthly','engagement','organization_contract','custom')), base_price numeric(12,2) check(base_price>=0), currency text not null default 'USD' check(currency='USD'), included_sessions integer check(included_sessions>0), included_hours numeric(8,2) check(included_hours>0), duration_months integer check(duration_months between 1 and 120), session_duration_minutes integer check(session_duration_minutes between 15 and 480), active boolean not null default true, publicly_visible boolean not null default false, cancellation_terms jsonb not null default '{}' check(jsonb_typeof(cancellation_terms)='object'), created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_packages enable row level security;
revoke all on public.coaching_packages from anon,authenticated;
grant all on public.coaching_packages to service_role;
create table public.coaching_package_components(id uuid primary key default gen_random_uuid(), package_id uuid not null references coaching_packages(id), component_type text not null, name text not null, description text, quantity numeric check(quantity>=0), unit text, included boolean not null default true, sort_order integer default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_package_components enable row level security;
revoke all on public.coaching_package_components from anon,authenticated;
grant all on public.coaching_package_components to service_role;
create table public.coach_commercial_profiles(id uuid primary key default gen_random_uuid(), coach_id uuid not null unique references coach_profiles(id), default_hourly_rate numeric(12,2) check(default_hourly_rate>=0), default_session_rate numeric(12,2) check(default_session_rate>=0), preferred_compensation_model text, minimum_engagement_amount numeric(12,2) check(minimum_engagement_amount>=0), currency text not null default 'USD' check(currency='USD'), payment_status text not null default 'not_started', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coach_commercial_profiles enable row level security;
revoke all on public.coach_commercial_profiles from anon,authenticated;
grant all on public.coach_commercial_profiles to service_role;
create table public.coach_compensation_rules(id uuid primary key default gen_random_uuid(), coach_id uuid references coach_profiles(id), package_id uuid references coaching_packages(id), engagement_id uuid references coaching_engagements(id), compensation_model text not null check(compensation_model in ('per_hour','per_session','fixed_engagement','percentage','custom')), rate numeric(12,2) not null default 0 check(rate>=0), percentage numeric(5,2) check(percentage between 0 and 100), effective_start_date date not null, effective_end_date date, active boolean not null default true, created_by uuid, check(effective_end_date is null or effective_end_date>=effective_start_date), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coach_compensation_rules enable row level security;
revoke all on public.coach_compensation_rules from anon,authenticated;
grant all on public.coach_compensation_rules to service_role;
create table public.organization_coaching_pricing(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), package_id uuid references coaching_packages(id), pricing_model text not null, price numeric(12,2) not null check(price>=0), currency text not null default 'USD' check(currency='USD'), effective_start_date date not null, effective_end_date date, notes text, active boolean not null default true, created_by uuid, check(effective_end_date is null or effective_end_date>=effective_start_date), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.organization_coaching_pricing enable row level security;
revoke all on public.organization_coaching_pricing from anon,authenticated;
grant all on public.organization_coaching_pricing to service_role;
create table public.coaching_discounts(id uuid primary key default gen_random_uuid(), organization_id uuid references organizations(id), code text unique, name text not null, discount_type text not null check(discount_type in ('fixed_amount','percentage')), discount_value numeric not null check(discount_value>=0), start_date date not null, end_date date, max_uses integer check(max_uses>0), active boolean not null default true, check(discount_type<>'percentage' or discount_value<=100), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_discounts enable row level security;
revoke all on public.coaching_discounts from anon,authenticated;
grant all on public.coaching_discounts to service_role;
create table public.coaching_quotes(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), coach_request_id uuid references coach_requests(id), engagement_id uuid not null references coaching_engagements(id), coach_id uuid not null references coach_profiles(id), package_id uuid references coaching_packages(id), pricing_model text not null, subtotal numeric(12,2) not null check(subtotal>=0), discount_amount numeric(12,2) not null default 0 check(discount_amount>=0), tax_amount numeric(12,2) not null default 0 check(tax_amount>=0), total_amount numeric(12,2) not null check(total_amount>=0), currency text not null default 'USD' check(currency='USD'), included_sessions integer, included_hours numeric(8,2), duration_months integer, valid_until date not null, status text not null default 'draft' check(status in ('draft','sent','viewed','accepted','declined','expired','cancelled')), snapshot jsonb not null, compensation_snapshot jsonb not null, discount_id uuid references coaching_discounts(id), created_by uuid, accepted_at timestamptz, accepted_by uuid, check(total_amount=subtotal-discount_amount+tax_amount), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_quotes enable row level security;
revoke all on public.coaching_quotes from anon,authenticated;
grant all on public.coaching_quotes to service_role;
create table public.coaching_commercial_agreements(id uuid primary key default gen_random_uuid(), engagement_id uuid not null unique references coaching_engagements(id), organization_id uuid not null references organizations(id), coach_id uuid not null references coach_profiles(id), quote_id uuid not null unique references coaching_quotes(id), agreement_version text not null, agreement_title text not null, agreement_text text not null, organization_price numeric(12,2) not null, coach_compensation_amount numeric(12,2), platform_expected_revenue numeric(12,2), currency text not null default 'USD' check(currency='USD'), billing_model text not null check(billing_model in ('pay_in_full','monthly','per_session','custom')), status text not null default 'pending_organization' check(status in ('draft','pending_organization','pending_coach','accepted','active','completed','cancelled','terminated')), organization_accepted_at timestamptz, organization_accepted_by uuid, coach_accepted_at timestamptz, coach_accepted_by uuid, effective_date date not null, expiration_date date, snapshot jsonb not null, compensation_snapshot jsonb not null, organization_attestation jsonb, coach_attestation jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_commercial_agreements enable row level security;
revoke all on public.coaching_commercial_agreements from anon,authenticated;
grant all on public.coaching_commercial_agreements to service_role;
create table public.organization_billing_accounts(id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references organizations(id), stripe_customer_id text unique, default_payment_method_id text, billing_email text, billing_name text, billing_status text not null default 'not_started', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.organization_billing_accounts enable row level security;
revoke all on public.organization_billing_accounts from anon,authenticated;
grant all on public.organization_billing_accounts to service_role;
create table public.coaching_payments(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), engagement_id uuid not null references coaching_engagements(id), agreement_id uuid not null references coaching_commercial_agreements(id), stripe_payment_intent_id text unique, stripe_invoice_id text unique, stripe_checkout_session_id text unique, checkout_url text, checkout_expires_at timestamptz, checkout_attempt integer not null default 1, amount numeric(12,2) not null check(amount>0), currency text not null default 'USD' check(currency='USD'), payment_type text not null default 'engagement', status text not null default 'pending' check(status in ('pending','processing','paid','failed','past_due','cancelled','refunded','partially_refunded')), due_date date, paid_at timestamptz, manual_method text, manual_reference text, manual_notes text, recorded_by uuid, processing_fee numeric(12,2), unique(organization_id,manual_method,manual_reference), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_payments enable row level security;
revoke all on public.coaching_payments from anon,authenticated;
grant all on public.coaching_payments to service_role;
create table public.coaching_billing_schedule(id uuid primary key default gen_random_uuid(), agreement_id uuid not null references coaching_commercial_agreements(id), installment_number integer not null check(installment_number>0), description text not null, billing_kind text not null default 'installment' check(billing_kind in ('installment','verified_session','adjustment')), amount numeric(12,2) not null check(amount>0), due_date date not null, status text not null default 'pending' check(status in ('pending','due','paid','cancelled')), payment_id uuid unique references coaching_payments(id), session_id uuid unique references coaching_sessions(id), unique(agreement_id,installment_number), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_billing_schedule enable row level security;
revoke all on public.coaching_billing_schedule from anon,authenticated;
grant all on public.coaching_billing_schedule to service_role;
create table public.coach_compensation_ledger(id uuid primary key default gen_random_uuid(), coach_id uuid not null references coach_profiles(id), engagement_id uuid not null references coaching_engagements(id), session_id uuid references coaching_sessions(id), agreement_id uuid not null references coaching_commercial_agreements(id), entry_type text not null check(entry_type in ('session','hour','engagement','bonus','adjustment','reversal')), gross_amount numeric(12,2) not null, adjustment_amount numeric(12,2) not null default 0, net_amount numeric(12,2) not null, currency text not null default 'USD' check(currency='USD'), status text not null default 'earned' check(status in ('pending','earned','approved','scheduled','paid','held','reversed')), earned_at timestamptz, approved_at timestamptz, paid_at timestamptz, source_key text not null unique, reason text, payout_id uuid, check(net_amount=gross_amount+adjustment_amount), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coach_compensation_ledger enable row level security;
revoke all on public.coach_compensation_ledger from anon,authenticated;
grant all on public.coach_compensation_ledger to service_role;
create table public.coach_payment_accounts(id uuid primary key default gen_random_uuid(), coach_id uuid not null unique references coach_profiles(id), stripe_connect_account_id text unique, account_status text not null default 'not_started' check(account_status in ('not_started','onboarding','pending_verification','active','restricted','disabled')), charges_enabled boolean not null default false, payouts_enabled boolean not null default false, onboarding_completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coach_payment_accounts enable row level security;
revoke all on public.coach_payment_accounts from anon,authenticated;
grant all on public.coach_payment_accounts to service_role;
create table public.coach_payouts(id uuid primary key default gen_random_uuid(), coach_id uuid not null references coach_profiles(id), stripe_transfer_id text unique, stripe_payout_reference text, amount numeric(12,2) not null check(amount>0), currency text not null default 'USD' check(currency='USD'), status text not null default 'pending' check(status in ('pending','processing','paid','failed','cancelled')), period_start date not null, period_end date not null, initiated_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coach_payouts enable row level security;
revoke all on public.coach_payouts from anon,authenticated;
grant all on public.coach_payouts to service_role;
create table public.coaching_platform_revenue(id uuid primary key default gen_random_uuid(), engagement_id uuid not null references coaching_engagements(id), payment_id uuid references coaching_payments(id), organization_revenue numeric(12,2) not null default 0, coach_cost numeric(12,2) not null default 0, payment_processing_cost numeric(12,2) not null default 0, refund_amount numeric(12,2) not null default 0, net_platform_revenue numeric(12,2) not null, currency text not null default 'USD' check(currency='USD'), recognized_at timestamptz not null default now(), source_key text not null unique, check(net_platform_revenue=organization_revenue-coach_cost-payment_processing_cost-refund_amount), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_platform_revenue enable row level security;
revoke all on public.coaching_platform_revenue from anon,authenticated;
grant all on public.coaching_platform_revenue to service_role;
create table public.coaching_invoices(id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), engagement_id uuid not null references coaching_engagements(id), agreement_id uuid not null references coaching_commercial_agreements(id), payment_id uuid unique references coaching_payments(id), stripe_invoice_id text unique, invoice_number text not null, invoice_date date not null, due_date date, subtotal numeric(12,2) not null, tax_amount numeric(12,2) not null default 0, total numeric(12,2) not null, status text not null check(status in ('draft','open','paid','past_due','void','uncollectible')), invoice_url text, invoice_pdf_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_invoices enable row level security;
revoke all on public.coaching_invoices from anon,authenticated;
grant all on public.coaching_invoices to service_role;
create table public.coaching_refunds(id uuid primary key default gen_random_uuid(), payment_id uuid not null references coaching_payments(id), engagement_id uuid not null references coaching_engagements(id), stripe_refund_id text unique, request_key uuid unique, amount numeric(12,2) not null check(amount>0), reason text not null, status text not null default 'requested' check(status in ('requested','approved','processing','completed','declined','failed')), requested_by uuid, approved_by uuid, processed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_refunds enable row level security;
revoke all on public.coaching_refunds from anon,authenticated;
grant all on public.coaching_refunds to service_role;
create table public.coaching_session_financial_dispositions(id uuid primary key default gen_random_uuid(), session_id uuid not null unique references coaching_sessions(id), organization_charge_amount numeric(12,2) not null check(organization_charge_amount>=0), coach_compensation_amount numeric(12,2) not null check(coach_compensation_amount>=0), disposition_reason text not null, status text not null default 'admin_review' check(status in ('admin_review','approved','declined')), reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_session_financial_dispositions enable row level security;
revoke all on public.coaching_session_financial_dispositions from anon,authenticated;
grant all on public.coaching_session_financial_dispositions to service_role;
create table public.payment_webhook_events(id uuid primary key default gen_random_uuid(), provider text not null default 'stripe', provider_event_id text not null unique, event_type text not null, processing_status text not null default 'pending', processed_at timestamptz, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon,authenticated;
grant all on public.payment_webhook_events to service_role;
create table public.coaching_commerce_settings(id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton), marketplace_pricing text not null default 'request_quote' check(marketplace_pricing in ('hidden','starting_price','package_prices','request_quote')), payout_policy text not null default 'manual' check(payout_policy in ('weekly','twice_monthly','monthly','manual')), compensation_trigger text not null default 'coach_confirmed' check(compensation_trigger in ('completed','coach_confirmed','both_confirmed')), revenue_model text not null default 'markup' check(revenue_model in ('markup','fixed_fee','percentage_fee','subscription_plus','custom')), platform_fee numeric(12,2) not null default 0 check(platform_fee>=0), agreement_version text not null default 'draft-1', agreement_text text not null default '', coach_terms text not null default '', terms_ready boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_commerce_settings enable row level security;
revoke all on public.coaching_commerce_settings from anon,authenticated;
grant all on public.coaching_commerce_settings to service_role;
create table public.coaching_commercial_controls(id uuid primary key default gen_random_uuid(), engagement_id uuid not null unique references coaching_engagements(id), commercial_status text not null default 'not_configured', required boolean not null default true, billing_authorized boolean not null default false, scheduling_suspended boolean not null default false, administrative_note text, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.coaching_commercial_controls enable row level security;
revoke all on public.coaching_commercial_controls from anon,authenticated;
grant all on public.coaching_commercial_controls to service_role;
alter table coach_compensation_ledger add foreign key(payout_id) references coach_payouts(id);
insert into coaching_commerce_settings(singleton) values(true);
create unique index one_open_quote on coaching_quotes(engagement_id) where status in ('draft','sent','viewed','accepted');
create index commerce_payments_org on coaching_payments(organization_id,due_date);
create index commerce_earnings_coach on coach_compensation_ledger(coach_id,earned_at);
create function coaching_commerce_internal.identity_enabled() returns boolean language sql stable security definer set search_path=public as $$ select public.coaching_preview_allowed() and auth.uid() is not null and not exists(select 1 from organization_users where auth_user_id=auth.uid() and (status in ('suspended','archived') or deleted_at is not null)) and not exists(select 1 from profiles where auth_user_id=auth.uid() and deleted_at is not null) $$;
create function coaching_commerce_internal.billing(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select coaching_commerce_internal.identity_enabled() and exists(select 1 from profiles where auth_user_id=auth.uid() and deleted_at is null and (role='system_admin' or (role='hospital_admin' and organization_id=org))) $$;
create function coaching_commerce_internal.audit(ev text, org uuid, item uuid, detail jsonb default '{}') returns void language sql security definer set search_path=public as $$ insert into platform_audit_events(actor_profile_id,organization_id,event_type,details) values((select id from profiles where auth_user_id=auth.uid() and deleted_at is null),org,'coaching_commerce_'||ev,jsonb_build_object('record_id',item)||detail) $$;
create function coaching_commerce_internal.notify(org uuid, cid uuid, ev text, item uuid) returns void language sql security definer set search_path=public as $$
insert into notifications(recipient_user_id,event_type,title,href,dedupe_key,created_by_user_id)
select x.uid,ev,replace(ev,'_',' '),case when cid is not null then '/coaching/earnings' else '/coaching/billing' end,ev||':'||item||':'||x.uid,auth.uid()
from (select auth_user_id uid from profiles where deleted_at is null and ((cid is null and (role='system_admin' or (organization_id=org and role='hospital_admin'))) or (cid is not null and auth_user_id=(select user_id from coach_profiles where id=cid)))) x
where x.uid is not null on conflict(recipient_user_id,dedupe_key) do nothing $$;
-- Whole mixed-financial rows are deliberately inaccessible. Role-specific RPC projections below
-- hide coach terms from buyers and buyer prices from coaches, including direct REST requests.
create function coaching_commerce_internal.audit_row() returns trigger language plpgsql security definer set search_path=public as $$ begin
 perform coaching_commerce_internal.audit(tg_table_name||'_'||lower(tg_op),null,new.id,jsonb_build_object('operation',tg_op,'previous',case when tg_op='UPDATE' then jsonb_strip_nulls(jsonb_build_object('status',to_jsonb(old)->'status','amount',to_jsonb(old)->'amount','price',to_jsonb(old)->'price','base_price',to_jsonb(old)->'base_price','rate',to_jsonb(old)->'rate','percentage',to_jsonb(old)->'percentage','active',to_jsonb(old)->'active')) else null end,'current',jsonb_strip_nulls(jsonb_build_object('status',to_jsonb(new)->'status','amount',to_jsonb(new)->'amount','price',to_jsonb(new)->'price','base_price',to_jsonb(new)->'base_price','rate',to_jsonb(new)->'rate','percentage',to_jsonb(new)->'percentage','active',to_jsonb(new)->'active')))); return new; end $$;
create trigger commerce_audit after insert or update on coaching_packages for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_package_components for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coach_commercial_profiles for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coach_compensation_rules for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on organization_coaching_pricing for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_discounts for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_quotes for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_commercial_agreements for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on organization_billing_accounts for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_payments for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_billing_schedule for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coach_compensation_ledger for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coach_payment_accounts for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coach_payouts for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_platform_revenue for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_invoices for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_refunds for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_session_financial_dispositions for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_commerce_settings for each row execute function coaching_commerce_internal.audit_row();
create trigger commerce_audit after insert or update on coaching_commercial_controls for each row execute function coaching_commerce_internal.audit_row();
create function coaching_commerce_internal.refresh(eid uuid) returns void language plpgsql security definer set search_path=public as $$
declare a coaching_commercial_agreements; due numeric; paid numeric; begin
 select * into a from coaching_commercial_agreements where engagement_id=eid;
 if not found then return;end if;
 select coalesce(sum(amount),0) into due from coaching_billing_schedule where agreement_id=a.id and due_date<=current_date and status<>'cancelled';
 select coalesce(sum(amount),0) into paid from coaching_payments where agreement_id=a.id and status in ('paid','partially_refunded','refunded');
 paid:=paid-coalesce((select sum(r.amount) from coaching_refunds r join coaching_payments p on p.id=r.payment_id where p.agreement_id=a.id and r.status='completed'),0);
 update coaching_commercial_controls c set commercial_status=case
 when a.status in ('cancelled','terminated','completed') then a.status
 when a.organization_accepted_at is null or a.coach_accepted_at is null then 'agreement_pending'
 when exists(select 1 from coaching_payments where agreement_id=a.id and status='failed') then 'payment_issue'
 when exists(select 1 from coaching_billing_schedule b left join coaching_payments p on p.id=b.payment_id where b.agreement_id=a.id and b.status<>'cancelled' and b.due_date<current_date and coalesce(p.status,'pending') not in ('paid','partially_refunded')) and not c.billing_authorized then 'past_due'
 when paid>=a.organization_price or c.billing_authorized or (a.billing_model in ('monthly','custom') and paid>=due and paid>0) then 'active'
 else 'payment_pending' end,updated_at=now() where engagement_id=eid;
 update coaching_commercial_agreements set status='active' where id=a.id and status in ('accepted','pending_coach','pending_organization') and exists(select 1 from coaching_commercial_controls where engagement_id=eid and commercial_status='active');
end $$;
create function coaching_commerce_internal.gate() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.status='active' and tg_op='INSERT' then raise exception 'New coaching requires commercial setup before activation';end if;
 if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status) and exists(select 1 from coaching_commercial_controls where engagement_id=new.id and required and commercial_status<>'active') then raise exception 'Commercial agreement and payment or billing authorization are required before activation.';end if; return new;end $$;
create trigger coaching_commercial_activation before insert or update on coaching_engagements for each row execute function coaching_commerce_internal.gate();
create function coaching_commerce_internal.schedule_gate() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.status='scheduled' and exists(select 1 from coaching_commercial_controls where engagement_id=new.engagement_id and scheduling_suspended) then raise exception 'Future scheduling is suspended. Contact your administrator.';end if;return new;end $$;
create trigger coaching_commercial_schedule before insert or update on coaching_sessions for each row execute function coaching_commerce_internal.schedule_gate();
create function coaching_commerce_internal.immutable_agreement() returns trigger language plpgsql as $$ begin
 if (to_jsonb(new)-array['status','organization_accepted_at','organization_accepted_by','coach_accepted_at','coach_accepted_by','organization_attestation','coach_attestation','updated_at']) is distinct from (to_jsonb(old)-array['status','organization_accepted_at','organization_accepted_by','coach_accepted_at','coach_accepted_by','organization_attestation','coach_attestation','updated_at']) then raise exception 'Agreement terms are frozen; use an adjustment.';end if;return new;end $$;
create trigger coaching_agreement_frozen before update on coaching_commercial_agreements for each row execute function coaching_commerce_internal.immutable_agreement();
create function coaching_commerce_internal.immutable_quote() returns trigger language plpgsql as $$ begin
 if old.status<>'draft' and (to_jsonb(new)-array['status','accepted_at','accepted_by','updated_at']) is distinct from (to_jsonb(old)-array['status','accepted_at','accepted_by','updated_at']) then raise exception 'Sent quote terms are frozen; cancel and issue a new quote.';end if; return new;end $$;
create trigger coaching_quote_frozen before update on coaching_quotes for each row execute function coaching_commerce_internal.immutable_quote();
create function coaching_commerce_internal.earn(a coaching_commercial_agreements, sid uuid, kind text, amount numeric, source text, why text default null) returns uuid language plpgsql security definer set search_path=public as $$ declare result uuid;begin
 if amount=0 then return null;end if;
 insert into coach_compensation_ledger(coach_id,engagement_id,session_id,agreement_id,entry_type,gross_amount,net_amount,currency,earned_at,source_key,reason)
 values(a.coach_id,a.engagement_id,sid,a.id,kind,amount,amount,a.currency,now(),source,why) on conflict(source_key) do nothing returning id into result;
 if result is not null then
 insert into coaching_platform_revenue(engagement_id,coach_cost,net_platform_revenue,currency,source_key) values(a.engagement_id,amount,-amount,a.currency,'compensation:'||result);
 perform coaching_commerce_internal.notify(a.organization_id,a.coach_id,'compensation_earned',result);
 end if; return result;end $$;
create function coaching_commerce_internal.session_earned() returns trigger language plpgsql security definer set search_path=public as $$
declare a coaching_commercial_agreements; model text; amount numeric; policy text; count_done integer; billed numeric; due numeric; begin
 select * into a from coaching_commercial_agreements where engagement_id=new.engagement_id and status in ('accepted','active','completed');
 if not found then return new;end if;
 if exists(select 1 from coach_compensation_ledger where session_id=new.id) and tg_op='UPDATE' and (new.status is distinct from old.status or new.duration_minutes is distinct from old.duration_minutes or new.compensation_category is distinct from old.compensation_category) then raise exception 'This session has financial history. Use a documented adjustment instead of changing earned session facts.';end if;
 policy:=a.compensation_snapshot->>'trigger';
 if new.status<>'completed' or new.compensation_category<>'paid' or (policy in ('coach_confirmed','both_confirmed') and not new.coach_confirmed) or (policy='both_confirmed' and not new.coachee_confirmed) then return new;end if;
 model:=a.compensation_snapshot->>'model';
 amount:=case model when 'per_hour' then round((a.compensation_snapshot->>'rate')::numeric*new.duration_minutes/60,2) when 'per_session' then (a.compensation_snapshot->>'rate')::numeric else 0 end;
 perform coaching_commerce_internal.earn(a,new.id,case when model='per_hour' then 'hour' else 'session' end,amount,'session:'||new.id);
 -- Per-session customer billing is a frozen total divided across the contracted number of verified sessions.
 if a.billing_model='per_session' and not exists(select 1 from coaching_billing_schedule where session_id=new.id) then
 perform 1 from coaching_commercial_agreements where id=a.id for update;
 select count(*),coalesce(sum(bs.amount),0) into count_done,billed from coaching_billing_schedule bs where agreement_id=a.id and billing_kind='verified_session' and status<>'cancelled';
 if count_done<coalesce((a.snapshot->>'included_sessions')::integer,0) then
 due:=least(a.organization_price-billed,case when count_done+1=(a.snapshot->>'included_sessions')::integer then a.organization_price-billed else round(a.organization_price/(a.snapshot->>'included_sessions')::integer,2) end);
 if due>0 then insert into coaching_billing_schedule(agreement_id,installment_number,description,billing_kind,amount,due_date,session_id) values(a.id,(select coalesce(max(installment_number),0)+1 from coaching_billing_schedule where agreement_id=a.id),'Verified coaching session','verified_session',due,current_date,new.id);end if;
 end if;
 end if;
 return new;end $$;
create trigger coaching_compensation_completed after insert or update on coaching_sessions for each row execute function coaching_commerce_internal.session_earned();

-- User-facing writes derive all ownership and all final amounts from protected database rows.
create function public.coaching_commerce_mutate(operation text,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; item uuid:=nullif(payload->>'id','')::uuid; eid uuid:=nullif(payload->>'engagement_id','')::uuid; e coaching_engagements; p coaching_packages; q coaching_quotes; a coaching_commercial_agreements; r coach_compensation_rules; price organization_coaching_pricing; d coaching_discounts; cfg coaching_commerce_settings; pay coaching_payments; refund coaching_refunds; ledger coach_compensation_ledger; s coaching_sessions; b coaching_billing_schedule;
 amount numeric; discount numeric:=0; rate numeric; expected numeric; n integer; idx integer; part numeric; total numeric; terms jsonb; comp jsonb; entry jsonb; ruleid uuid; org uuid; reserved_ids uuid[]; begin
 if not coaching_commerce_internal.identity_enabled() then raise exception 'Not authorized';end if;
 select * into cfg from coaching_commerce_settings where singleton;
 if operation in ('package','duplicate_package','component','rate','pricing','discount','settings','quote','quote_send','quote_cancel','billing_authorize','suspend','manual_payment','approve_compensation','adjust_compensation','payout_prepare','refund_approve','refund_decline','disposition','reconcile','agreement_cancel') and not coaching_platform_admin() then raise exception 'Platform administrator required';end if;
 if operation='package' then
 result:=coalesce(item,gen_random_uuid());
 insert into coaching_packages(id,name,slug,description,short_description,pricing_model,base_price,included_sessions,included_hours,duration_months,session_duration_minutes,active,publicly_visible,cancellation_terms,created_by)
 values(result,nullif(trim(payload->>'name'),''),nullif(payload->>'slug',''),payload->>'description',payload->>'short_description',payload->>'pricing_model',nullif(payload->>'base_price','')::numeric,nullif(payload->>'included_sessions','')::int,nullif(payload->>'included_hours','')::numeric,nullif(payload->>'duration_months','')::int,nullif(payload->>'session_duration_minutes','')::int,coalesce((payload->>'active')::boolean,true),coalesce((payload->>'publicly_visible')::boolean,false),coalesce(payload->'cancellation_terms','{}'),auth.uid())
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,short_description=excluded.short_description,pricing_model=excluded.pricing_model,base_price=excluded.base_price,included_sessions=excluded.included_sessions,included_hours=excluded.included_hours,duration_months=excluded.duration_months,session_duration_minutes=excluded.session_duration_minutes,active=excluded.active,publicly_visible=excluded.publicly_visible,cancellation_terms=excluded.cancellation_terms,updated_at=now();
 elsif operation='duplicate_package' then
 insert into coaching_packages(name,description,short_description,pricing_model,base_price,included_sessions,included_hours,duration_months,session_duration_minutes,active,publicly_visible,cancellation_terms,created_by) select name||' (copy)',description,short_description,pricing_model,base_price,included_sessions,included_hours,duration_months,session_duration_minutes,false,false,cancellation_terms,auth.uid() from coaching_packages where id=item returning id into result;
 insert into coaching_package_components(package_id,component_type,name,description,quantity,unit,included,sort_order) select result,component_type,name,description,quantity,unit,included,sort_order from coaching_package_components where package_id=item;
 elsif operation='component' then
 if payload->>'component_type' not in ('coaching_session','assessment_review','development_plan','360_review','coach_preparation','organization_alignment','closeout','custom') then raise exception 'Invalid component';end if;
 insert into coaching_package_components(package_id,component_type,name,description,quantity,unit,included,sort_order) values((payload->>'package_id')::uuid,payload->>'component_type',payload->>'name',payload->>'description',nullif(payload->>'quantity','')::numeric,payload->>'unit',coalesce((payload->>'included')::boolean,true),coalesce((payload->>'sort_order')::int,0)) returning id into result;
 elsif operation='commercial_profile' then
 if not coaching_platform_admin() and not coaching_internal.owner((payload->>'coach_id')::uuid) then raise exception 'Coach owner or platform admin required';end if;
 insert into coach_commercial_profiles(coach_id,default_hourly_rate,default_session_rate,preferred_compensation_model,minimum_engagement_amount) values((payload->>'coach_id')::uuid,nullif(payload->>'default_hourly_rate','')::numeric,nullif(payload->>'default_session_rate','')::numeric,payload->>'preferred_compensation_model',nullif(payload->>'minimum_engagement_amount','')::numeric) on conflict(coach_id) do update set default_hourly_rate=excluded.default_hourly_rate,default_session_rate=excluded.default_session_rate,preferred_compensation_model=excluded.preferred_compensation_model,minimum_engagement_amount=excluded.minimum_engagement_amount,updated_at=now() returning id into result;
 elsif operation='rate' then
 if item is not null then update coach_compensation_rules set active=false,effective_end_date=current_date where id=item;result:=item;
 else insert into coach_compensation_rules(coach_id,package_id,engagement_id,compensation_model,rate,percentage,effective_start_date,effective_end_date,created_by) values(nullif(payload->>'coach_id','')::uuid,nullif(payload->>'package_id','')::uuid,eid,payload->>'compensation_model',coalesce(nullif(payload->>'rate','')::numeric,0),nullif(payload->>'percentage','')::numeric,(payload->>'effective_start_date')::date,nullif(payload->>'effective_end_date','')::date,auth.uid()) returning id into result;end if;
 elsif operation='pricing' then
 insert into organization_coaching_pricing(organization_id,package_id,pricing_model,price,effective_start_date,effective_end_date,notes,created_by) values((payload->>'organization_id')::uuid,nullif(payload->>'package_id','')::uuid,payload->>'pricing_model',(payload->>'price')::numeric,(payload->>'effective_start_date')::date,nullif(payload->>'effective_end_date','')::date,payload->>'notes',auth.uid()) returning id into result;
 elsif operation='discount' then
 insert into coaching_discounts(organization_id,code,name,discount_type,discount_value,start_date,end_date,max_uses) values(nullif(payload->>'organization_id','')::uuid,nullif(payload->>'code',''),payload->>'name',payload->>'discount_type',(payload->>'discount_value')::numeric,(payload->>'start_date')::date,nullif(payload->>'end_date','')::date,nullif(payload->>'max_uses','')::int) returning id into result;
 elsif operation='settings' then
 update coaching_commerce_settings set marketplace_pricing=payload->>'marketplace_pricing',payout_policy=payload->>'payout_policy',compensation_trigger=payload->>'compensation_trigger',revenue_model=payload->>'revenue_model',platform_fee=(payload->>'platform_fee')::numeric,agreement_version=payload->>'agreement_version',agreement_text=payload->>'agreement_text',coach_terms=payload->>'coach_terms',terms_ready=(payload->>'terms_ready')::boolean,updated_at=now() where singleton returning id into result;
 elsif operation='quote' then
 select * into e from coaching_engagements where id=eid for update;if not found then raise exception 'Engagement not found';end if;
 select * into p from coaching_packages where id=(payload->>'package_id')::uuid and active;if not found then raise exception 'Select an active package';end if;
 select * into price from organization_coaching_pricing where organization_id=e.organization_id and (package_id=p.id or package_id is null) and active and effective_start_date<=current_date and (effective_end_date is null or effective_end_date>=current_date) order by (package_id is not null) desc,effective_start_date desc,created_at desc limit 1;
 rate:=coalesce(price.price,p.base_price,nullif(payload->>'custom_price','')::numeric);
 terms:=jsonb_build_object('package_name',p.name,'components',(select coalesce(jsonb_agg(to_jsonb(c)-array['created_at','updated_at','id','package_id'] order by sort_order),'[]') from coaching_package_components c where package_id=p.id),'included_sessions',p.included_sessions,'included_hours',p.included_hours,'duration_months',p.duration_months,'session_duration_minutes',p.session_duration_minutes,'cancellation_terms',p.cancellation_terms,'unit_price',rate,'price_source',case when price.id is not null then 'organization' when p.base_price is not null then 'package' else 'custom_quote' end,'billing_model',payload->>'billing_model','custom_installments',coalesce(payload->'installments','[]'),'revenue_model',cfg.revenue_model,'platform_fee',cfg.platform_fee);
 if rate is null or rate<0 then raise exception 'Configure a package price, organization price, or custom quote';end if;
 amount:=round(rate*case coalesce(price.pricing_model,p.pricing_model) when 'per_session' then p.included_sessions when 'per_hour' then p.included_hours when 'monthly' then p.duration_months else 1 end,2);
 amount:=amount+case cfg.revenue_model when 'fixed_fee' then cfg.platform_fee when 'subscription_plus' then cfg.platform_fee when 'percentage_fee' then round(amount*cfg.platform_fee/100,2) else 0 end;
 if amount is null then raise exception 'Package quantity required for selected pricing model';end if;
 if nullif(payload->>'discount_id','') is not null then
 select * into d from coaching_discounts where id=(payload->>'discount_id')::uuid for update;
 if not found or not d.active or (d.organization_id is not null and d.organization_id<>e.organization_id) or d.start_date>current_date or d.end_date<current_date or (d.max_uses is not null and (select count(*) from coaching_quotes where discount_id=d.id and status in ('draft','sent','viewed','accepted'))>=d.max_uses) then raise exception 'Discount unavailable';end if;
 discount:=least(amount,case d.discount_type when 'percentage' then round(amount*d.discount_value/100,2) else round(d.discount_value,2) end);end if;
 select * into r from coach_compensation_rules where active and (coach_id=e.coach_id or coach_id is null) and (package_id=p.id or package_id is null) and (engagement_id=eid or engagement_id is null) and effective_start_date<=current_date and (effective_end_date is null or effective_end_date>=current_date) order by (engagement_id is not null) desc,(coach_id is not null) desc,(package_id is not null) desc,effective_start_date desc,created_at desc limit 1;
 if r.id is null then raise exception 'Configure a compensation rule before issuing a quote';end if;
 expected:=case r.compensation_model when 'per_session' then r.rate*p.included_sessions when 'per_hour' then r.rate*p.included_hours when 'percentage' then round((amount-discount)*r.percentage/100,2) else r.rate end;
 expected:=round(expected,2);
 if expected is null then raise exception 'Compensation quantity or percentage required';end if;
 comp:=jsonb_build_object('rule_id',r.id,'model',r.compensation_model,'rate',r.rate,'percentage',r.percentage,'expected',expected,'trigger',cfg.compensation_trigger,'coach_terms',cfg.coach_terms,'earned_basis',case when r.compensation_model in ('fixed_engagement','custom','percentage') then 'completed_engagement' else 'verified_session' end);
 if payload->>'billing_model' is null or payload->>'billing_model' not in ('pay_in_full','monthly','per_session','custom') or (payload->>'billing_model'='monthly' and p.duration_months is null) or (payload->>'billing_model'='per_session' and p.included_sessions is null) then raise exception 'Invalid billing plan';end if;
 if payload->>'billing_model'='custom' and (jsonb_array_length(terms->'custom_installments')=0 or (select sum((v->>'amount')::numeric) from jsonb_array_elements(terms->'custom_installments') v)<>amount-discount) then raise exception 'Custom installments must total the quote';end if;
 if payload->>'billing_model'='custom' then
 for entry in select value from jsonb_array_elements(terms->'custom_installments') loop
 if nullif(entry->>'due_date','') is null or nullif(entry->>'amount','') is null or (entry->>'amount')::numeric<=0 or (entry->>'amount')::numeric<>round((entry->>'amount')::numeric,2) then raise exception 'Each installment requires a date and a positive whole-cent amount';end if;
 perform (entry->>'due_date')::date;
 end loop;end if;
 if nullif(payload->>'valid_until','') is null or (payload->>'valid_until')::date<current_date then raise exception 'Quote validity is in the past';end if;
 insert into coaching_quotes(organization_id,coach_request_id,engagement_id,coach_id,package_id,pricing_model,subtotal,discount_amount,total_amount,included_sessions,included_hours,duration_months,valid_until,snapshot,compensation_snapshot,discount_id,created_by) values(e.organization_id,e.coach_request_id,eid,e.coach_id,p.id,coalesce(price.pricing_model,p.pricing_model),amount,discount,amount-discount,p.included_sessions,p.included_hours,p.duration_months,(payload->>'valid_until')::date,terms,comp,d.id,auth.uid()) returning id into result;
 insert into coaching_commercial_controls(engagement_id,commercial_status) values(eid,'quote_pending') on conflict(engagement_id) do update set commercial_status='quote_pending',required=true;
 elsif operation in ('quote_send','quote_cancel','quote_view','quote_accept','quote_decline') then
 select * into q from coaching_quotes where id=item for update;
 if not found or not coaching_commerce_internal.billing(q.organization_id) then raise exception 'Quote unavailable';end if;result:=q.id;
 if operation='quote_cancel' and q.status in ('draft','sent','viewed') then update coaching_quotes set status='cancelled' where id=item;
 elsif operation='quote_send' and q.status='draft' then
 if not cfg.terms_ready or length(trim(cfg.agreement_text))<20 or length(trim(cfg.coach_terms))<20 then raise exception 'Configure reviewed agreement and coach terms before sending quotes';end if;
 update coaching_quotes set snapshot=snapshot||jsonb_build_object('agreement_text',cfg.agreement_text,'agreement_version',cfg.agreement_version),compensation_snapshot=compensation_snapshot||jsonb_build_object('coach_terms',cfg.coach_terms),status='sent' where id=item;
 update coaching_commercial_controls set commercial_status='quote_sent' where engagement_id=q.engagement_id;perform coaching_commerce_internal.notify(q.organization_id,null,'quote_ready',item);
 elsif operation='quote_view' and q.status='sent' then update coaching_quotes set status='viewed' where id=item;perform coaching_commerce_internal.notify(q.organization_id,null,'quote_viewed',item);
 elsif operation='quote_decline' and q.status in ('sent','viewed') then update coaching_quotes set status='declined' where id=item;
 elsif operation='quote_accept' and q.status in ('sent','viewed') and q.valid_until>=current_date then
 update coaching_quotes set status='accepted',accepted_at=now(),accepted_by=auth.uid() where id=item;
 insert into coaching_commercial_agreements(engagement_id,organization_id,coach_id,quote_id,agreement_version,agreement_title,agreement_text,organization_price,coach_compensation_amount,platform_expected_revenue,billing_model,effective_date,expiration_date,snapshot,compensation_snapshot)
 values(q.engagement_id,q.organization_id,q.coach_id,q.id,q.snapshot->>'agreement_version',q.snapshot->>'package_name',q.snapshot->>'agreement_text',q.total_amount,(q.compensation_snapshot->>'expected')::numeric,q.total_amount-(q.compensation_snapshot->>'expected')::numeric,q.snapshot->>'billing_model',current_date,(current_date+make_interval(months=>coalesce(q.duration_months,1)))::date,q.snapshot,q.compensation_snapshot) returning id into result;
 update coaching_commercial_controls set commercial_status='agreement_pending' where engagement_id=q.engagement_id;
 perform coaching_commerce_internal.notify(q.organization_id,null,'agreement_required',result);perform coaching_commerce_internal.notify(q.organization_id,q.coach_id,'agreement_required',result);
 else raise exception 'Quote cannot be changed in its current state';end if;
 elsif operation in ('agreement_accept','coach_accept') then
 select * into a from coaching_commercial_agreements where id=item for update;if not found or a.status not in ('pending_organization','pending_coach','accepted','active') then raise exception 'Agreement unavailable';end if;
 if operation='agreement_accept' and not coaching_commerce_internal.billing(a.organization_id) or operation='coach_accept' and not coaching_internal.owner(a.coach_id) then raise exception 'Not authorized';end if;
 if payload->>'attest' is distinct from 'true' or length(trim(coalesce(payload->>'name','')))<2 or length(trim(coalesce(payload->>'title','')))<2 then raise exception 'Name, title and authorization attestation required';end if;
 terms:=jsonb_build_object('name',payload->>'name','title',payload->>'title','version',a.agreement_version,'user_id',auth.uid(),'timestamp',now(),'ip',null,'user_agent',left(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'user-agent','unavailable'),500));
 if operation='agreement_accept' and a.organization_accepted_at is null then
 update coaching_commercial_agreements set organization_accepted_at=now(),organization_accepted_by=auth.uid(),organization_attestation=terms,status=case when coach_accepted_at is null then 'pending_coach' else 'accepted' end where id=item;
 if a.organization_price>0 and a.billing_model in ('pay_in_full','monthly') then
 n:=case when a.billing_model='monthly' then (a.snapshot->>'duration_months')::int else 1 end;total:=0;
 for idx in 1..n loop part:=case when idx=n then a.organization_price-total else round(a.organization_price/n,2) end; total:=total+part;
 if part>0 then insert into coaching_billing_schedule(agreement_id,installment_number,description,amount,due_date) values(a.id,idx,case when n=1 then 'Engagement payment' else 'Monthly installment '||idx end,part,(a.effective_date+make_interval(months=>idx-1))::date);end if;end loop;
 elsif a.billing_model='custom' then idx:=0;for entry in select value from jsonb_array_elements(a.snapshot->'custom_installments') loop idx:=idx+1;insert into coaching_billing_schedule(agreement_id,installment_number,description,amount,due_date) values(a.id,idx,coalesce(entry->>'description','Installment '||idx),(entry->>'amount')::numeric,(entry->>'due_date')::date);end loop;end if;
 elsif operation='coach_accept' and a.coach_accepted_at is null then update coaching_commercial_agreements set coach_accepted_at=now(),coach_accepted_by=auth.uid(),coach_attestation=terms,status=case when organization_accepted_at is null then 'pending_organization' else 'accepted' end where id=item;end if;
 perform coaching_commerce_internal.refresh(a.engagement_id); result:=item;
 elsif operation in ('billing_authorize','suspend') then
 update coaching_commercial_controls set billing_authorized=case when operation='billing_authorize' then (payload->>'enabled')::boolean else billing_authorized end,scheduling_suspended=case when operation='suspend' then (payload->>'enabled')::boolean else scheduling_suspended end,administrative_note=nullif(trim(payload->>'notes'),''),updated_by=auth.uid() where engagement_id=eid returning id into result;
 if length(trim(coalesce(payload->>'notes','')))<3 then raise exception 'Administrative reason required';end if;perform coaching_commerce_internal.refresh(eid);
 elsif operation in ('payment_prepare','manual_payment') then
 select * into b from coaching_billing_schedule where id=item for update;select * into a from coaching_commercial_agreements where id=b.agreement_id;
 if a.id is null or not coaching_commerce_internal.billing(a.organization_id) or a.organization_accepted_at is null or a.coach_accepted_at is null or a.status in ('cancelled','terminated') or b.status='cancelled' then raise exception 'Accepted agreement and authorized billing access required';end if;
 if b.payment_id is not null then select * into pay from coaching_payments where id=b.payment_id for update;end if;
 if pay.status in ('paid','refunded','partially_refunded') then raise exception 'Installment already paid';end if;
 if operation='manual_payment' and (pay.stripe_checkout_session_id is not null or pay.status='processing') then raise exception 'A Stripe payment is in progress; reconcile it before recording an external payment';end if;
 if pay.id is null then insert into coaching_payments(organization_id,engagement_id,agreement_id,amount,due_date,payment_type) values(a.organization_id,a.engagement_id,a.id,b.amount,b.due_date,case a.billing_model when 'monthly' then 'monthly' when 'per_session' then 'session' else 'engagement' end) returning * into pay;update coaching_billing_schedule set payment_id=pay.id where id=item;end if;
 result:=pay.id;
 if operation='manual_payment' then
 if nullif(payload->>'amount','') is null or nullif(payload->>'date','') is null or payload->>'method' is null or payload->>'method' not in ('check','external_ach','wire','other') or length(trim(coalesce(payload->>'reference','')))<2 or length(trim(coalesce(payload->>'notes','')))<2 or (payload->>'amount')::numeric<>pay.amount or (payload->>'date')::date>current_date then raise exception 'Provide the exact installment amount, received date, method, reference and notes';end if;
 update coaching_payments set manual_method=payload->>'method',manual_reference=payload->>'reference',manual_notes=payload->>'notes',recorded_by=auth.uid() where id=pay.id;
 perform coaching_commerce_internal.payment_paid(pay.id,(payload->>'date')::date::timestamptz,0);
 end if;
 elsif operation='approve_compensation' then
 update coach_compensation_ledger set status='approved',approved_at=now() where id=item and status='earned' returning * into ledger;if not found then raise exception 'Earned compensation required';end if;result:=item;perform coaching_commerce_internal.notify(null,ledger.coach_id,'payout_approved',item);
 elsif operation='adjust_compensation' then
 select * into a from coaching_commercial_agreements where engagement_id=eid;if not found then raise exception 'Agreement not found';end if;
 if length(trim(coalesce(payload->>'reason','')))<3 or (payload->>'amount')::numeric=0 then raise exception 'Adjustment amount and reason required';end if;
 result:=coaching_commerce_internal.earn(a,null,'adjustment',(payload->>'amount')::numeric,'adjustment:'||(payload->>'request_key')::uuid,payload->>'reason');
 elsif operation='payout_prepare' then
 perform 1 from coach_profiles where id=(payload->>'coach_id')::uuid for update;
 if not exists(select 1 from coach_payment_accounts where coach_id=(payload->>'coach_id')::uuid and payouts_enabled and account_status='active') then raise exception 'Coach must complete Stripe payment setup';end if;
 if exists(select 1 from coach_payouts where coach_id=(payload->>'coach_id')::uuid and status in ('pending','processing')) then raise exception 'An existing payout must be reconciled first';end if;
 select sum(l.net_amount),array_agg(l.id) into amount,reserved_ids from (select id,net_amount from coach_compensation_ledger where coach_id=(payload->>'coach_id')::uuid and status='approved' and payout_id is null for update) l;
 if amount is null or amount<=0 then raise exception 'No positive approved balance';end if;
 insert into coach_payouts(coach_id,amount,period_start,period_end) values((payload->>'coach_id')::uuid,amount,current_date,current_date) returning id into result;
 update coach_compensation_ledger set status='scheduled',payout_id=result where id=any(reserved_ids);
 elsif operation='refund_request' then
 select * into pay from coaching_payments where id=item for update;if not found or not coaching_commerce_internal.billing(pay.organization_id) or pay.status not in ('paid','partially_refunded') then raise exception 'Paid payment and billing access required';end if;
 amount:=(payload->>'amount')::numeric;if amount<=0 or amount+coalesce((select sum(rf.amount) from coaching_refunds rf where payment_id=item and status not in ('declined','failed')),0)>pay.amount or length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Refund exceeds available balance or reason is missing';end if;
 if nullif(payload->>'request_key','') is null then raise exception 'Refund request key required';end if;
 insert into coaching_refunds(payment_id,engagement_id,amount,reason,requested_by,request_key) values(item,pay.engagement_id,amount,payload->>'reason',auth.uid(),(payload->>'request_key')::uuid) returning id into result;perform coaching_commerce_internal.notify(pay.organization_id,null,'refund_requested',result);
 elsif operation in ('refund_approve','refund_decline') then
 update coaching_refunds set status=case operation when 'refund_approve' then 'approved' else 'declined' end,approved_by=auth.uid() where id=item and status='requested' returning id into result;if result is null then raise exception 'Requested refund required';end if;
 elsif operation='disposition' then
 select * into s from coaching_sessions where id=(payload->>'session_id')::uuid;select * into a from coaching_commercial_agreements where engagement_id=s.engagement_id;
 if a.id is null or s.status not in ('cancelled','no_show') or length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Cancelled/no-show session and documented reason required';end if;
 insert into coaching_session_financial_dispositions(session_id,organization_charge_amount,coach_compensation_amount,disposition_reason,status,reviewed_by,reviewed_at) values(s.id,(payload->>'organization_charge_amount')::numeric,(payload->>'coach_compensation_amount')::numeric,payload->>'reason','approved',auth.uid(),now()) returning id into result;
 perform coaching_commerce_internal.earn(a,s.id,'adjustment',(payload->>'coach_compensation_amount')::numeric,'disposition:'||result,payload->>'reason');
 if (payload->>'organization_charge_amount')::numeric>0 then perform 1 from coaching_commercial_agreements where id=a.id for update;insert into coaching_billing_schedule(agreement_id,installment_number,description,billing_kind,amount,due_date,session_id) values(a.id,(select coalesce(max(installment_number),0)+1 from coaching_billing_schedule where agreement_id=a.id),'Cancellation disposition: '||(payload->>'reason'),'adjustment',(payload->>'organization_charge_amount')::numeric,current_date,s.id);end if;
 elsif operation='reconcile' then
 select * into a from coaching_commercial_agreements where engagement_id=eid for update;
 if a.id is null or not exists(select 1 from coaching_engagements where id=eid and status='completed') then raise exception 'Complete operational closeout first';end if;
 if exists(select 1 from coaching_billing_schedule where agreement_id=a.id and status not in ('paid','cancelled')) or exists(select 1 from coaching_refunds where engagement_id=eid and status in ('requested','approved','processing')) then raise exception 'Resolve outstanding installments and refunds first';end if;
 if a.compensation_snapshot->>'model' in ('fixed_engagement','percentage','custom') then perform coaching_commerce_internal.earn(a,null,'engagement',(a.compensation_snapshot->>'expected')::numeric,'engagement:'||eid);end if;
 if exists(select 1 from coach_compensation_ledger where engagement_id=eid and status not in ('paid','reversed')) then raise exception 'Approve and pay all earned compensation before final reconciliation';end if;
 update coaching_commercial_agreements set status='completed' where id=a.id;perform coaching_commerce_internal.refresh(eid);result:=a.id;
 elsif operation='agreement_cancel' then
 if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Cancellation reason required';end if;
 update coaching_commercial_agreements set status='cancelled' where engagement_id=eid and status<>'completed' returning id into result;
 update coaching_billing_schedule set status='cancelled' where agreement_id=result and payment_id is null;
 update coaching_commercial_controls set commercial_status='cancelled',administrative_note=payload->>'reason',updated_by=auth.uid() where engagement_id=eid;
 else raise exception 'Unsupported commerce operation';end if;
 perform coaching_commerce_internal.audit(operation,coalesce(a.organization_id,q.organization_id,e.organization_id,pay.organization_id),result,jsonb_build_object('engagement_id',coalesce(eid,a.engagement_id,q.engagement_id),'reason',coalesce(payload->>'reason',payload->>'notes')));
 return result;end $$;
create function coaching_commerce_internal.payment_paid(pid uuid, paid timestamptz, fee numeric default null) returns void language plpgsql security definer set search_path=public as $$ declare p coaching_payments;begin
 select * into p from coaching_payments where id=pid for update;if not found then raise exception 'Payment not found';end if;
 if p.status in ('paid','partially_refunded','refunded') then
 if fee is not null and p.processing_fee is null then
 update coaching_payments set processing_fee=fee where id=pid;
 insert into coaching_platform_revenue(engagement_id,payment_id,payment_processing_cost,net_platform_revenue,currency,source_key) values(p.engagement_id,pid,fee,-fee,p.currency,'fee:'||pid) on conflict(source_key) do nothing;
 end if;return;end if;
 update coaching_payments set status='paid',paid_at=paid,processing_fee=fee,updated_at=now() where id=pid;
 update coaching_billing_schedule set status='paid',updated_at=now() where payment_id=pid;
 insert into coaching_platform_revenue(engagement_id,payment_id,organization_revenue,payment_processing_cost,net_platform_revenue,currency,source_key) values(p.engagement_id,pid,p.amount,coalesce(fee,0),p.amount-coalesce(fee,0),p.currency,'payment:'||pid) on conflict(source_key) do nothing;
 perform coaching_commerce_internal.refresh(p.engagement_id);
 perform coaching_commerce_internal.audit('payment_succeeded',p.organization_id,pid);
 perform coaching_commerce_internal.notify(p.organization_id,null,'payment_successful',pid);
end $$;
create function coaching_commerce_internal.refund_complete(rid uuid) returns void language plpgsql security definer set search_path=public as $$ declare r coaching_refunds; p coaching_payments; refunded numeric; begin
 select * into r from coaching_refunds where id=rid for update;if not found then raise exception 'Refund not found';end if;if r.status='completed' then return;end if;
 select * into p from coaching_payments where id=r.payment_id for update;
 select coalesce(sum(amount),0) into refunded from coaching_refunds where payment_id=p.id and status='completed';if refunded+r.amount>p.amount then raise exception 'Refund exceeds paid amount';end if;
 update coaching_refunds set status='completed',processed_at=now() where id=rid;
 update coaching_payments set status=case when refunded+r.amount=p.amount then 'refunded' else 'partially_refunded' end where id=p.id;
 insert into coaching_platform_revenue(engagement_id,payment_id,refund_amount,net_platform_revenue,currency,source_key) values(p.engagement_id,p.id,r.amount,-r.amount,p.currency,'refund:'||rid) on conflict(source_key) do nothing;
 perform coaching_commerce_internal.refresh(p.engagement_id);perform coaching_commerce_internal.notify(p.organization_id,null,'refund_completed',rid);
end $$;
create function coaching_commerce_internal.engagement_earned() returns trigger language plpgsql security definer set search_path=public as $$ declare a coaching_commercial_agreements;begin
 if new.status='completed' and old.status is distinct from new.status then
 select * into a from coaching_commercial_agreements where engagement_id=new.id and status in ('accepted','active');
 if a.id is not null and a.compensation_snapshot->>'model' in ('fixed_engagement','percentage','custom') then perform coaching_commerce_internal.earn(a,null,'engagement',(a.compensation_snapshot->>'expected')::numeric,'engagement:'||new.id);end if;
 end if;return new;end $$;
create trigger coaching_compensation_closeout after update on coaching_engagements for each row execute function coaching_commerce_internal.engagement_earned();

-- Internal provider endpoint: service role only, never takes a price from the browser.
create function public.coaching_commerce_provider(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare p coaching_payments; a coaching_commercial_agreements; r coaching_refunds; po coach_payouts; account coach_payment_accounts; ev payment_webhook_events; item uuid:=nullif(payload->>'id','')::uuid; result jsonb; amount numeric; cid uuid;begin
 if operation='attestation_context' then
 select * into a from coaching_commercial_agreements where id=item for update;
 if payload->>'kind'='organization' and a.organization_accepted_by=(payload->>'actor')::uuid then update coaching_commercial_agreements set organization_attestation=organization_attestation||jsonb_build_object('ip',payload->>'ip','user_agent',left(payload->>'user_agent',500),'context_captured',true) where id=item and not coalesce((organization_attestation->>'context_captured')::boolean,false);
 elsif payload->>'kind'='coach' and a.coach_accepted_by=(payload->>'actor')::uuid then update coaching_commercial_agreements set coach_attestation=coach_attestation||jsonb_build_object('ip',payload->>'ip','user_agent',left(payload->>'user_agent',500),'context_captured',true) where id=item and not coalesce((coach_attestation->>'context_captured')::boolean,false);
 else raise exception 'Attestation actor mismatch';end if;result:='{}';
 elsif operation='payment' then
 select * into p from coaching_payments where id=item for update;
 if p.id is null or p.status in ('paid','refunded','partially_refunded','cancelled') then raise exception 'Payment unavailable';end if;
 select * into a from coaching_commercial_agreements where id=p.agreement_id;
 if a.organization_accepted_at is null or a.coach_accepted_at is null or a.status in ('cancelled','terminated') then raise exception 'Agreement must be accepted';end if;
 -- A persisted session is always retrieved before it can be replaced. An uncertain creation
 -- is never retried with a fresh key after Stripe's 24-hour idempotency retention window.
 if p.status='processing' and p.stripe_checkout_session_id is null and p.updated_at<now()-interval '23 hours' then raise exception 'Uncertain checkout requires provider reconciliation';end if;
 update coaching_payments set status='processing',updated_at=case when status='processing' then updated_at else now() end where id=p.id;
 result:=to_jsonb(p)||jsonb_build_object('package_name',a.agreement_title,'customer_id',(select stripe_customer_id from organization_billing_accounts where organization_id=p.organization_id));
 elsif operation='customer' then
 insert into organization_billing_accounts(organization_id,stripe_customer_id,billing_status) values((payload->>'organization_id')::uuid,payload->>'customer_id','active') on conflict(organization_id) do update set stripe_customer_id=excluded.stripe_customer_id;result:='{}';
 elsif operation='checkout_saved' then
 update coaching_payments set stripe_checkout_session_id=payload->>'session_id',checkout_url=payload->>'url',checkout_expires_at=(payload->>'expires_at')::timestamptz where id=item and status not in ('paid','partially_refunded','refunded');result:='{}';
 elsif operation='checkout_expired' then
 update coaching_payments set stripe_checkout_session_id=null,checkout_url=null,checkout_attempt=checkout_attempt+1,status='pending',updated_at=now() where id=item and stripe_checkout_session_id=payload->>'session_id' and status not in ('paid','partially_refunded','refunded');result:='{}';
 elsif operation='connect' then
 cid:=(payload->>'coach_id')::uuid;insert into coach_payment_accounts(coach_id,account_status) values(cid,'onboarding') on conflict(coach_id) do nothing;
 select to_jsonb(c) into result from coach_payment_accounts c where coach_id=cid;
 elsif operation='connect_saved' then update coach_payment_accounts set stripe_connect_account_id=payload->>'account_id' where coach_id=(payload->>'coach_id')::uuid and stripe_connect_account_id is null;result:='{}';
 elsif operation='refund' then
 select * into r from coaching_refunds where id=item for update;
 if not found or r.status not in ('approved','processing') then raise exception 'Approved refund required';end if;
 if r.status='processing' and r.stripe_refund_id is null and r.updated_at<now()-interval '23 hours' then raise exception 'Uncertain refund requires provider reconciliation';end if;
 select * into p from coaching_payments where id=r.payment_id;
 update coaching_refunds set status='processing',updated_at=case when status='processing' then updated_at else now() end where id=item;
 result:=to_jsonb(r)||jsonb_build_object('payment_intent_id',p.stripe_payment_intent_id,'manual_method',p.manual_method);
 elsif operation='refund_saved' then
 update coaching_refunds set stripe_refund_id=payload->>'refund_id',status=case when payload->>'status'='failed' then 'failed' else status end where id=item;
 if payload->>'status'='succeeded' then perform coaching_commerce_internal.refund_complete(item);end if;result:='{}';
 elsif operation='manual_refund' then
 select * into r from coaching_refunds where id=item;select * into p from coaching_payments where id=r.payment_id;
 if r.status<>'approved' or p.manual_method is null or length(trim(coalesce(payload->>'reference','')))<3 then raise exception 'Approved manual refund and external refund reference required';end if;
 perform coaching_commerce_internal.refund_complete(item);perform coaching_commerce_internal.audit('manual_refund_recorded',p.organization_id,item,jsonb_build_object('reference',payload->>'reference'));result:='{}';
 elsif operation='payout' then
 select * into po from coach_payouts where id=item for update;if not found or po.status not in ('pending','processing') then raise exception 'Approved payout required';end if;
 if po.status='processing' and po.stripe_transfer_id is null and po.updated_at<now()-interval '23 hours' then raise exception 'Uncertain transfer requires provider reconciliation';end if;
 select * into account from coach_payment_accounts where coach_id=po.coach_id;if not account.payouts_enabled or account.account_status<>'active' then raise exception 'Coach payment setup is incomplete';end if;
 update coach_payouts set status='processing',initiated_at=coalesce(initiated_at,now()),updated_at=case when status='processing' then updated_at else now() end where id=item;
 result:=to_jsonb(po)||jsonb_build_object('account_id',account.stripe_connect_account_id);
 elsif operation='payout_saved' then
 update coach_payouts set stripe_transfer_id=payload->>'transfer_id',status='paid',completed_at=now() where id=item and status<>'paid' returning * into po;
 if found then update coach_compensation_ledger set status='paid',paid_at=now() where payout_id=item;perform coaching_commerce_internal.notify(null,po.coach_id,'payout_completed',item);end if;result:='{}';
 elsif operation='event_error' then
 insert into payment_webhook_events(provider_event_id,event_type,processing_status,error_message) values(payload->>'event_id',payload->>'event_type','failed','Provider event needs reconciliation') on conflict(provider_event_id) do update set processing_status=case when payment_webhook_events.processing_status='processed' then 'processed' else 'failed' end,error_message='Provider event needs reconciliation';result:='{}';
 elsif operation='event' then
 insert into payment_webhook_events(provider_event_id,event_type) values(payload->>'event_id',payload->>'event_type') on conflict(provider_event_id) do nothing;
 select * into ev from payment_webhook_events where provider_event_id=payload->>'event_id' for update;
 if ev.processing_status='processed' then return jsonb_build_object('duplicate',true);end if;
 -- Subtransaction rolls back all ledger changes on failure while keeping a retryable event log.
 begin
 if payload->>'event_type'='account.updated' then
 update coach_payment_accounts set charges_enabled=(payload->>'charges_enabled')::boolean,payouts_enabled=(payload->>'payouts_enabled')::boolean,account_status=payload->>'account_status',onboarding_completed_at=case when (payload->>'details_submitted')::boolean then coalesce(onboarding_completed_at,now()) else onboarding_completed_at end where stripe_connect_account_id=payload->>'account_id';
 elsif payload->>'event_type' in ('refund.updated','refund.created','refund.failed') then
 select * into r from coaching_refunds where stripe_refund_id=payload->>'refund_id' or id=nullif(payload->>'refund_record_id','')::uuid for update;
 if r.id is null and nullif(payload->>'refund_record_id','') is null then
 select * into p from coaching_payments where id=nullif(payload->>'payment_id','')::uuid or stripe_payment_intent_id=payload->>'payment_intent_id' for update;
 if p.id is not null then
 if (payload->>'amount')::numeric+coalesce((select sum(rf.amount) from coaching_refunds rf where payment_id=p.id and status not in ('failed','declined')),0)>p.amount then raise exception 'External refund exceeds balance';end if;
 insert into coaching_refunds(payment_id,engagement_id,stripe_refund_id,amount,reason,status) values(p.id,p.engagement_id,payload->>'refund_id',(payload->>'amount')::numeric,'Refund recorded from Stripe dashboard','processing') returning * into r;
 end if;
 end if;
 if r.id is null and nullif(payload->>'refund_record_id','') is not null then raise exception 'Linked refund record not found';end if;
 if r.id is not null then
 if r.amount<>(payload->>'amount')::numeric then raise exception 'Refund amount mismatch';end if;
 update coaching_refunds set stripe_refund_id=payload->>'refund_id' where id=r.id;
 if payload->>'status'='succeeded' then perform coaching_commerce_internal.refund_complete(r.id);elsif payload->>'status' in ('failed','canceled') then update coaching_refunds set status='failed' where id=r.id and status<>'completed';end if;
 end if;
 else
 select * into p from coaching_payments where id=nullif(payload->>'payment_id','')::uuid or stripe_payment_intent_id=payload->>'payment_intent_id' or stripe_invoice_id=payload->>'invoice_id' or stripe_checkout_session_id=payload->>'session_id' for update;
 if p.id is null and nullif(payload->>'payment_id','') is not null then raise exception 'Linked coaching payment not found';end if;
 if p.id is not null then
 if payload->>'currency' is not null and upper(payload->>'currency')<>p.currency then raise exception 'Payment currency mismatch';end if;
 if payload->>'amount' is not null and (payload->>'amount')::numeric<>p.amount then raise exception 'Payment amount mismatch';end if;
 update coaching_payments set stripe_payment_intent_id=coalesce(stripe_payment_intent_id,payload->>'payment_intent_id'),stripe_invoice_id=coalesce(stripe_invoice_id,payload->>'invoice_id') where id=p.id;
 if payload->>'paid'='true' then perform coaching_commerce_internal.payment_paid(p.id,(payload->>'paid_at')::timestamptz,nullif(payload->>'fee','')::numeric);
 elsif payload->>'failed'='true' and p.status not in ('paid','refunded','partially_refunded') then update coaching_payments set status='failed' where id=p.id;perform coaching_commerce_internal.refresh(p.engagement_id);perform coaching_commerce_internal.notify(p.organization_id,null,'payment_failed',p.id);end if;
 if payload->>'invoice_id' is not null then
 insert into coaching_invoices(organization_id,engagement_id,agreement_id,payment_id,stripe_invoice_id,invoice_number,invoice_date,due_date,subtotal,tax_amount,total,status,invoice_url,invoice_pdf_url) values(p.organization_id,p.engagement_id,p.agreement_id,p.id,payload->>'invoice_id',coalesce(payload->>'invoice_number',payload->>'invoice_id'),current_date,p.due_date,p.amount,0,p.amount,case when (select status from coaching_payments where id=p.id) in ('paid','refunded','partially_refunded') then 'paid' else 'open' end,payload->>'invoice_url',payload->>'invoice_pdf_url') on conflict(payment_id) do update set status=excluded.status,invoice_url=coalesce(excluded.invoice_url,coaching_invoices.invoice_url),invoice_pdf_url=coalesce(excluded.invoice_pdf_url,coaching_invoices.invoice_pdf_url);
 perform coaching_commerce_internal.notify(p.organization_id,null,'invoice_available',p.id);
 end if;
 end if;
 end if;
 update payment_webhook_events set processing_status='processed',processed_at=now(),error_message=null where id=ev.id;
 exception when others then update payment_webhook_events set processing_status='failed',error_message=left(sqlerrm,500) where id=ev.id;return jsonb_build_object('error','Financial event reconciliation failed');end;
 result:=jsonb_build_object('processed',true);
 else raise exception 'Unknown provider operation';end if;return result;end $$;

create function public.coaching_commerce_read(section text, engagement uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare admin boolean:=coaching_platform_admin(); org uuid; cid uuid; result jsonb; data jsonb; tab text; agreement_row coaching_commercial_agreements; quote_row coaching_quotes; begin
 if not coaching_commerce_internal.identity_enabled() then raise exception 'Not authorized';end if;
 select organization_id into org from profiles where auth_user_id=auth.uid() and role='hospital_admin' and deleted_at is null;
 select id into cid from coach_profiles where user_id=auth.uid();
 if section='marketplace' then
 return jsonb_build_object('mode',(select marketplace_pricing from coaching_commerce_settings where singleton),'packages',case when org is not null and coaching_enabled(org) and (select marketplace_pricing in ('starting_price','package_prices') from coaching_commerce_settings where singleton) then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',base_price,'pricing_model',pricing_model,'currency',currency)),'[]') from (select * from coaching_packages where active and publicly_visible and ((select marketplace_pricing from coaching_commerce_settings where singleton)<>'starting_price' or base_price is not null) order by base_price nulls last,id limit case when (select marketplace_pricing from coaching_commerce_settings where singleton)='starting_price' then 1 else null end) offers) else '[]'::jsonb end);
 end if;
 if not admin and org is null and cid is null then raise exception 'Billing or coach account required';end if;
 if section='admin' and not admin then raise exception 'Platform administrator required';end if;
 if admin or org is not null then
 for agreement_row in select * from coaching_commercial_agreements where (admin or organization_id=org) and status not in ('cancelled','terminated','completed') loop
 perform coaching_commerce_internal.refresh(agreement_row.engagement_id);
 if exists(select 1 from coaching_billing_schedule where agreement_id=agreement_row.id and status='pending' and due_date<=current_date) then perform coaching_commerce_internal.notify(agreement_row.organization_id,null,'payment_required',agreement_row.id);end if;
 if exists(select 1 from coaching_billing_schedule where agreement_id=agreement_row.id and status='pending' and due_date<current_date) then perform coaching_commerce_internal.notify(agreement_row.organization_id,null,'invoice_past_due',agreement_row.id);end if;
 end loop;
 for quote_row in select * from coaching_quotes where (admin or organization_id=org) and status in ('sent','viewed') and valid_until<=current_date+3 loop
 if quote_row.valid_until<current_date then update coaching_quotes set status='expired' where id=quote_row.id;else perform coaching_commerce_internal.notify(quote_row.organization_id,null,'quote_expiring',quote_row.id);end if;
 end loop;
 end if;
 result:=jsonb_build_object('platform_admin',admin,'organization_admin',org is not null,'coach',cid is not null);
 for tab in select unnest(array['coaching_packages','coaching_package_components','coach_commercial_profiles','coach_compensation_rules','organization_coaching_pricing','coaching_discounts','coaching_quotes','coaching_commercial_agreements','coaching_payments','coaching_billing_schedule','coach_compensation_ledger','coach_payment_accounts','coach_payouts','coaching_platform_revenue','coaching_invoices','coaching_refunds','coaching_session_financial_dispositions','payment_webhook_events','coaching_commerce_settings','coaching_commercial_controls']) loop
 if admin then execute format('select coalesce(jsonb_agg(to_jsonb(t)-array[''stripe_customer_id'',''stripe_payment_intent_id'',''stripe_invoice_id'',''stripe_checkout_session_id'',''stripe_connect_account_id'',''stripe_transfer_id'',''checkout_url'',''organization_attestation'',''coach_attestation''] order by created_at desc),''[]'') from %I t',tab) into data;
 elsif org is not null and tab in ('coaching_quotes','coaching_commercial_agreements','coaching_payments','coaching_invoices') then
 execute format('select coalesce(jsonb_agg(to_jsonb(t)-array[''compensation_snapshot'',''coach_compensation_amount'',''platform_expected_revenue'',''stripe_payment_intent_id'',''stripe_invoice_id'',''stripe_checkout_session_id'',''checkout_url'',''manual_notes'',''processing_fee'',''organization_attestation'',''coach_attestation''] order by created_at desc),''[]'') from %I t where organization_id=$1',tab) into data using org;
 -- Internal revenue strategy is not part of buyer terms.
 if tab in ('coaching_quotes','coaching_commercial_agreements') then select coalesce(jsonb_agg(v||jsonb_build_object('snapshot',(v->'snapshot')-array['revenue_model','platform_fee'])),'[]') into data from jsonb_array_elements(data) v;end if;
 elsif org is not null and tab='coaching_billing_schedule' then select coalesce(jsonb_agg(to_jsonb(t)),'[]') into data from coaching_billing_schedule t join coaching_commercial_agreements a on a.id=t.agreement_id where a.organization_id=org;
 elsif org is not null and tab='coaching_refunds' then select coalesce(jsonb_agg(to_jsonb(t)-'stripe_refund_id'),'[]') into data from coaching_refunds t join coaching_payments p on p.id=t.payment_id where p.organization_id=org;
 elsif cid is not null and tab in ('coach_compensation_ledger','coach_payouts','coach_commercial_profiles') then execute format('select coalesce(jsonb_agg(to_jsonb(t)-array[''stripe_transfer_id'',''stripe_payout_reference'']),''[]'') from %I t where coach_id=$1',tab) into data using cid;
 elsif cid is not null and tab='coach_payment_accounts' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'account_status',account_status,'payouts_enabled',payouts_enabled)),'[]') into data from coach_payment_accounts where coach_id=cid;
 elsif cid is not null and tab='coaching_commercial_agreements' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'engagement_id',engagement_id,'agreement_title',agreement_title,'agreement_version',agreement_version,'status',status,'compensation_snapshot',compensation_snapshot,'coach_accepted_at',coach_accepted_at,'currency',currency)),'[]') into data from coaching_commercial_agreements where coach_id=cid;
 else data:='[]';end if;
 if engagement is not null and tab in ('coaching_quotes','coaching_commercial_agreements','coaching_payments','coach_compensation_ledger','coaching_platform_revenue','coaching_invoices','coaching_refunds','coaching_commercial_controls') then select coalesce(jsonb_agg(v),'[]') into data from jsonb_array_elements(data) v where v->>'engagement_id'=engagement::text;end if;
 result:=result||jsonb_build_object(tab,data);
 end loop;
 -- Labels only; never source confidential session notes or development content for finance.
 if admin then result:=result||jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from organizations),'coaches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name)),'[]') from coach_profiles),'engagements',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'organization_id',organization_id,'coach_id',coach_id,'coach_name',(select display_name from coach_profiles where id=coaching_engagements.coach_id),'leader_name',(select full_name from profiles where auth_user_id=coaching_engagements.coachee_user_id),'status',status)),'[]') from coaching_engagements));
 else result:=result||jsonb_build_object('engagements',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'coach_name',(select display_name from coach_profiles where id=coaching_engagements.coach_id),'leader_name',(select full_name from profiles where auth_user_id=coaching_engagements.coachee_user_id),'status',status)),'[]') from coaching_engagements where organization_id=org or coach_id=cid));end if;
 return result;end $$;
revoke all on all functions in schema coaching_commerce_internal from public,anon,authenticated;
revoke all on function public.coaching_commerce_mutate(text,jsonb),public.coaching_commerce_read(text,uuid),public.coaching_commerce_provider(text,jsonb) from public,anon,authenticated;
grant execute on function public.coaching_commerce_mutate(text,jsonb),public.coaching_commerce_read(text,uuid) to authenticated;
grant execute on function public.coaching_commerce_provider(text,jsonb) to service_role;
create function coaching_commerce_internal.new_engagement() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into coaching_commercial_controls(engagement_id,commercial_status,required) values(new.id,'not_configured',true) on conflict do nothing;return new;end $$;
create trigger coaching_new_commercial_setup after insert on coaching_engagements for each row execute function coaching_commerce_internal.new_engagement();
revoke all on function coaching_commerce_internal.new_engagement() from public,anon,authenticated;
create function coaching_commerce_internal.immutable_ledger() returns trigger language plpgsql as $$ begin
 if tg_op='DELETE' or tg_table_name='coaching_platform_revenue' then raise exception 'Financial history is append-only';end if;
 if (to_jsonb(new)-array['status','approved_at','paid_at','payout_id','updated_at']) is distinct from (to_jsonb(old)-array['status','approved_at','paid_at','payout_id','updated_at']) then raise exception 'Use a documented compensation adjustment';end if;return new;end $$;
create trigger commerce_ledger_frozen before update or delete on coach_compensation_ledger for each row execute function coaching_commerce_internal.immutable_ledger();
create trigger commerce_revenue_frozen before update or delete on coaching_platform_revenue for each row execute function coaching_commerce_internal.immutable_ledger();
revoke all on function coaching_commerce_internal.immutable_ledger() from public,anon,authenticated;
do $$ declare col record;begin
 for col in select c.table_name,c.column_name from information_schema.columns c where c.table_schema='public' and c.data_type='numeric' and c.table_name in ('coaching_packages','coach_commercial_profiles','coach_compensation_rules','organization_coaching_pricing','coaching_discounts','coaching_quotes','coaching_commercial_agreements','coaching_payments','coaching_billing_schedule','coach_compensation_ledger','coach_payouts','coaching_platform_revenue','coaching_invoices','coaching_refunds','coaching_session_financial_dispositions','coaching_commerce_settings') loop
 execute format('alter table %I add check (%I::text not in (''NaN'',''Infinity'',''-Infinity''))',col.table_name,col.column_name);end loop;end $$;
commit;
