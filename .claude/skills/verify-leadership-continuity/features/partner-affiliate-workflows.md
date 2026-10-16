# Partner referrals, coaches, and affiliate payments

## Sub-features

- Partner application approval and explicit workspace membership.
- Partner team access, coach roster invitations, and coach affiliation acceptance.
- Referral links with manually negotiated commission terms frozen at enrollment.
- Verified subscription commission, refund and dispute adjustments, and administrator-approved payouts.

## How to get to it (user POV)

A partner owner opens **Partner Account** to review referrals, coaches, payments, and team access. A coach accepts or declines the affiliation from **Marketplace Readiness**. A platform operator uses **Partner Applications**, **Affiliates**, and **Affiliate Payouts** to approve the partner, configure terms, inspect ledger entries, and approve eligible payouts.

## Driving it with `control-app`

```bash
bin/control-app.sh goto /partner-account
bin/control-app.sh goto /partner-account/dashboard
bin/control-app.sh goto /partner-account/administration
bin/control-app.sh goto /affiliate-payments
bin/control-app.sh goto /platform-operations/partner-applications
bin/control-app.sh goto /platform-operations/affiliates
bin/control-app.sh goto /platform-operations/affiliate-payouts
```

Capture the read-only partner and platform baselines first. Run approvals, invitations, test subscriptions, adjustments, and payouts only with isolated fixture records, then verify the result from the receiving account described in `multi-surface-journeys.md`.

## Gotchas

- Partner membership grants workspace access only; it never grants leader records, coaching notes, or organization administration (`src/lib/affiliate-access.ts:7`).
- Commission terms are entered manually and frozen on the referred customer at enrollment; editing the affiliate later must not rewrite existing customer terms (`supabase/migrations/202610010003_affiliate_commission_terms.sql:10`).
- Only accepted affiliations for approved partners and marketplace-eligible coaches may appear to companies (`supabase/migrations/202610130001_partner_accounts_and_coach_rosters.sql:151`).
- Payout retries must preserve the reservation and Stripe idempotency key unless a definitive rejected request requires a new administrator approval (`supabase/migrations/202610150001_affiliate_payout_rejected_requests.sql:7`).
- Use test-mode Stripe and restorable non-production data for commission, refund, dispute, and payout checks (`src/lib/affiliate-payment-mode.ts:3`).
