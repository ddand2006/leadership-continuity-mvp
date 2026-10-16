-- Read-only audit of the existing schema before the partner rollout.
-- No customer names, email addresses, credentials, or payment identifiers are returned.
begin transaction read only;
set local statement_timeout = '20s';

select jsonb_build_object(
  'checked_at', now(),
  'database_version', current_setting('server_version'),
  'latest_migration', (select max(version) from supabase_migrations.schema_migrations),
  'partner_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='202610130001'),
  'payment_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='202610130002'),
  'payout_recovery_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='202610150001'),
  'coaching_privacy_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='202610150002'),
  'roster_unique_constraint', exists(select 1 from pg_constraint where conrelid='public.partner_coaches'::regclass and conname='partner_coaches_partner_application_id_coach_email_key'),
  'earnings_status_constraint', exists(select 1 from pg_constraint where conrelid='public.affiliate_earnings'::regclass and conname='affiliate_earnings_status_check'),
  'coaching_identity_function', to_regprocedure('public.coaching_identity_enabled()') is not null,
  'marketplace_eligibility_function', to_regprocedure('coaching_scale_internal.eligible(uuid)') is not null,
  'partner_applications', (select count(*) from public.partner_applications),
  'approved_unlinked_partners', (select count(*) from public.partner_applications where status='approved' and affiliate_id is null),
  'approved_partner_owners_with_unconfirmed_email', (
    select count(*) from public.partner_applications p join auth.users u on u.id=p.auth_user_id
    where p.status='approved' and u.email_confirmed_at is null
  ),
  'verified_payout_contacts_to_preserve', (
    select count(*) from public.affiliates a join auth.users u on lower(u.email)=lower(a.payout_email)
    where not a.is_sandbox and u.email_confirmed_at is not null
  ),
  'partner_and_payout_owner_pairs_to_review', (
    select count(*) from public.partner_applications p join public.affiliates a on a.id=p.affiliate_id
    join auth.users u on lower(u.email)=lower(a.payout_email)
    where p.status='approved' and not a.is_sandbox and u.email_confirmed_at is not null and u.id<>p.auth_user_id
  ),
  'coach_roster_rows', (select count(*) from public.partner_coaches),
  'roster_identities_without_profile', (
    select count(*) from public.partner_coaches r
    where r.coach_user_id is not null and not exists(select 1 from public.coach_profiles c where c.user_id=r.coach_user_id)
  ),
  'roster_identity_email_mismatches', (
    select count(*) from public.partner_coaches r join auth.users u on u.id=r.coach_user_id
    where lower(r.coach_email) is distinct from lower(u.email)
  ),
  'legacy_email_invitations', (select count(*) from public.partner_coaches where coach_user_id is null and invitation_status in ('invited','accepted')),
  'existing_connect_reservations', (select count(*) from public.affiliate_connect_accounts),
  'connect_reservations_without_account', (select count(*) from public.affiliate_connect_accounts where account_id is null),
  'historical_initial_invoices_to_reconcile', (
    select count(distinct organization_id) from public.affiliate_earnings
    where renewal_number=0 and commission_cents>0 and status in ('pending','payable','paid')
  ),
  'paid_earnings_without_transfer_receipt', (select count(*) from public.affiliate_earnings where status='paid' and payout_transfer_id is null),
  'transfer_receipts_without_paid_status', (select count(*) from public.affiliate_earnings where payout_transfer_id is not null and status<>'paid'),
  'earnings_by_status', (select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from public.affiliate_earnings group by status) s)
) as partner_rollout_preflight;

rollback;
