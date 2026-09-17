alter table public.affiliates add column payout_email text;
alter table public.affiliates add column payout_country text check (payout_country ~ '^[A-Z]{2}$');
create table public.affiliate_connect_accounts (
 affiliate_id uuid not null references public.affiliates(id),
 livemode boolean not null,
 account_id text unique,
 requested_at timestamptz not null default now(),
 details_submitted boolean not null default false,
 payouts_enabled boolean not null default false,
 transfers_active boolean not null default false,
 checked_at timestamptz,
 primary key (affiliate_id,livemode)
);
create table public.affiliate_earnings (
 invoice_id text primary key,
 affiliate_id uuid not null references public.affiliates(id),
 organization_id uuid not null references public.organizations(id),
 subscription_id text not null,
 livemode boolean not null,
 currency text not null,
 eligible_cents bigint not null check (eligible_cents >= 0),
 commission_cents bigint not null check (commission_cents >= 0),
 rate_bps integer not null check (rate_bps between 0 and 10000),
 renewal_number integer,
 status text not null check (status in ('awaiting_review','ineligible','held')),
 reason text not null,
 charge_ids text[] not null default '{}',
 invoice_created_at timestamptz not null,
 checked_at timestamptz not null default now()
);
create index affiliate_earnings_affiliate on public.affiliate_earnings(affiliate_id);
alter table public.affiliate_connect_accounts enable row level security;
alter table public.affiliate_earnings enable row level security;
revoke all on public.affiliate_connect_accounts, public.affiliate_earnings from anon,authenticated;
grant all on public.affiliate_connect_accounts, public.affiliate_earnings to service_role;

-- Serialize estimates per organization so parallel deliveries cannot credit two
-- different invoices for the same annual commission period without review.
create function public.record_affiliate_earning(payload jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare r public.affiliate_earnings; duplicate_period boolean;
begin
 r := jsonb_populate_record(null::public.affiliate_earnings,payload);
 perform 1 from public.organizations where id=r.organization_id and affiliate_id=r.affiliate_id for update;
 if not found then raise exception 'Affiliate attribution mismatch'; end if;
 select exists(select 1 from public.affiliate_earnings where organization_id=r.organization_id
  and livemode=r.livemode and renewal_number=r.renewal_number and invoice_id<>r.invoice_id) into duplicate_period;
 if duplicate_period then
  r.status:='held'; r.commission_cents:=0; r.reason:='Multiple invoices for this annual period require reconciliation.';
  update public.affiliate_earnings set status='held',commission_cents=0,reason=r.reason
   where organization_id=r.organization_id and livemode=r.livemode and renewal_number=r.renewal_number;
 end if;
 insert into public.affiliate_earnings select r.*
 on conflict(invoice_id) do update set eligible_cents=excluded.eligible_cents,
 commission_cents=excluded.commission_cents,rate_bps=excluded.rate_bps,renewal_number=excluded.renewal_number,
 status=excluded.status,reason=excluded.reason,charge_ids=excluded.charge_ids,checked_at=excluded.checked_at;
end $$;
revoke all on function public.record_affiliate_earning(jsonb) from public,anon,authenticated;
grant execute on function public.record_affiliate_earning(jsonb) to service_role;

create function public.lock_affiliate_payout_contact() returns trigger
language plpgsql set search_path=public as $$
begin
 perform 1 from public.affiliates where id=new.affiliate_id for update;
 return new;
end $$;
create trigger lock_affiliate_payout_contact before insert on public.affiliate_connect_accounts
for each row execute function public.lock_affiliate_payout_contact();
create function public.protect_affiliate_payout_contact() returns trigger
language plpgsql set search_path=public as $$
begin
 if (new.payout_email,new.payout_country) is distinct from (old.payout_email,old.payout_country)
 and exists(select 1 from public.affiliate_connect_accounts where affiliate_id=old.id) then
  raise exception 'Payout contact is locked after Stripe setup starts';
 end if;
 return new;
end $$;
create trigger protect_affiliate_payout_contact before update on public.affiliates
for each row execute function public.protect_affiliate_payout_contact();
