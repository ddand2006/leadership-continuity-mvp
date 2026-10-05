alter table public.affiliate_earnings
  add column if not exists hold_until timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists reversed_at timestamptz,
  add column if not exists dispute_reference text;

alter table public.affiliate_earnings
  drop constraint if exists affiliate_earnings_status_check;
alter table public.affiliate_earnings
  add constraint affiliate_earnings_status_check
  check (status in ('pending','held','payable','paid','reversed','disputed','awaiting_review','ineligible'));

create index if not exists affiliate_earnings_payout_queue
  on public.affiliate_earnings (status, hold_until)
  where status in ('pending', 'payable');
