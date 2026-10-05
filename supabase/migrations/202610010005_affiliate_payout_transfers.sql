alter table public.affiliate_earnings
  add column if not exists payout_transfer_id text unique,
  add column if not exists payout_attempts integer not null default 0,
  add column if not exists payout_approved_at timestamptz,
  add column if not exists payout_approved_by uuid references auth.users(id);

create index if not exists affiliate_earnings_payable
  on public.affiliate_earnings (affiliate_id, status)
  where status = 'payable' and payout_transfer_id is null;
