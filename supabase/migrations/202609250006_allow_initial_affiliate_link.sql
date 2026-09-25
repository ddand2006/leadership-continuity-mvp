begin;
create or replace function public.freeze_affiliate_attribution() returns trigger
language plpgsql set search_path = public as $$
declare a public.affiliates;
begin
 if TG_OP = 'UPDATE' and old.affiliate_id is not null then
  if new.affiliate_id is distinct from old.affiliate_id or new.affiliate_terms is distinct from old.affiliate_terms then raise exception 'Affiliate attribution and agreed terms cannot be changed'; end if;
 elsif new.affiliate_id is not null then
  select * into a from public.affiliates where id = new.affiliate_id and published_branding is not null;
  if not found then raise exception 'Affiliate is not accepting referrals'; end if;
  new.affiliate_terms := jsonb_build_object('version',a.terms_version,'initial_bps',a.initial_bps,'renewal_bps',a.renewal_bps,'renewal_years',a.renewal_years,'basis','subscription revenue after discounts, excluding tax; before processing fees','payouts_enabled',false,'attributed_at',now());
 else new.affiliate_terms := null;
 end if;
 return new;
end $$;
commit;
