-- Optional, administrator-controlled retry after verifying Stripe created no account.
-- NULL preserves the original idempotency key for existing or uncertain requests.
alter table public.affiliate_connect_accounts add column creation_retry_key text;
