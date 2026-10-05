-- Commission terms are versioned configuration. Existing organizations keep
-- their frozen affiliate_terms snapshot; these defaults apply to new referrals.
alter table public.affiliates
  add column if not exists commission_exclusions jsonb not null default '["tax", "refunds", "chargebacks", "discounts", "stripe_fees"]'::jsonb,
  add column if not exists payout_hold_days integer not null default 14 check (payout_hold_days between 0 and 90),
  add column if not exists attribution_days integer not null default 30 check (attribution_days between 1 and 365),
  add column if not exists agreement_accepted_at timestamptz,
  add column if not exists agreement_accepted_by uuid references auth.users(id);

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
  if a.agreement_accepted_at is null then raise exception 'Affiliate agreement must be accepted before referrals'; end if;
  new.affiliate_attributed_at := coalesce(new.affiliate_attributed_at, now());
  new.affiliate_attribution_expires_at := new.affiliate_attributed_at + make_interval(days => a.attribution_days);
  new.affiliate_terms := jsonb_build_object(
   'version', a.terms_version,
   'initial_bps', a.initial_bps,
   'renewal_bps', a.renewal_bps,
   'renewal_years', a.renewal_years,
   'commission_exclusions', a.commission_exclusions,
   'payout_hold_days', a.payout_hold_days,
   'attribution_days', a.attribution_days,
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
