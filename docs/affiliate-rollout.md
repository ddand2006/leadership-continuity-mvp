# Affiliate program — first implementation

## Implemented locally

- `/platform-operations/affiliates`: platform-admin-only company editor, initial and renewal rates (two decimal places), renewal count limit, draft preview, explicit approval before publication, and unpublish.
- `/partners/[slug]`: reusable public page using published company name, logo, accent color, contact and copy. Unpublished pages return 404. Financial terms are never queried into the public page.
- Signup metadata retains the referral across email confirmation. Server-side enrollment resolves an active published affiliate; the organization insert snapshots its terms in a database trigger. Existing organizations cannot be reassigned through this flow.
- Stripe Checkout and subscription metadata include the server-stored affiliate ID.
- The administration page lists referred clients and subscription status for implementation outreach.
- Draft copy edits do not affect the published page. Rate edits apply immediately to future enrollments, while existing client terms remain immutable. Slugs are permanent.

## Explicit first-release scope

Only platform administrators edit pages. Preview is inside the administrator editor; external preview links and affiliate self-service approval are not implemented. The approval checkbox records operator intent in publication, but does not constitute a signed affiliate agreement. No credentials are emailed.

Commission basis currently records subscription revenue after discounts, excluding tax and before processing fees. Confirm that convention before enrolling a real partner. Renewal duration records the number of eligible annual renewals; blank means unlimited. These values are stored terms, not an implemented earnings engine.

## Deployment order

1. Apply `supabase/migrations/202609170001_affiliate_foundation.sql` to the intended database. Do not deploy the checkout change before this migration: checkout now selects `organizations.affiliate_id`.
2. Deploy the code. No real partners are seeded and no pages are published automatically.
3. Create a draft with an actual partner's approved branding and negotiated rates.
4. Verify preview/publish/unpublish, confirmed-email signup, immutable attribution and Checkout metadata in a test environment.
5. Complete the commercial components below before promising automated commissions.

## Remaining commercial work

- Versioned affiliate agreement acceptance and durable publication/audit history; sharing previews for external approval.
- Stripe Connect onboarding and connected-account status. Existing coaching Connect is test-only and must not be repurposed blindly.
- Earnings ledger keyed by invoice/line, correct initial/renewal classification, annual commission limits, eligible products and seat additions, discounts, tax exclusion, refunds/disputes, duplicate events, retries and reconciliation.
- Explicit payout approval and rollout controls, Stripe transfer idempotency, failure recovery, transfer reversal and bank payout visibility. Payouts are currently disabled; no transfer APIs were added.
- Separate training commission terms, training/setup work queue and welcome/implementation email automation.
- Affiliate-only portal with scoped client and earnings visibility.

## Verification

`node --test scripts/affiliates/api.test.cjs scripts/billing-checkout.test.cjs scripts/billing-cancellation.test.cjs`

Database migration executed on a disposable PostgreSQL 16 instance with minimal organizations table and Supabase roles. `scripts/affiliates/foundation.sql` verifies spoofed terms overwritten, immutable attribution, preserved old rates/new terms version, role grants and unpublished referral rejection. Never run this fixture against production.

Latest local verification: 13 API/billing tests pass; TypeScript passes; changed files lint with only the existing auth navigation warning; Webpack production build succeeds. Turbopack build is blocked by a local CSS-worker port permission error. The migration has not been applied to hosted Supabase, changes have not been deployed, and browser/end-to-end referral enrollment has not yet been verified.

## Hosted rollout — September 17, 2026

Migration applied and recorded in hosted Supabase. Application commit d952128 and navigation correction 7f41930 deployed. Live administrator editor successfully saved a draft without changing published copy, published the approved sample, and unpublished it (public page returned 404). The sample referral link opened signup with the affiliate code intact. Temporary partner removed; hosted database term verification used a rolled-back transaction and retained no test customer.

16 automated tests now pass, including enrollment attribution from signup metadata, existing customer non-reassignment, unpublished referral rejection and server-only Stripe affiliate metadata. Hosted snapshot test confirmed original 20%/10% terms survive an affiliate rate change to 25%/15%, with payouts disabled.

Remaining acceptance check: a real new-user email confirmation and checkout session for an affiliate referral. Waiting for user-provided test email. No test payment submitted. This is not evidence of a completed end-to-end customer purchase or affiliate payout.
