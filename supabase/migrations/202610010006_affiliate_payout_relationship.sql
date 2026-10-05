-- Payout review embeds the connected account through the affiliate and
-- environment. The composite key prevents live and sandbox accounts from
-- being mixed.
alter table public.affiliate_earnings
  add constraint affiliate_earnings_connect_account_fk
  foreign key (affiliate_id, livemode)
  references public.affiliate_connect_accounts (affiliate_id, livemode);
