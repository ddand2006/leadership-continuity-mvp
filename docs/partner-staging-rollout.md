# Partner staging rollout

## Verified environment inventory — October 14, 2026

- GitHub repository: `ddand2006/leadership-continuity-mvp`, production branch `main`.
- The owner confirmed Hostinger as the final hosting provider on October 14. Use Hostinger
  for staging and production; follow `docs/hostinger-business-deploy.md`.
- GitHub also records a successful Vercel Production deployment of
  `c26ce5dde6b18c289640a6d1dad1a61599f3a1d7` on October 5. This record does not
  determine the intended hosting target. Existing Vercel deployment settings remain unchanged.
- Linked Supabase project: `hnrwovfgttenymnhowsf` (`leadership-continuity-mvp`, PostgreSQL 17.6).
- Hosted migration versions match all local versions through `202610040001`.
  Only `202610130001` and `202610130002` are pending.
- `supabase branches list` returned no existing preview branches.
- Supabase CLI and GitHub access work. Hostinger staging capacity, Node.js configuration,
  deployment branch, domain, and environment variables still require inspection in hPanel.
- Opening hPanel in the shared browser redirects to Hostinger's sign-in page. No Hostinger
  deployment credentials or configured SSH host are available in this workspace.
- Local `.env.local` points to local Supabase. It is not a staging configuration.

No hosted schema, customer data, deployment, email, Stripe payment, or transfer was changed
during this inventory. Database checks used read-only transactions.

## Hosted data preflight

The reusable audit is `scripts/affiliates/rollout-preflight.sql`. Run it against an explicitly
selected project with:

```sh
supabase db query --linked --project-ref <project-ref> --file scripts/affiliates/rollout-preflight.sql --output json
```

At 17:09 UTC on October 14:

- All required named constraints and coaching identity/eligibility functions were present.
- One existing partner application; zero approved applications lacking affiliate links.
- One verified payout contact will become an explicit owner; no conflicting partner/payout
  owner pairs and no unconfirmed approved owners were found.
- Zero coach roster rows or earnings rows; no historical payout receipts or renewal anchors
  need reconciliation based on this snapshot.
- One existing Connect reservation has no account ID. Migration 2 deliberately preserves its
  original onboarding start time. Do not reset an uncertain provider operation to retry it.

These are counts, not a review of the identity of the preserved owner or of Stripe state.
Re-run immediately before production migration because the data can change.

## Concrete staging target

Create a temporary Micro Supabase branch named `partner-rollout-20261014` from the linked
project, without the `--with-data` option. Use fictional accounts and records. The branch must
have its own project ref and credentials. Keep the checkout linked to production for inventory;
pass the staging ref explicitly to any staged query or mutation.

Supabase's published branch compute rate starts at $0.01344/hour for Micro, plus other usage.
Branch costs are outside the Spend Cap. The owner approved this temporary resource on October 14.
Delete the temporary branch after verification to stop further compute charges.
Source: [Supabase branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

After provisioning, inspect migration history and schema before applying anything: branch
initialization may already have applied migrations. Apply only missing migrations in order,
and record them through the normal Supabase migration flow. Never run the disposable SQL
bootstrap or `partner-workflows.sql` against the hosted production project.

Use a separate Hostinger Node.js application for the partner rehearsal, with a temporary domain
or a staging subdomain such as `staging.leadercontinuity.com` if available. Confirm the existing
plan can host it before provisioning. Use a dedicated deployment branch and separate app
environment variables. Inspect GitHub deployment integrations before pushing a branch that
could auto-deploy elsewhere:

- Both Supabase public and server credentials must point to the new staging project.
- `APP_URL` and Supabase auth redirect settings must resolve to the Hostinger staging URL.
- Every Stripe key, annual-price ID, and webhook must use the same intended test environment.
  Coaching and affiliate sandbox code use distinct test-key variable names; configure both.
- Preserve product and coaching entitlement checks. Disable outbound automations or use only
  test mailboxes controlled by the owner. Keep production settings unchanged.

Do not assume a Hostinger staging application has a separate database merely because its URL
is different. No staging application is deployed until environment isolation is verified.

## Acceptance rehearsal

1. Approve a fictional partner twice. Verify one linked unpublished affiliate, zero default
   commission, and an explicit owner. Set test terms and publish its referral page.
2. Open the referral link in a new session, enroll a new fictional company, complete confirmation,
   and verify its server-stored attribution and frozen terms. Repeat with an existing company
   and confirm attribution cannot be reassigned. Change rates and verify the first company
   retains its original terms.
3. Complete a Stripe test subscription purchase. Deliver/replay its signed webhook, verify one
   initial earnings record, then rehearse a renewal, hold, refund, and dispute. Onboard a test
   Connect account, approve a matured test commission, and verify repeat requests create only
   one transfer. Recover an uncertain receipt and a refund reversal without duplicate money movement.
4. Invite a new coach through a controlled test inbox, then add an existing test coach. Verify
   profile/roster reuse and that the existing profile content is preserved. Accept as that coach;
   a different coach cannot accept it. Complete marketplace approval requirements.
5. As the fictional company, filter coaches by the partner, choose the approved coach, and
   complete the existing test-mode hiring/payment/consent workflow. Verify the coach receives
   only authorized engagement access and the partner receives no private leader records or notes.
6. Verify owner/admin/finance/member permissions, a combined company/partner user's navigation,
   suspended-partner denial, leaving/reinviting the coach, and empty/error/mobile states.

Record staging URL, staging project ref, application commit, migration versions, test-provider
receipt IDs, screenshots, failures and resolutions in ignored verification artifacts. Keep secrets
and customer data out of the report. A mocked adapter pass does not complete these hosted checks.

## Current release gate

Hosted database, authentication, and Hostinger partner/coach/company screen checks passed as
recorded below. Staging is deployed at `https://cyan-hedgehog-998135.hostingersite.com`; the
reported HTTP 500 was fixed by correcting the pnpm dependency layout. The isolated affiliate sandbox checkout, refund, and signed webhook replay now pass.
Email-confirmed referral enrollment, ordinary subscription/coaching checkout, Connect transfer,
and transfer-reversal rehearsal remain pending.
Production deployment remains pending. No live coaching-payment activation is included.
The earlier Vercel sign-in request is superseded.

## Hosted rehearsal completed — October 14, 2026

Created Micro branch `partner-rollout-20261014`, project `vqnhwumruqkgznhqxiry`, at
18:14 UTC with `with_data=false`. Confirmed zero organizations and auth users before adding
fictional fixtures. Once initialization settled, the migration dry run identified exactly the
two intended migrations. Both applied successfully using `db push --project-ref` with
`--skip-vault`; no seed was requested. Post-migration preflight reported `202610130002` and
both migrations present.

The new branch initially lacked CRUD grants on pre-existing public tables. Production's explicit
table ACLs were read without customer data, compared with staging, and only missing grants on
existing tables were restored in staging. The three new private tables kept their restrictive
grants. No row policies or production permissions were changed. See
[Supabase branch default privileges](https://supabase.com/docs/guides/deployment/branching/working-with-branches).

Verification completed:

- The transactional partner/payout SQL workflow passed against the full hosted schema on
  PostgreSQL 17.11, then rolled back its fictional rows. The fixture supplied the full schema's
  required profile email field. Payout/receipt/reversal checks used fictional database facts;
  they did not call Stripe.
- Eleven checks through real hosted Supabase Auth/Data APIs passed, using five fictional,
  confirmed accounts: service-only approval, private membership access, canonical coach
  onboarding, wrong-user denial, acceptance, draft hiding, approved affiliation visibility,
  outsider denial, leaving, and fresh acceptance after reinvitation. No email was sent.
- The local Next.js application connected directly to hosted staging Supabase. Chrome verified
  partner sign-in/dashboard, existing-coach reuse through the API, coach sign-in/affiliation
  acceptance, company sign-in, and partner filtering of the approved coach in the marketplace.
  The company had no coaching entitlement, and the add-on gate remained visible. This did not
  test a Hostinger application or complete a hiring/payment flow.

Evidence is in ignored `artifacts/verification/partner-staging-*` and `partner-hosted-*` files,
including `partner-hosted-roster.png` and `partner-hosted-marketplace.png`.

The fictional browser session was signed out and the local app stopped. The temporary branch
was deleted after these checks, and a fresh branch list confirmed only `main` remains. Local
staging credentials were removed. Production still reports latest migration `202610040001`
with neither new partner migration applied. Recreate an isolated branch when Hostinger access
and Stripe test configuration are ready for the remaining rehearsal.

## Hostinger inspection and deployment preparation

The owner clarified that their authenticated session is in regular Chrome. That session works;
the product's shared browser has a separate signed-out session.

Verified inside hPanel:

- `leadercontinuity.com` is a running Next.js web app connected to
  `ddand2006/leadership-continuity-mvp`, automatically deploying `main`.
- Current completed deployment: `c26ce5dd`, October 5; Node 22.x, repository root `./`,
  npm package manager, `npm run build`, output `.next`.
- Business plan reports three of five web-app slots used. The staging flow can use an existing
  slot and a Hostinger temporary domain; no plan upgrade was selected.
- The staging onboarding flow supports archive upload. Source ZIP
  `artifacts/verification/partner-hostinger-staging.zip` contains the tracked working source and
  scoped new partner files. It excludes local environment files, credentials, build output,
  dependencies, and unrelated personal documents. Its SHA-256 and base commit are recorded in
  `partner-hostinger-package.json`. No git commit or push was needed.

Provisioned a new data-free Micro branch for the Hostinger rehearsal under the existing owner
authorization: `partner-hostinger-20261014`, project `aoddzpyemmdxadtosmmu`, branch ID
`478dc784-2bbb-4da4-939e-bfa24bb128b7`, created at 19:22 UTC October 14. Its dry run identified
exactly the two new migrations; both were applied. Missing legacy table grants were restored
only in this staging project from a fresh read-only production ACL snapshot. Credentials are
kept in ignored mode-0600 files for staging setup.

The initial archive upload was blocked by the Chrome extension's file-URL permission. After the
owner completed the Chrome setup, `setFiles` succeeded. Hostinger first returned a generic error;
refreshing the onboarding page and waiting for server preparation resolved it. Hostinger now shows
the 6.52 MB archive attached successfully.

The build review targeted `cyan-hedgehog-998135.hostingersite.com`, preset Next.js, root `./`,
with Node 22.x selected. The owner explicitly approved transmitting this branch's public and
private service-role keys to that Hostinger staging app and deploying it. All ten staging
environment settings imported successfully. They contain only the isolated Supabase URL/keys,
the temporary app URL, and product gates; no production, Stripe, or OpenAI credentials were copied.
Do not request the same approved credential transfer again for this staging target.

## Hostinger staging deployed

- URL: `https://cyan-hedgehog-998135.hostingersite.com`
- Hostinger deployment ID: `01a13c33-20ac-7176-907c-570a7adc2a11`
- Dashboard status: Completed, Current, Running. Web-app use is now four of five slots.
- Build: Node 22.x, pnpm 11.9.0, successful production build; Next.js standalone output
  published and Node server restarted. Hostinger reports total deployment duration 1m 36s.
- Supabase branch `aoddzpyemmdxadtosmmu` remains active for the hosted rehearsal, with both
  new migrations applied. Five fictional test identities and their fixture records are present.
- Staging Auth site URL and allowed `/auth/**` callbacks now use the temporary Hostinger domain.
  Config diff confirmed no remaining differences for those two declared settings; nine other
  inherited configuration properties were preserved.
- A fresh production read still reports latest migration `202610040001` and zero new partner
  migrations. No production hosting settings or data were changed; no git commit or push occurred.

The owner subsequently reached the staging app in Chrome and reported a plain Internal Server
Error. A deterministic HTTP check reproduced status 500 on `/auth?mode=partner`, `/auth`,
and `/`. Runtime logs identified `Cannot find module '@swc/helpers/_/_interop_require_default'`.
The source archive already contained the dependency and `.npmrc` hoisted setting, but pnpm 11
ignores that setting there: `pnpm config get nodeLinker` returned `undefined`, and the installed
layout was `isolated`. Moving `nodeLinker: hoisted` to `pnpm-workspace.yaml` makes the same
config probe pass and installs physical dependency folders. Local production build and
typecheck passed after reinstall with the unchanged lockfile.

Corrective staging redeployment uses `partner-hostinger-linker-fix.zip` (598 files, SHA-256
`aadd21eec54fdd5c00fc3b154f17a790eaec0dd0020b54eb140694aa10ed1189`). The original failing HTTP
loop is `node artifacts/verification/check-hostinger-auth.cjs`; its hosted result and browser
sign-in must pass before calling the staging app operational. Production remains untouched.

The corrective deployment `01a13c42-6e62-73cc-aff0-12be6bed23f1` completed in 1m20s.
The original HTTP assertion now passes (status 200, sign-in text present, no Internal Server
Error), and the homepage also returns 200. Chrome visibly renders the sign-in page. Fictional
partner and coach sign-ins succeeded on Hostinger; the owner dashboard, roster, team controls,
and coach affiliation screen render correctly. The coach accepted the fixture invitation through
the hosted UI, and a read of the isolated staging row confirmed `invitation_status=accepted`.
The fictional company administrator also signed in, saw the accepted partner affiliation on the
coach card, and successfully filtered the marketplace by that partner. The coaching add-on
gate remained visible because the fixture company has no coaching entitlement.
The new deployment runtime log has zero errors. Local build/typecheck and all 56 affiliate and
coaching tests passed; lint has zero errors and 26 existing warnings.

Evidence: `partner-hostinger-runtime-fix.json`, `hostinger-auth-fixed.json`,
`hostinger-staging-signin-fixed.png`, `hostinger-partner-roster-fixed.png`, and
`hostinger-coach-affiliation-accepted.png` in `artifacts/verification/`.

At the initial deployment, Stripe test keys/prices/webhooks and OpenAI credentials were absent.
The later Stripe rehearsal below adds only the two affiliate-sandbox credentials. Ordinary
billing/coaching and AI-backed flows must not be represented as tested. Hostinger also reports twelve
dependency vulnerabilities with highest severity High; their applicability has not been audited
as part of this staging deployment. Do not apply automatic dependency fixes without review.

Evidence: `artifacts/verification/partner-hostinger-deployment-result.json`,
`hostinger-staging-deployed.png`, `hostinger-staging-dashboard.png`, and
`hostinger-staging-chrome-block.png`. Private staging credentials remain in ignored mode-0600
files for the rehearsal; they are absent from the source archive and reports. Remove the
temporary database and staging fixture credentials after the remaining rehearsal is complete.

## Stripe rehearsal preparation — October 14, 2026

No Stripe credentials are configured in local `.env.local` or the Hostinger staging app.
The existing documented sandbox is LeaderContinuity (`acct_1UGhA8AwCxMs8Znx`); Chrome opened
its dashboard URL but Stripe requires owner sign-in. The account and its current products,
prices, and event destinations have not yet been verified. Do not create another Stripe account
or copy live credentials as a workaround.

Prepared configuration inventory: `artifacts/verification/partner-stripe-staging-plan.json`.
Begin with the existing isolated affiliate sandbox and these staging-only variables:
`STRIPE_AFFILIATE_TEST_SECRET_KEY` and `STRIPE_AFFILIATE_TEST_WEBHOOK_SECRET`.
Its endpoint is `https://cyan-hedgehog-998135.hostingersite.com/api/affiliates/sandbox/webhook`.
Use invoice.paid, invoice.payment_succeeded, charge.refunded, charge.dispute.created, and
charge.dispute.closed. Inspect existing destinations before creating or modifying anything.
Never change the production endpoint to the temporary Hostinger URL.

The full partner payout rehearsal has a code limitation, not just missing settings:
`recordAffiliateInvoice` rejects test subscription invoices before resolving the organization;
normal partner Connect requires a live key, and the payout route rejects test earnings.
The older isolated sandbox writes review estimates to `affiliate_sandbox_invoices`, so it does
not exercise the new `affiliate_earnings` payout, reconciliation, or reversal route. Do not
claim a test subscription/refund proves that route works. Resolve explicit isolated-staging
support before enabling the ordinary billing webhook for affiliate test subscriptions.
Production mode guards must remain intact.

Company subscription test pricing must match the app: Foundation USD 3,000/year, first
five-seat pack USD 1,350/year, subsequent five-seat packs USD 1,150/year. Those three test
price IDs must be supplied in that order through `STRIPE_PRICE_IDS`. Coaching's provider
requires `STRIPE_SECRET_KEY` to start with `sk_test_`. Its webhook is the staging
`/api/stripe/webhook` endpoint with a separate signing secret. All keys, products, and
webhooks must belong to the same verified sandbox.

Stripe supports simulated payments, refunds, and disputes without moving real money:
https://docs.stripe.com/testing. Webhook destinations need their own URL and event list:
https://docs.stripe.com/api/webhook_endpoints/create.

### Stripe sandbox inspection after owner sign-in

Verified LeaderContinuity sandbox `acct_1UGhA8AwCxMs8Znx` in Chrome. The product catalog is
empty even with filters cleared. Its single active destination, “Affiliate sandbox only,” sends
four event types to the production site's `/api/affiliates/sandbox/webhook`; it was not changed.

The existing `STRIPE_AFFILIATE_TEST_SECRET_KEY` is a test restricted key. Read-only inspection
of its permissions shows write access to customers, Checkout, invoices, subscriptions, and
payment intents, but read-only Accounts and Transfers. It supports the first checkout/estimate
rehearsal, not creating Connect accounts or sending transfers. Do not silently expand it or
claim full payout testing with it. No key was created, rotated, or modified; no credential was
printed or copied to Hostinger during this inspection.

Prepared (not submitted) “Hostinger staging — affiliate rehearsal” destination for the exact
staging `/api/affiliates/sandbox/webhook` URL, account scope, snapshot payloads, current stable
Dahlia API version `2026-08-26.dahlia`, with the five event types recorded above. The installed
Stripe SDK uses `2026-07-29.dahlia`, the same major version. Screenshot:
`artifacts/verification/stripe-staging-webhook-ready.png`.

Creating this new destination and transmitting the existing sandbox API key and its new signing
secret to Hostinger require specific browser-action confirmation. Prior confirmation covered
Supabase credentials, not Stripe credentials. Once approved, save them only in the temporary
staging app's environment, redeploy, and run simulated checkout/refund checks. Leave ordinary
billing webhook configuration until the test-ledger limitation has been resolved.

### Stripe credentials and first checkout — October 14, 2026

The owner explicitly approved creating the prepared staging webhook, saving the existing test
API key and new signing secret in the temporary Hostinger app, and redeploying. Created
`we_1UQfDuAwCxMs8ZnxjVjrYwKP` in the verified sandbox with exactly the five selected events.
Saved only `STRIPE_AFFILIATE_TEST_SECRET_KEY` and `STRIPE_AFFILIATE_TEST_WEBHOOK_SECRET`;
existing Supabase and app settings were retained. Hostinger applied the settings and deployed
`01a13d95-73c3-7396-b71f-7fe5209d3a7c` in 1m21s. No Stripe key permissions were changed.

Signature probes passed against the hosted endpoint: valid sandbox 200, invalid signature 400,
live-mode event 400. The probes used an ignored event type and changed no financial records.
Created a fictional, unpublished sandbox-only affiliate in the isolated branch at 20% initial,
10% renewal for two renewals. The hosted admin UI launched Checkout; Stripe completed a
simulated USD 3,000 annual subscription with its standard test card and fictional contact
information. Link information saving was unchecked. Evidence IDs are in
`artifacts/verification/partner-stripe-payment.json`; no real payment was submitted.

Stripe's paid-invoice delivery revealed a schema-contract regression: the shared calculator's
new `billing_period_start` field was spread into `affiliate_sandbox_invoices`, which deliberately
has no live lifecycle columns. Both the real-invoice replay and a regression test reproduced it.
The fix projects only the sandbox table's supported commission fields. The regression covers
paid and refunded invoices using the real calculator; all 57 tests, build, typecheck, and targeted
lint pass. The corrected real-invoice replay recorded the expected USD 600 estimate in staging.
This local replay is not proof that the hosted webhook is fixed; corrective deployment and
Stripe delivery retry must be verified separately. Package SHA and fixture evidence are in
`partner-stripe-sandbox-package.json` and `partner-stripe-fixture.json`.

### Hosted affiliate sandbox rehearsal passed

Corrective deployment `01a13d9a-a530-7274-a208-667d4b7e8d8a` completed in 1m20s with
`partner-stripe-sandbox-fix.zip`. Replaying the same actual paid-invoice event through the
hosted endpoint changed the result from 500 to 200. Stripe's own Resend action also returned
200 for invoice.paid. The hosted earnings UI displayed one USD 600 pending estimate; repeated
delivery did not add an invoice row.

Created a USD 1,000 partial refund of the simulated USD 3,000 charge using a stable test-only
idempotency key. Stripe reported succeeded and automatically delivered charge.refunded with
200. Without manually updating the ledger, the hosted UI and staging table showed the same
single invoice row, now USD 0 and held for refund/payment-source review. A signed replay of
the actual refund event returned 200 and left that state unchanged. This is the existing
sandbox's conservative hold behavior, not proof of proportional settlement or clawback in
the new live ledger. Cancelled the fictional Stripe subscription with no prorated invoice to
prevent future simulated renewals. No real payment, payout, or transfer occurred.

Evidence (ignored): `partner-stripe-payment.json`, `partner-stripe-paid-replay-red.json`,
`partner-stripe-paid-replay.json`, `partner-stripe-refund.json`,
`partner-stripe-replay-and-cleanup.json`, `partner-stripe-refund-ledger.json`,
`stripe-staging-paid-and-refund-webhooks-200.png`, `hostinger-stripe-refund-hold.png`, and
`partner-stripe-webhook-signatures.json`. Private credentials remain mode-0600 and absent from
the archive, reports, and Git. The temporary Supabase branch remains active for the remaining
rehearsal; its previously approved compute charges continue until cleanup.

Remaining release gates: confirmed-email referral enrollment and immutable attribution through
ordinary test subscription checkout; explicit isolated test support for the ordinary earnings,
partner Connect, payout, and reversal path; renewal/dispute/provider recovery tests; and
coaching test hiring/payment. The current restricted sandbox key permits reading Accounts and
Transfers but cannot create Connect accounts or transfers. Its permissions were not expanded.
No production deployment, production migration, or production credential change occurred.

### Ordinary ledger staging support prepared — October 15, 2026

Added explicit `AFFILIATE_PAYMENT_MODE=staging` with a matching
`AFFILIATE_STAGING_PROJECT_REF`. It permits the ordinary earnings, partner Connect,
reconciliation, payout, and reversal routes to use Stripe test records only when the app
has a temporary HTTPS Hostinger domain and a separate, matching Supabase project. The
production project ref, mismatched database, live Stripe key, and live event/earning are
rejected. Without these settings, the ordinary affiliate paths remain live-only. No new
database migration is needed; existing ledger and Connect rows already include mode.

The payout queue shows a simulated-money notice in staging. Commission rates still require
manual configuration; the affiliate defaults were not changed. The existing isolated sandbox
continues to use its separate key and small estimate table.

All 77 affiliate, billing, and coaching tests passed, including mixed-mode rejection,
Connect reservation mode, lost transfer receipts, and reversal receipt recovery without a
second provider reversal. Typecheck and the production webpack build passed. Repository
lint has zero errors and 25 existing warnings. These checks do not substitute for a hosted
Stripe transfer and reversal. This update has not yet been deployed.

Next configuration requires a dedicated restricted key in the existing LeaderContinuity
sandbox with account/onboarding and transfer write access in addition to the billing
resources needed by the rehearsal. Prepare its exact permissions before requesting the
required action-time approval. Do not expand the older sandbox key. Also prepare a separate
staging `/api/stripe/webhook` destination with the phase-2 event list. Saving the new test key
and signing secret in this exact temporary Hostinger app requires specific confirmation;
the earlier confirmation covered the existing restricted key and isolated-sandbox secret.

Prepared, but did not submit, the sandbox key “Hostinger staging — payout rehearsal”:
14 write permissions (Account Links, Accounts, Charges and Refunds, Checkout Sessions,
Customer Portal, Customers, Invoices, Payment Intents, Payment Methods, Prices, Products,
Subscriptions, Test Clocks, Transfers) and three read permissions (Balance, Events, Payment
Disputes). Connected-account API permissions remain none. This key can create and reverse
simulated affiliate transfers; it cannot access live payments. The older key is unchanged.

The separate “Hostinger staging — billing and payout rehearsal” webhook draft targets
`https://cyan-hedgehog-998135.hostingersite.com/api/stripe/webhook` with 18 platform-account
events: the phase-2 list excluding `account.updated`, which is a connected-account event.
Connect readiness is refreshed through the authenticated status action during rehearsal.
Both drafts remain at their final review screens. Screenshots are
`stripe-staging-payout-key-review.png` and `stripe-staging-billing-webhook-review.png`.
The verified source archive is `partner-affiliate-payout-staging.zip` (600 files); its SHA and
credential scan result are recorded in `partner-affiliate-payout-staging-package.json`.
Hosted verification and coaching's separate test-key compatibility gate remain pending.

### Ordinary checkout and commission ledger verified — October 15, 2026

The owner approved creating the reviewed restricted test key and webhook, saving their
credentials in the exact temporary Hostinger app, and deploying. Created the dedicated
sandbox key with the reviewed 17 permissions and destination
`we_1UQpJgAwCxMs8Znx0WMfLf80` with the 18 platform-account events. Created three annual
test prices for USD 3,000 / 1,350 / 1,150. Existing credentials and destinations were retained;
new private credentials are ignored and mode-0600. Hostinger now has 17 environment settings.

Deployment `01a13fe5-1ab9-704d-85e5-a82446118c04` completed with the original payout
archive. The hosted queue returned `livemode:false`; valid signed test events returned 200,
invalid signatures 400, and signed live events 400. Company access to the payout API was 403.

The first ordinary Checkout request returned 500 because the sandbox defaults to Managed
Payments and the test products lacked tax codes. The isolated affiliate staging mode now
explicitly requests direct payments per session. Production retains its account defaults.
The regression first failed with the same 500 symptom, then passed. All 79 affiliate, billing,
and coaching tests, targeted lint, typecheck, and webpack build passed. Corrective deployment
`01a13fe9-f134-707c-9fa6-9fcfd9e71c21` completed in 1m29s using
`partner-affiliate-payout-checkout-fix.zip`; the hosted Checkout retry returned 200 with
`managed_payments.enabled:false` and `livemode:false`.

Seeded a fictional ordinary affiliate and organization through the existing attribution
trigger, with explicit 10% initial / 10% renewal rates, two renewals, and a zero-day hold for
immediate rehearsal. This did not change commission defaults. Confirmed-email referral
enrollment remains a separate unverified gate. Completed the company's USD 3,000 annual
test subscription in Stripe Checkout with the standard test card and fictional billing
details; Link saving was unchecked. Invoice `in_1UQpSlAwCxMs8ZnxPJfGC6Yd` created exactly
one ordinary `affiliate_earnings` row automatically, with USD 2,912.70 eligible after the
fixture agreement's USD 87.30 processing-fee exclusion and USD 291.27 commission at 10%.
Stripe's automatic invoice.paid and invoice.payment_succeeded deliveries both returned 200.
Replaying the actual invoice.paid event returned 200 and preserved one commission row.
The hosted admin queue visibly shows test mode and USD 291.27 payable.

The partner's authenticated onboarding route created test Connect account
`acct_1UQpMtBkngOQXnSO`. Stripe's built-in test phone/code and test bank autofill were used
with a fictional name and Stripe's documented successful website token. Finished without
saving the bank details to Link. Onboarding is paused at the final **Agree and submit**
screen: only `tos_acceptance.date` and `tos_acceptance.ip` remain due. The browser's
action-time agreement confirmation requirement applies; creation of the key/webhook did
not authorize accepting this separate Connected Account Agreement and Acquirer Disclosure.
The final action has not been submitted. The authenticated app status correctly reports
payouts disabled, and a payout attempt returns 409 “Stripe payout account is not ready,”
with no provider transfer, no payout receipt, and zero payout attempts recorded.

Pending: owner approval of that exact test agreement, then the actual simulated transfer,
partial refund, proportional adjustment and reversal, and retry/replay checks. The fictional
subscription is still active for this unfinished rehearsal and must be cancelled without a
prorated invoice during cleanup. The temporary paid Supabase branch remains active. Evidence
includes `partner-payout-pre-transfer-checks.json`, `partner-payout-webhook-signatures.json`,
`partner-payout-paid-invoice.json`, `hostinger-ordinary-test-commission-payable.png`,
`stripe-ordinary-paid-webhooks-200.png`, and `stripe-test-connect-agreement-review.png`.

### Ordinary transfer, refund, and reversal passed — October 15, 2026

The owner explicitly approved submitting the reviewed test Connect agreement. Submission
completed and both Stripe and the authenticated app reported details submitted, payouts
enabled, and transfers active for `acct_1UQpMtBkngOQXnSO`.

The first transfer was rejected because the sandbox had no available balance: Checkout
receipts were still pending. Added USD 2,000 in simulated available balance using Stripe's
test token, with a stable idempotency key and staging metadata. This revealed a real recovery
bug: Stripe v1 retained the first `balance_insufficient` error under the payout request key,
so funding did not make a retry succeed. A direct replay confirmed HTTP 400,
`StripeInvalidRequestError`, `balance_insufficient`, and `idempotent-replayed:true`, with
zero matching transfers. No uncertain request was reset manually.

Migration `202610150001_affiliate_payout_rejected_requests.sql` adds a persistent request key
and a service-only rejection receipt routine. A definitive insufficient-funds rejection with
a Stripe request ID atomically records an audit event, retires only that matching request,
and returns the commission for a fresh administrator approval. Stale/duplicate rejections
cannot reopen a newer request or paid receipt. Timeouts and unknown errors keep the original
reservation and key. The payout queue refreshes after errors to show the actual server state.
The regression failed before the fix and passed after it. All 81 tests, eight actual staging
database checks (rolled back), typecheck, targeted lint, and webpack build passed. The migration
was applied and recorded only in staging. Recovery deployment
`01a13ff8-4985-7155-9e20-83515e5e3ce7` completed in 1m30s using
`partner-affiliate-payout-recovery.zip` (601 files; SHA in its package report).

The hosted endpoint recovered the original cached rejection with 409, preserved zero provider
transfers, and returned the row to payable with one rejection audit receipt. A fresh approval
through the hosted admin UI created test transfer `tr_1UQphdAwCxMs8ZnxGd7WEn6u` for USD
291.27. The ordinary ledger retained its paid receipt; a duplicate pay action returned 409,
and Stripe showed exactly one matching transfer.

Created a USD 1,000 partial refund of the original USD 3,000 test subscription charge. The
automatic Stripe refund delivery retained the original USD 291.27 payout and created a USD
100 negative adjustment requiring reconciliation. The hosted queue displayed the adjustment;
its Recover adjustment action created reversal `trr_1UQpiNAwCxMs8ZnxCyzdd2GU` for exactly USD
100. Stripe and the ledger agree: one transfer, one reversal, USD 191.27 net commission, zero
remaining adjustment, and `reconciliation_required:false`. Duplicate reversal returned 409;
replaying the actual refund event returned 200 and preserved these counts and amounts. The
queue cleared. No real money moved.

Cancelled the test subscription `sub_1UQpSnAwCxMs8Znxvm1ONDaA` without proration or another
invoice. The test funding charge and Connect account remain fictional sandbox fixtures for
the remaining rehearsal. The temporary Supabase branch is still needed for confirmed-email
referral, renewal/dispute, and coaching hiring/payment checks; delete it after those gates and
owner review. Production migrations, credentials, and deployment remain unchanged.

Evidence: `partner-payout-connect-ready.json`, `partner-payout-cached-rejection.json`,
`partner-payout-rejection-recovered.json`, `payout-recovery-database-checks.log`,
`partner-payout-transfer.json`, `partner-payout-partial-refund.json`,
`partner-payout-refund-adjustment.json`, `partner-payout-reversal-verified.json`,
`partner-payout-subscription-cleanup.json`, `hostinger-payout-refund-adjustment.png`, and
`hostinger-payout-reversal-cleared.png`. Minor copy follow-up: a resolved ledger adjustment
retains its historical reason string even when the reconciliation flag is false; the payout
queue correctly removes it. Review the partner earnings wording before production release.

### Confirmation gate and hosted coaching checkout — October 15, 2026

The owner supplied a controlled Gmail alias for the signup confirmation test. Initial signup
returned an immediately confirmed session: staging Auth had `mailer_autoconfirm:true`, so no
confirmation email was sent. Reviewed an isolated config diff, then explicitly enabled only
`auth.email.enable_confirmations` on `aoddzpyemmdxadtosmmu`. Eleven undeclared settings were
left unchanged. Reset only the new, unprovisioned rehearsal account's confirmation flag and
requested a signup confirmation email with the exact Hostinger callback. Supabase accepted
the request; subsequent public settings reported auto-confirm false, password sign-in returned
`email_not_confirmed`, and no organization/profile existed. Recipient receipt and successful
browser confirmation remain pending; an accepted send request is not delivery proof.

A separate fictional API-confirmed account exercised the hosted `/api/account-requests` route.
It received the server-resolved affiliate and the manually configured 1,000-basis-point terms;
injected 9,999-basis-point signup metadata was ignored. Repeated enrollment after replacing
referral metadata returned the same organization. Actual database attempts to clear attribution
or rewrite frozen rates were rejected. Evidence: `partner-referral-confirmation-gate.json` and
`partner-referral-attribution-verified.json`. This API test does not replace inbox/browser testing.

Exercised actual authenticated coaching RPCs for company request, partner coach invitation,
coach interest, leader selection, and engagement setup. Configured one fictional USD 300
package with USD 175 compensation per verified session. Both buyer and coach used the hosted
UI to record explicitly NON-BINDING STAGING TEST ONLY terms; no service, real money, or legal
obligation was created. Affiliate access to the private agreement table and billing RPC was
denied. Actual Stripe Connect terms are separate and require their own review/approval.

Two coaching adapter regressions failed before fixes: restricted test keys were rejected by a
full-key-only prefix check, and direct checkout inherited the sandbox Managed Payments default.
The adapter now accepts `rk_test_` alongside `sk_test_` while rejecting live/invalid keys before
provider writes, and explicitly disables Managed Payments for its test-only direct checkout.
All 17 targeted checkout, enrollment, and coaching-provider tests passed, as did typecheck,
targeted lint and webpack build. Deployed `partner-coaching-checkout-fix.zip` (601 files,
SHA-256 `548f8952f452f1f27d26c4cd6d4a26a812d49dbffcf231e5af1d930600afb2e0`)
as Hostinger staging deployment `01a140df-f0b7-722e-a45d-0595657adb64`, completed in 1m26s.
All 17 existing environment rows were preserved; no credentials or migrations changed here.

The hosted Pay with Stripe action created test payment checkout for exactly USD 300 with
Managed Payments disabled. Paid using Stripe's fictional test Visa. Stripe completed the
session and actual webhook delivery marked payment `d2190e15-9479-412a-9bac-789b51e003ff`
paid, invoice `in_1UQtf4AwCxMs8ZnxvieClpCM`, intent `pi_3UQtf2AwCxMs8Znx3RUlcMDm`.
The ledger recorded USD 300 revenue and a separate USD 9 processing fee. The coaching invoice
created zero affiliate subscription earnings. Replaying the real checkout event returned 200
and left both revenue entries unchanged. The hosted screen showed paid and USD 0 due.
Evidence: `partner-coaching-agreement-access.json`, `partner-coaching-payment-verified.json`,
`partner-coaching-checkout-package.json`, `referral-coaching-regression.log`, and
`hostinger-coaching-payment-paid.png`.

Remaining: inbox/browser referral confirmation, referral subscription checkout, renewal/dispute
rehearsals, coaching fulfillment/compensation/payout/refund, resolved affiliate reason copy,
and owner review. Production remains unchanged. Temporary paid staging branch remains active
for these gates and must be deleted after testing and review.

### Coaching consent and earned compensation follow-up — October 15, 2026

The actual authenticated consent RPC failed with `DELETE requires a WHERE clause`. The shared
privacy invalidation trigger used an unqualified delete of coaching aggregate snapshots,
which the hosted Data API's query guard rejects. Migration
`202610150002_coaching_privacy_cache_invalidation.sql` adds an explicit non-null primary-key
predicate, preserving full organization/platform cache invalidation and metric privacy flags.
The staging-only dry run listed exactly this migration; applied with explicit staging project
ref and `--skip-vault`. Production was not changed. No application redeployment was necessary
for the function replacement; the previous ZIP predates this migration and the next archive
must include it.

The SQL connection cannot load `safeupdate` (managed privilege restriction), so that attempted
SQL guard test was not claimed as passing. The actual hosted authenticated consent workflow
was the failing and passing reproduction. All four fictional client consent operations then
succeeded; the accepted/paid engagement activated and the coach RPC logged one clearly
fictional 60-minute completed session. Exactly one USD 175 compensation entry was created
and approved through the platform RPC. The rollback-only SQL regression separately confirmed
that both aggregate cache scopes are invalidated by the actual trigger. Post-migration
preflight reports latest `202610150002`, all four rollout migrations present, and zero missing
payout receipt inconsistencies.

The hosted coach payment setup created separate test Connect account `acct_1UQtiRBEesBABA4A`.
It is paused at the initial Stripe Connect terms/phone screen; no terms were accepted, test
phone submitted, payout prepared, or coach transfer sent. The earlier owner approval applies
to the affiliate's separate Connect account only. The exact coach screen is retained for
review. Evidence: `partner-coaching-compensation-verified.json`,
`coaching-privacy-cache-database.log`, `referral-coaching-post-preflight.log`, and
`stripe-coach-connect-terms-review.png`. Inbox confirmation is still pending at this checkpoint.

### Expired signup email and authoritative-link session fix — October 15, 2026

The owner reported clicking the confirmation email. Actual staging Auth still showed the alias
unconfirmed and no profile/workspace. Their Chrome result tab was stuck on Completing your
sign-in; its fragment contained `access_denied`, `otp_expired`, and Email link is invalid or
has expired. The click occurred more than two hours after the earlier send. No token values
were captured in the public evidence.

Five new component-level regression cases failed before changes: provider error fragments
were ignored; missing signup details reused an existing account; a background refresh could
win against a valid link exchange; signup token hashes were not accepted; and verification
failures could race a redirect. The confirmation page now handles provider errors first,
requires fresh verification details for signup/invite/recovery, accepts supported signup and
magic-link token hashes, and uses only the explicit link exchange result to complete those
flows. Removed the competing auth-event completion callback. Error headings/descriptions now
show the actual failure state instead of claiming the link is valid. Invite/recovery password
setup and implicit signup tokens remain covered. All 11 auth/browser/enrollment tests,
typecheck, targeted lint, webpack build, and diff checks passed.

Hostinger deployment `01a14168-ac94-702a-9a45-70fd6f0bb2de` completed in 1m27s from
`partner-auth-confirmation-fix.zip` (604 files; SHA-256
`afceb56eb563dc8c83129921450d9b697ed5aa83c5343d48e33d7e57a7095637`).
All 17 existing environment rows were preserved. The archive includes the latest coaching
privacy migration and its SQL regression. No production changes were made.

Reloading the owner's expired link now visibly reports Unable to complete email link. A
separate fictional, initially unconfirmed account used an API-generated one-use signup hash
through the actual Chrome confirmation page; it confirmed, created one workspace with the
correct frozen affiliate attribution, and reached `/subscribe?setup=1` with the USD 3,000/year
capacity selector. This test did not send email or charge a payment. It does not establish that
the owner's alias has confirmed. Requested a fresh confirmation email for that alias at
21:14:40 UTC; Supabase accepted the request. Owner use of the newest inbox link remains pending.
The separate coach Connect agreement approval also remains pending; no coach onboarding terms
were accepted during this work.

Evidence: `partner-referral-expired-link.json`, `auth-confirmation-regression.log`,
`partner-auth-confirmation-package.json`, `partner-confirmation-browser-verified.json`,
`hostinger-confirmation-expired-fixed.png`, and `hostinger-referral-plan-selection.png`.
Minor onboarding-copy follow-up: a newly created workspace reaches the capacity selector but
its surrounding subscription-inactive text currently uses renewal wording.

### Owner inbox confirmation passed — October 15, 2026

The owner clicked the newest confirmation email for the controlled Gmail alias. The actual
Chrome session reached `/subscribe?setup=1` and displayed the USD 3,000/year organization
capacity selector for the expected fictional company. Staging Auth reports the alias confirmed.
Database verification found exactly one profile, one active CEO/admin organization membership,
one approved account request, and one workspace. The workspace is attributed to
`ordinary-payout-rehearsal` with the affiliate's manually configured 1,000-basis-point initial
and renewal rates frozen on the organization. No payment was submitted and production remains
unchanged. Evidence: `partner-owner-referral-confirmed.json` and
`hostinger-owner-referral-plan-selection.png`.

Remaining: referral subscription checkout, renewal/dispute rehearsals, coach Connect approval
and onboarding, coaching payout/refund, resolved affiliate reason copy, and owner review.

### Coach Connect onboarding and missed-webhook recovery — October 15, 2026

The fictional coach completed Stripe-hosted Connect onboarding with Stripe test data. Stripe
reports the connected account with submitted details, charges enabled, payouts enabled, terms
accepted, and one test bank account. The staging database initially remained in `onboarding`
with charges and payouts disabled because the platform webhook endpoint receives platform
events and did not receive the connected account's `account.updated` event.

The coach earnings read now reconciles an incomplete local Connect record against Stripe and
persists the current account state before rendering. It stops polling after the account is
active, and the existing webhook remains the normal update path. A regression test covers the
missed-connected-webhook case. All 8 coaching commerce provider tests, typecheck, lint with the
existing warnings, and production build passed.

Hostinger deployment `01a14228-1e17-7175-b8b1-42d53ff2e61b` completed in 1m28s from
`partner-coach-connect-status-fix.zip` (604 files; SHA-256
`022dda4b846ad2cffe4952ac09e324a71671a5effe24f5240630f71b16a71b82`). Reloading the live
coach earnings page changed the payment setup message to `Your Stripe payment account is
active.` The independent staging check then matched Stripe and the database on active status,
charges enabled, payouts enabled, and onboarding completion. No transfer or refund was sent.
Production remains unchanged.

Evidence: `partner-coach-connect-status-package.json` and
`check-coach-connect-status.cjs`.

### Coaching payout and partial-refund rehearsal — October 15, 2026

The fictional coach's approved USD 175 compensation was paid once through Stripe Connect.
The staging ledger marked payout `51fabae6-043b-403d-98d0-df27a97fc516` paid with transfer
`tr_1UQzJ3AwCxMs8Znxzsp6eWNM`; a repeated request did not create another transfer. The
associated USD 300 coaching payment then received a real USD 100 Stripe test refund. Webhook
processing marked the payment partially refunded, retained the already-paid USD 175 coach
compensation under the explicit adjustment policy, and left USD 16 of net platform revenue.
Replaying the refund event did not duplicate the refund or change the payout. No real money
moved. Evidence: `partner-coach-payout-verified.json` and
`partner-coaching-refund-verified.json`.

### Referred subscription, annual renewal, and dispute release — October 16, 2026

The confirmed referred owner completed a real Stripe sandbox Checkout for the USD 3,000 annual
plan. The initial earning used USD 2,912.70 after the verified USD 87.30 processing fee and
created a pending USD 291.27 commission at the manually configured 1,000-basis-point rate.
No automatic commission default was introduced. Evidence:
`partner-owner-checkout-verified.json`.

An isolated Stripe test clock then produced a true `subscription_cycle` invoice one year later.
The webhook created renewal number 1 for another USD 291.27, with exactly one initial earning
and one renewal earning and no reconciliation flag. Evidence:
`partner-referral-renewal-verified.json`.

The following annual cycle used Stripe's dispute test payment method. The real dispute event
correctly held renewal number 2 at zero. After winning evidence closed the dispute as `won`,
Stripe continued to report the charge's historical `disputed` flag as true. The app had treated
that flag as the current dispute state, so the commission remained held. The reconciliation
path now reads the actual dispute statuses: open or lost disputes continue to block commission;
`won`, `prevented`, and `warning_closed` disputes release it.

The fix passed 10 focused commission tests, typecheck, targeted lint, and the production build.
Hostinger deployment `01a144f1-6fcf-7378-87ab-f96ade1745dc` completed in 1m29s from
`partner-affiliate-dispute-release-fix.zip` (604 files; SHA-256
`bbab8ed02a73a90b6ca7adab37149ae11b559c2a1e2a7dd7b4a6e13e241c2672`). The home and
coaching routes both returned HTTP 200 after deployment. Replaying the authentic
`charge.dispute.closed` event restored renewal number 2 to pending at USD 291.27, and a second
replay left the single earning unchanged. Evidence: `partner-referral-dispute-verified.json`
and `partner-affiliate-dispute-release-package.json`.

Cancelled the fictional test-clock subscription without proration or a final invoice, so it
cannot produce another renewal. Stripe reports the clock ready and scheduled for automatic
deletion on November 15, 2026. Evidence: `partner-referral-clock-cleanup.json`.

After reviewing the completed rehearsal, the owner explicitly approved deletion of the paid
Supabase branch. Deleted branch `partner-hostinger-20261014` (branch ID
`478dc784-2bbb-4da4-939e-bfa24bb128b7`, project `aoddzpyemmdxadtosmmu`). A fresh branch list
shows only the healthy production `main` branch, so the temporary compute charge has stopped.
The Hostinger staging deployment now points to a deleted data backend and is retained only as
deployment history; it should not be used for further testing without a new isolated branch and
fresh credentials. Production remains unchanged. Evidence: `partner-staging-branch-deleted.json`.
