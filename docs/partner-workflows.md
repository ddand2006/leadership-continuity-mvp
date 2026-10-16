# Partner referrals and coach rosters

Partner approval now atomically links an affiliate draft and creates explicit owner membership.
The draft starts unpublished, with zero commission rates and no accepted agreement. A platform
administrator sets negotiated terms, verifies agreement acceptance, configures the payout contact,
and publishes the referral page. Existing linked affiliates and frozen customer terms are preserved.

The partner dashboard has referral-link, referred-client, coach, payment, and team-access views.
Owners manage team access. Administrators manage coaches and contacts; finance members can view
referrals and payments; members can view referrals and the roster. Each user signs in with their
own verified account. Payout-contact changes do not transfer portal ownership. Suspended partner
applications block portal capabilities. Contact labels do not grant workspace or portal access.

Adding a coach resolves an existing auth identity or sends an invitation, then creates or reuses
one coach profile and roster entry. It never replaces an existing biography, credentials, or
approval. The coach accepts or declines the affiliation in Marketplace Readiness. Only accepted
relationships for approved partners appear with marketplace-eligible coaches. Companies can
filter the marketplace by partner. Leaving a roster removes the affiliation from marketplace
results. It does not delete the coach or their separate engagements.

Verified organization users and coach accounts can enter the coaching workspace. Existing
organization entitlement, suspended-user, payment-hold, marketplace-eligibility, engagement,
and consent checks still apply. A partner membership does not authorize leader records or
private coaching notes. Existing coach compensation is paid under the engagement’s coach
agreement; partner affiliation does not add another coaching payee or a referral commission.

## Commission and payout behavior

Subscription commission uses the organization’s frozen terms, eligible annual subscription
prices, verified payment receipts, configured tax/discount/fee exclusions, and proportional
refund adjustments. Unknown prices, prorations, unverified payment sources, and disputes go
under review. The first paid invoice must convert within the configured attribution window.
After conversion, renewals use the original eligible billing-period anniversary and agreed
renewal duration. Processing fees must be verified when the agreement excludes them.

A ledger placeholder can exist before Stripe onboarding; it does not lock the payment contact
or start the Stripe account-creation retry clock. Onboarding starts that clock explicitly.
Payouts require an administrator’s approval, completion of the hold, and a ready Stripe account.
The database reserves the payout before requesting a transfer. Repeated requests use the same
Stripe idempotency key. Uncertain responses stay in processing and can be reconciled with the
matching transfer. The application blocks creation retries after 23 hours to avoid Stripe’s
idempotency-retention boundary. Refund/dispute events retain paid history and create adjustments.
An administrator can recover a negative adjustment through a recorded, retry-safe transfer
reversal. Positive or otherwise uncertain adjustments remain under review.

## Rollout

See `docs/partner-staging-rollout.md` for the hosted preflight, current deployment inventory,
staging isolation requirements, and acceptance rehearsal.

Apply these new migrations in order after the existing migrations, then deploy the application:

1. `202610130001_partner_accounts_and_coach_rosters.sql`
2. `202610130002_affiliate_payment_reconciliation.sql`
3. `202610150001_affiliate_payout_rejected_requests.sql`
4. `202610150002_coaching_privacy_cache_invalidation.sql`

Migration 1 preserves existing verified payout contacts as explicit owners and links existing
approved partner owners. Review those memberships before rollout. Approved applications that
have no affiliate yet can be approved again through platform administration to create the link.
Migration 2 backfills established initial commissions as renewal anchors; reconcile historical
invoices whose first eligible billing period differs materially from invoice creation time.
Migration 3 preserves legacy request keys, audits definitive insufficient-funds rejections, and
requires a new administrator approval before retrying with a fresh request key. Uncertain
responses retain their reservation and idempotency key.

Hosted staging migration and simulated-payment evidence is recorded in the rollout log.
Production migrations and live transfers remain pending. Coaching commerce retains its Stripe test-mode requirement. Commission
scope remains subscriptions; extending it to coaching purchases needs an explicit agreement.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm build`, and
`node --test scripts/affiliates/*.test.cjs scripts/coaching/*.test.mjs scripts/coaching/*.test.cjs`.

Run `scripts/affiliates/partner-workflows.sql` only in a disposable PostgreSQL database with the
coaching/affiliate migrations and fixture schema installed. It checks transactional approval,
profile reuse, accepted affiliations, identity restrictions, payout replay, and refund recovery.
Browser checks use fictional accounts against the running app with an isolated local database
adapter; they do not establish hosted Supabase or live Stripe integration readiness.
