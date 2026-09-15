# Coaching Sprint 3 — commerce

Implemented in Leader Continuity, separately from coaching content and existing subscription billing. Coaching stays last in the top navigation.

## Status

The application, migration and isolated tests are implemented. Hosted migrations and live deployment have not been run. Real Stripe test checkout, Connect onboarding and test transfers still require configured Stripe test credentials and a registered webhook endpoint. The adapter tests use mocks and the real Stripe SDK's signature verification; they are not evidence of a completed transaction at Stripe.

## Screens

- `/admin/coaching/packages`: packages, components, organization pricing, discounts, agreement text, visibility and compensation/payout policy.
- `/admin/coaching/financials`: quotes, receipts, manual payments, refunds, cancellation dispositions, billing authorization, scheduling holds, reconciliation, exports and provider event status.
- `/admin/coaching/coach-compensation`: private commercial profiles, effective compensation rules, engagement overrides, earnings approval, adjustments and payout preparation.
- `/coaching/checkout/:engagementId`: frozen quote, agreement, organization attestation and installment checkout.
- `/coaching/billing`: organization commitments, outstanding installments, invoices and refund requests.
- `/coaching/earnings`: coach-only contract terms, earnings, payment setup and transfer history.
- Engagement **Commercial** tab: platform-only summary.
- `/api/coaching/financial-export?type=payments&format=csv`: platform-only export. Types: payments, invoices, compensation, payouts, revenue, refunds. Formats: CSV and XLSX.

## Commercial workflow

1. Platform configures packages, reviewed organization/coach terms and compensation rules. No production prices or agreement language are seeded by the migration.
2. Select an engagement and package. Organization-specific pricing takes precedence over package pricing; a custom quote is used only if neither is set. Per-unit pricing is multiplied by frozen package quantities. Fixed or percentage platform fees are added when configured. Markup/custom models use the resolved organization price and independently negotiated coach compensation.
3. Sending a quote freezes its scope, price, cancellation terms, compensation and agreement text/version. Decline/cancel and issue a new quote to change sent terms. Accepted agreement values cannot be overwritten.
4. Organization accepts the quote, then separately attests to the agreement. Coach independently accepts their compensation/delivery terms. Billing access never substitutes for the coachee's Sprint 1/2 consents.
5. Pay-in-full, rounded monthly installments, custom installments and verified-session billing are supported. Monthly/custom amounts sum exactly to the frozen quote. Billing is initiated through explicit installment Checkout; no automatic subscription or unattended collection job is installed.
6. A separate `coaching_commercial_controls` row gates new engagement activation. Accepted terms plus the required collection or documented platform billing authorization clear the gate. Existing engagements are grandfathered until a quote is created. Payment failure changes commerce status and alerts administrators; it does not delete, cancel or automatically pause coaching.
7. Completed paid sessions earn compensation under the frozen documentation policy: completed, coach-confirmed, or both-confirmed. Scheduled sessions earn nothing. Per-hour rates use actual duration. Fixed/percentage/custom compensation is earned at operational completion. Original earned session facts and ledger amounts cannot be silently rewritten.
8. Platform approves earnings, prepares a payout from the locked approved balance, then explicitly sends a Stripe test transfer. Payout policy can record weekly/twice-monthly/monthly/manual cadence; all transfers currently require manual approval. “Paid” means transferred to the coach's connected Stripe account, not confirmed arrival at their bank.
9. Refund requests reserve the available refundable amount and require platform approval. External/manual refunds require an external reference. Stripe dashboard refunds are imported into the same ledger. Refunds append revenue reversals; any coach clawback requires a separate documented compensation adjustment.
10. Final reconciliation requires operational completion, resolved installments/refunds and settled compensation. Cancellation dispositions are additional, explicit reviewed charges/costs and never consume a contracted session slot.

## Security and history

Financial tables have RLS enabled and no raw authenticated grants. Role-specific `coaching_commerce_read` projections allow organization admins their own billing, coaches only their own compensation/payouts, and platform admins financial operations. Provider IDs are withheld from UI projections. Existing hospital-admin permissions serve as billing authority; no new application role grants access to private notes. The existing role enum has no independent granular billing permission infrastructure.

Browser submissions cannot set final checkout/transfer amounts or provider status. Protected database records determine those values. Provider functions are executable only by the service role. Existing Supabase session clients remain the source of user authorization; finance does not use the support-mode workspace client.

The existing `/api/stripe/webhook` verifies the raw Stripe signature before dispatching coaching events. Subscription events continue through the original handler. Event rows are locked and processed transactionally; failed processing rolls back financial mutations and remains retryable. Database uniqueness, stable Stripe idempotency keys, locked installment/payout rows, refund reservation and append-only ledger keys prevent duplicates. An uncertain outbound operation older than 23 hours requires provider reconciliation instead of changing its idempotency key. A known Checkout session is retrieved and confirmed expired before another attempt is created.

Electronic attestation records name, title, account, version and timestamp. Server actions can enrich it once through the service-only provider RPC with observed browser user-agent and IP. `COACHING_TRUST_PROXY=true` must be set only behind a trusted proxy that sanitizes `x-forwarded-for`; otherwise IP is explicitly unavailable. Direct RPC acceptance records its transport user-agent and no asserted IP. This is electronic attestation, not a certified e-signature system.

Financial audit events reuse `platform_audit_events`, including record IDs, status/rate/price changes and adjustment reasons. They do not retrieve coaching narratives. Organization payment holds leave commerce access available for resolving the balance; suspended/deleted accounts remain denied.

## Stripe configuration and operational limits

Uses the installed Stripe SDK and existing `getStripe`, app URL, organization customer ID, Supabase service client and webhook route. Required: `STRIPE_SECRET_KEY` (must start `sk_test_` for coaching), `STRIPE_WEBHOOK_SECRET`, configured public app URL, and existing Supabase server/service settings. Hosted Checkout does not need a publishable browser key. No card, CVV or raw bank fields are stored.

Register relevant test events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `account.updated`.

This release handles USD and US Express Connect onboarding only. It performs no currency conversion or custom tax calculation. Stripe Tax has not been activated: establish tax configuration before enabling any taxable/live commercial flow. Live coaching payments are deliberately unavailable in the provider adapter pending that rollout validation. Existing subscription billing is unchanged.

Revenue is an operational cash/earned-cost ledger, not GAAP accounting. Processing fees are added when Stripe returns the balance transaction; unknown fees remain null and are disclosed in the dashboard. Bank payout reconciliation, disputes and automated scheduled collection/payout execution are outside this implementation. Stripe invoices are linked by hosted URLs; manual payments are receipt records and do not fabricate Stripe invoices.

Commerce notifications reuse the existing in-app inbox and optional Resend outbox. Expiry/past-due reminders are evaluated when billing/admin screens are read; there is no background scheduler. Webhook-created notifications remain in-app unless a configured outbox worker delivers them. Platform admin settings use structured JSON for advanced cancellation terms and custom installment definitions in this first admin editor.

## Validation

- Sprint 1/2 migrations and their 98 existing PostgreSQL checks run before the new migration.
- `scripts/coaching/sprint3.test.sql`: transaction-rolled-back fixtures verify pricing, historical terms, rounding, both acceptances, duplicate/out-of-order provider events, payments, refunds, compensation, cancellation, holds, payout state and finance/content access boundaries.
- `scripts/coaching/commerce-model.test.mjs`: exact cents and CSV injection safety.
- `scripts/coaching/commerce-provider.test.cjs`: mocked Stripe/database transports plus real SDK signature verification, checkout reuse, customer reuse, Connect and stable refund/transfer keys.
- Existing coaching model/timezone tests remain included.
- Browser checks cover platform/organization/coach/coachee roles, agreement workflow, manual installment receipt, missing-Stripe handling, CSV/XLSX exports and mobile layout.
- TypeScript, targeted ESLint and a webpack production build.

The isolated PostgreSQL fixture is smaller than the hosted platform schema. A hosted staging migration and real Stripe test flow are required before production release. No live records, emails or payments were used during development.

### Local test sequence

Use a new disposable PostgreSQL database with `anon`, `authenticated` and `service_role` roles. Run the existing test bootstrap (skip its role creation if those roles already exist), Sprint 1 migration, Sprint 1 RLS tests, Sprint 2 bootstrap, Sprint 2 migration, Sprint 2 tests, the Sprint 3 migration, then Sprint 3 tests. Each assertion suite rolls back its data. Do not run fixture bootstraps against the hosted application database.

```sh
node --test scripts/coaching/model.test.mjs scripts/coaching/timezone.test.mjs scripts/coaching/commerce-model.test.mjs scripts/coaching/commerce-provider.test.cjs
node node_modules/next/dist/bin/next build --webpack
```

Reference: [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers). Transfers and customer charges are deliberately independent; refunds do not automatically reverse a coach transfer.
