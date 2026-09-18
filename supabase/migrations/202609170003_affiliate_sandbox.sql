alter table public.affiliates add column is_sandbox boolean not null default false;
create table public.affiliate_sandbox_clients (
 id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.affiliates(id),
 customer_id text unique, subscription_id text unique, terms jsonb not null,
 created_at timestamptz not null default now()
);
create table public.affiliate_sandbox_invoices (
 invoice_id text primary key, affiliate_id uuid not null references public.affiliates(id),
 client_id uuid not null references public.affiliate_sandbox_clients(id), currency text not null,
 commission_cents bigint not null, eligible_cents bigint not null, rate_bps integer not null,
 renewal_number integer, status text not null, reason text not null,
 charge_ids text[] not null default '{}', livemode boolean not null default false check(livemode=false),
 invoice_created_at timestamptz not null, checked_at timestamptz not null default now()
);
alter table public.affiliate_sandbox_clients enable row level security;
alter table public.affiliate_sandbox_invoices enable row level security;
revoke all on public.affiliate_sandbox_clients,public.affiliate_sandbox_invoices from anon,authenticated;
grant all on public.affiliate_sandbox_clients,public.affiliate_sandbox_invoices to service_role;
create function public.guard_affiliate_sandbox() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_TABLE_NAME='affiliates' then
  if new.is_sandbox and new.published_branding is not null then
   raise exception 'Sandbox affiliate pages cannot be published for live enrollment';
  end if;
  if new.is_sandbox is distinct from old.is_sandbox and
   (exists(select 1 from public.organizations where affiliate_id=old.id) or
    exists(select 1 from public.affiliate_connect_accounts where affiliate_id=old.id) or
    exists(select 1 from public.affiliate_sandbox_clients where affiliate_id=old.id)) then
   raise exception 'Cannot change affiliate environment after enrollment or Stripe setup';
  end if;
 elsif new.affiliate_id is not null and exists(select 1 from public.affiliates where id=new.affiliate_id and is_sandbox) then
  raise exception 'Sandbox affiliates cannot enroll live customers';
 end if;
 return new;
end $$;
create trigger guard_affiliate_sandbox_mode before update on public.affiliates for each row execute function public.guard_affiliate_sandbox();
create trigger guard_affiliate_sandbox_customer before insert on public.organizations for each row execute function public.guard_affiliate_sandbox();
-- User explicitly identified this existing affiliate as fake test data.
update public.affiliates set is_sandbox=true, published_branding=null
where id='55a6c6d6-8521-4542-abf9-8091929b9008' and slug='ruralhealthexperts';
