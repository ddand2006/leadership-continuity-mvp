-- Preserve the referral decision made at enrollment and make the 30-day
-- attribution window explicit. The original affiliate terms remain frozen.
alter table public.organizations
  add column if not exists affiliate_attributed_at timestamptz,
  add column if not exists affiliate_attribution_expires_at timestamptz;

create or replace function public.freeze_affiliate_attribution() returns trigger
language plpgsql set search_path = public as $$
declare a public.affiliates;
begin
 if TG_OP = 'UPDATE' then
  if new.affiliate_id is distinct from old.affiliate_id
     or new.affiliate_terms is distinct from old.affiliate_terms
     or new.affiliate_attributed_at is distinct from old.affiliate_attributed_at
     or new.affiliate_attribution_expires_at is distinct from old.affiliate_attribution_expires_at then
   raise exception 'Affiliate attribution and agreed terms cannot be changed';
  end if;
 elsif new.affiliate_id is not null then
  select * into a from public.affiliates
   where id = new.affiliate_id and published_branding is not null and is_sandbox = false;
  if not found then raise exception 'Affiliate is not accepting referrals'; end if;
  new.affiliate_attributed_at := coalesce(new.affiliate_attributed_at, now());
  new.affiliate_attribution_expires_at := new.affiliate_attributed_at + interval '30 days';
  new.affiliate_terms := jsonb_build_object(
   'version', a.terms_version,
   'initial_bps', a.initial_bps,
   'renewal_bps', a.renewal_bps,
   'renewal_years', a.renewal_years,
   'basis', 'commissionable revenue defined by the affiliate agreement',
   'payouts_enabled', false,
   'attributed_at', new.affiliate_attributed_at,
   'attribution_expires_at', new.affiliate_attribution_expires_at
  );
 else
  new.affiliate_terms := null;
  new.affiliate_attributed_at := null;
  new.affiliate_attribution_expires_at := null;
 end if;
 return new;
end $$;

create index if not exists organizations_affiliate_attribution_expiry
  on public.organizations (affiliate_id, affiliate_attribution_expires_at)
  where affiliate_id is not null;
