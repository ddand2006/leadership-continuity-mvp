-- Private affiliate configuration. Public pages read only published branding on the server.
create table public.affiliates (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null,
 draft_branding jsonb not null,
 published_branding jsonb,
 initial_bps integer not null check (initial_bps between 0 and 10000),
 renewal_bps integer not null check (renewal_bps between 0 and 10000),
 renewal_years integer check (renewal_years between 1 and 100),
 terms_version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
revoke all on public.affiliates from anon, authenticated;
grant all on public.affiliates to service_role;

alter table public.organizations add column affiliate_id uuid references public.affiliates(id);
alter table public.organizations add column affiliate_terms jsonb;

create function public.freeze_affiliate_attribution() returns trigger
language plpgsql set search_path = public as $$
declare a public.affiliates;
begin
 if TG_OP = 'UPDATE' then
  if new.affiliate_id is distinct from old.affiliate_id or new.affiliate_terms is distinct from old.affiliate_terms then
   raise exception 'Affiliate attribution and agreed terms cannot be changed';
  end if;
 elsif new.affiliate_id is not null then
  select * into a from public.affiliates where id = new.affiliate_id and published_branding is not null for share;
  if not found then raise exception 'Affiliate is not accepting referrals'; end if;
  new.affiliate_terms := jsonb_build_object('version',a.terms_version,'initial_bps',a.initial_bps,
   'renewal_bps',a.renewal_bps,'renewal_years',a.renewal_years,
   'basis','subscription revenue after discounts, excluding tax; before processing fees',
   'payouts_enabled',false,'attributed_at',now());
 else
  new.affiliate_terms := null;
 end if;
 return new;
end $$;
create trigger freeze_affiliate_attribution before insert or update on public.organizations
for each row execute function public.freeze_affiliate_attribution();

create function public.version_affiliate_terms() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.slug <> old.slug then raise exception 'Affiliate links cannot be renamed'; end if;
 new.terms_version := old.terms_version + case when (new.initial_bps,new.renewal_bps,new.renewal_years)
  is distinct from (old.initial_bps,old.renewal_bps,old.renewal_years) then 1 else 0 end;
 new.updated_at := now();
 return new;
end $$;
create trigger version_affiliate_terms before update on public.affiliates
for each row execute function public.version_affiliate_terms();
