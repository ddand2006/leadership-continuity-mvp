# Partner portals and coaching marketplace — build plan

Prepared September 9, 2026. Companion: `index.html` in this directory.

## Review the demo

Open the HTML file in a browser, or serve this directory locally. It is a self-contained prototype with fictional records. It does not use real accounts, APIs, payment methods, storage, or production authorization. Refresh resets the state. Nothing has been deployed or changed in the live app.

Suggested walkthrough:

1. Partner company referral: view Summit’s branded entry page, browse its two coaches, review service terms, and simulate a hire. End the engagement and choose its other coach. Review the partner workspace.
2. Independent coach referral: Alex is initially assigned. End Alex’s engagement, select a different marketplace coach, and inspect Billing & referrals. Alex remains the software referral source.
3. Open Coach workspace: Alex no longer sees Jordan’s development information, but still sees the illustrative subscription commission.
4. Direct customer: browse all four coaches and simulate either a monthly package or an individual session. There is no software referral commission.

All prices, split percentages, identities, cancellation terms, and timelines are illustrative. Demo session cancellation is simplified; production must distinguish immediate access termination from contractual billing and refund timing. Sample partner/coach views represent explicitly labeled fictional accounts, rather than real role switching.

## Confirmed product rules

- Companies can have branded entry pages with embedded referral attribution and a roster of coaches.
- A company-referred organization uses that company’s coach roster. A leader can replace a coach within the roster.
- Independent-coach referrals can choose other eligible marketplace coaches, even after firing the referrer.
- The original referral source continues to earn the agreed software subscription percentage while the client continually renews. Coach changes do not reset it.
- Coaching compensation belongs to the provider delivering the engagement, separately from software referral commissions.
- Coaching is billed through this app, initially monthly or per session.
- Partner users see only authorized associated clients; coaches see only specifically authorized assignments and shared records.
- Development goals and client-owned shared summaries survive coach changes.
- A future reverse-referral workflow can track consulting engagements introduced to partners, including services invoiced outside this app.

## Existing application fit

The app already has Next.js, Supabase authentication/data, Stripe subscription checkout, organization-scoped access, coaching requests, mentor assignments, development records, and assessment workflows. Current checkout associates subscriptions with an organization but has no affiliate attribution or Connect split. Coaching requests store an assigned coach name, which is insufficient as a portal authorization relationship.

Reuse the existing authentication, development content, billing wrapper, and API error patterns. Add explicit partner and coach access models rather than granting outside providers existing broad administrator or mentor roles. Review every service-role/admin-client query because database row policies do not protect operations using a privileged client.

## Proposed data model

| Record | Purpose |
|---|---|
| partners | Company identity, branding, approval status, payout account reference |
| partner_memberships | User’s company role and status; separate from client organization membership |
| coach_profiles | Approved public biography, specialties, availability status, independent/company ownership |
| partner_coaches | Active roster membership and effective dates |
| referral_links | Opaque referral code, source identity, campaign, enabled state |
| organization_referrals | Original source, attribution evidence, commission agreement version, effective dates, continuity status |
| organization_partner_affiliations | Roster restriction, authorizing party, effective dates, explicit exit history |
| coaching_offers | Provider, monthly/session price, currency, included services, versioned terms |
| coaching_engagements | Organization, leader, provider, payer, offer version, state, start/end dates |
| engagement_shares | Explicitly authorized records and purpose, grant/revocation dates |
| sessions | Scheduled/completed/canceled/no-show state, credits, payment references |
| coaching_notes | Separately classified private notes and client-shared summaries; distinct authorization paths |
| terms_acceptances | Actor, immutable terms version, timestamp, engagement and payer approval |
| commission_agreements | Software/coaching basis, recipient, percentage, effective period and adjustments |
| financial_ledger | Charge, earning, transfer, refund, reversal, currency and reconciliation references |
| webhook_events | Unique provider event ID, processing state and retry history |
| audit_events | Access grants, role changes, attribution overrides, agreement changes and engagement termination |

Use integer minor currency units, explicit currencies and stored calculation bases. Lock agreement versions to earned transactions. Model referral-source identity independently from its current coach employment. Do not overwrite historical earnings when contracts or roster membership change.

## Authorization design

A referral is a financial relationship, not permission to read development data. Partner affiliation controls coach eligibility, not automatic access to every leader record. An engagement plus explicit sharing controls coaching access.

- Partner administrator: their roster, permitted organization summaries, engagement administration and relevant financial reporting; no private notes or raw assessments by default.
- Coach: assigned leader and approved content during the authorized engagement; their own necessary financial reporting afterward.
- Client administrator: company-funded purchase approval, organization engagements and agreed sponsor reports.
- Leader: personal plan, eligible offers, accepted terms and shared summaries; purchases subject to payer authority.
- Platform operator: purpose-limited, audited support and administration.

Enforce this in API handlers, database row policies, document storage/download authorization, search, exports and background jobs. Never rely on hidden navigation. Re-check roster eligibility, membership and payer approval at purchase time. Revoke access when an engagement or membership ends. Define ownership and retention of private notes separately; do not silently hand them to replacement coaches. Previously downloaded material cannot be remotely revoked.

## Phased delivery

### Phase 0 — settle business rules and technical design (3–5 working days)

Confirm the decisions below, inspect current auth/profile assumptions, map personal-development and candidate identities to coaching subjects, and choose the Stripe charge/transfer approach using current official documentation and account eligibility. Write permission and accounting examples before migrations.

Exit: approved policy matrix, example invoices/commission calculations, data ownership rules and technical design.

### Phase 1 — partner and referral foundation (1–2 weeks)

Add versioned migrations, partner memberships, branded signup routes, approved referral codes and organization attribution. Persist attribution through authentication and checkout; prevent arbitrary referral reassignment. Create partner-scoped reporting and roster administration. Keep existing customer billing behavior intact behind feature flags.

Exit: a new sample organization signs up through a partner page, retains attribution through checkout, and cannot appear in another partner’s queries.

### Phase 2 — profiles and engagements (1–2 weeks)

Create approved coach pages, versioned offers and terms, roster-filtered directory, purchase approval, engagement lifecycle and explicit record sharing. Reuse selected existing development views. Add separate session summaries and private notes. Support end/change flows and client record continuity.

Exit: company clients cannot hire outside their roster even with a direct API request; independent referrals can switch across the directory without losing original referral credit; former coaches lose development access.

### Phase 3 — payment integration (2–3 weeks)

Onboard approved payout recipients. Implement monthly and per-session checkout in Stripe test mode, separate from annual software billing. Company roster revenue defaults to the company; independent revenue goes to the independent provider. Store recipient and agreement version at purchase.

Implement paid-invoice/session accounting, duplicate-safe webhooks, failed-payment handling, subscription cancellation, refunds, partial refunds, disputes, transfer failures/reversals and reconciliation. Decide whether provider release follows session completion or a monthly service schedule. Display earned, pending, available and paid amounts distinctly. Do not promise immediate bank payouts.

Exit: test-mode transactions reconcile to the cent across initial charges, renewals, cancellations, retries and refunds; failed or duplicate events cannot generate duplicate commission payments.

### Phase 4 — controlled pilot and launch (1–2 weeks)

Invite one partner, two company coaches, two independents and a small group of consenting clients. Validate actual workflows with the users. Complete accessibility and responsive checks, data-isolation tests, billing review and an operational walkthrough for failed payouts and client disputes.

Exit: signed-off pilot checklist, support owner, alerts, tested backup/rollback process, and explicit production release approval.

Planning range: approximately 6–10 engineering weeks for a controlled production pilot, assuming prompt business decisions and no major changes to existing identity architecture. This is a planning estimate, not a fixed quote. Scheduling integrations, a public self-service marketplace and complex consulting billing are outside that first pilot.

## Decisions needed before production billing

1. Subscription commission percentage and basis: discounts, upgrades, added seats, taxes, fees, refunds and chargebacks.
2. Continuity rule: grace period, canceled subscriptions returning later, attribution conflicts and permitted manual overrides. A 60-day grace period discussed earlier remains a proposal, not an accepted rule.
3. Coach payer: leader, employer, or either; organization approval and spending authority.
4. Monthly package behavior: included sessions, carryover, start dates, prorations, cancellation timing and unused services.
5. Per-session behavior: scheduling, rescheduling, no-shows, refunds, completion confirmation and disputes.
6. Coaching split, payout recipient, payout release timing, processing/Connect costs and refund liability.
7. Partner ecosystem exit: unsuitable roster, partner termination, coach departure and transfer of an organization to direct access. Keep these separate from financial attribution.
8. Private-note ownership, retention, lawful support access and precisely what sponsors may see.
9. Whether attribution belongs to the paying organization in all cases or also supports individually paying accounts.
10. Initial country/currency support and approved provider onboarding requirements.

## Verification and release safeguards

Automate the meaningful production cases: partner A cannot read partner B; forged IDs cannot bypass roster restrictions; terminated coaches cannot retrieve records or files; referral income survives coach replacement; rejected payment never creates an active paid engagement; payer approval cannot be spoofed; duplicate/out-of-order webhooks are safe; refunds adjust earned commission and transfers correctly; cancellations preserve client-owned records; annual renewals retain valid source attribution.

Use distinct test organizations and providers, real authorization contexts, Stripe test mode and database policy tests. Demo UI checks are not a security test.

Deploy additive migrations first, then feature-flagged application changes. Pilot access should be invite-only. Reconcile daily during launch. Rollback disables new purchases and portal access while preserving ledger and engagement history; do not roll back financial records by deleting them.

## Later releases

Public provider applications and review, availability/calendar integrations, session bundles, richer progress reporting, automated partner statements, and reverse consulting referral tracking. When partners bill consulting externally, mark collections as partner-reported until reconciled; do not infer payment from a signed engagement alone.


## Company administration extension — September 9 review

The updated demo opens with Company setup. The platform owner can create multiple company workspaces from a shared template. Each company can edit its name, unique page slug, logo/initials, color, headline and introduction. New companies start with empty portfolios and benches; the sample Summit company has fictional activity data. All state remains in memory.

### Additional workflows

- Client invitation: administrator enters name, email and organization, reviews the branded invitation, and creates a simulated pending invitation. Acceptance moves the client to Active and records a sample sign-in. Revocation prevents acceptance.
- Coach invitation: separate purpose and invitation type; acceptance prepares a profile for review. Administrator approval publishes the coach on the company landing-page preview. Capacity can be maintained per coach.
- Portfolio: one row per person, including organization, invited/active status, coach and last successful sign-in. Search by person, organization or email; filter by invitation status or no sign-in in 14+ days. The demo uses a fixed September 9, 2026 clock.
- Company separation: the owner selects companies; each workspace reads only its own prototype arrays. This demonstrates intended scoping, not production security.

### Production implementation additions

Add company branding configuration and validated unique slugs to partners. Store logos in an authorized asset bucket with MIME/size validation. Use a shared landing-page component rather than copying a separate site per partner. Public pages include approved coaches only; no portfolio or activity data is public.

Add invitations with company ID, purpose (client or coach), normalized target email, invited-by identity, hashed expiring one-time token, status, acceptance time and revocation time. Reissue invalidates prior tokens. Enforce company membership, rate limits and duplicate detection server-side. Invitation acceptance must authenticate and verify the recipient, then atomically consume the token. An existing organization must not be reassigned or disclose data simply because someone accepts an invitation; require authorized organization approval and resolve attribution conflicts explicitly. Coach membership invitations must not grant client membership or financial permissions.

Send invitation email only after an authorized user deliberately submits it. Track delivery failures separately from acceptance. Production needs resend, expiration and cancellation handling. The demo never sends messages.

Maintain authoritative last successful sign-in events or a dedicated activity projection from verified authentication, not from arbitrary client requests. Define whether a session refresh counts; recommended initial label is Last sign-in, not Last activity. Store UTC, display an explicit timezone, and distinguish unknown activity from never signed in. Sign-in recency is not evidence of development progress. Permit only associated-client recency visibility and do not expose authentication logs, IP addresses, browsing history, or private coaching content. Establish the client-visible disclosure for this reporting.

The demo portfolio is person-level. In production, group those rows under the paying organization so multiple leaders do not become duplicate subscription referrals. Reconcile invited-client identities with existing users without granting access based on an email match alone.

### Additional acceptance criteria

Create two companies from the template and verify independent branding, portfolios and rosters. Verify one cannot query the other's client activity or invitations, including forged IDs. Test expired/revoked/replayed invitations, mismatched email acceptance, duplicate invitations, existing-organization conflicts, coach approval requirements, and accurate timezone handling. Ensure no invitation contains private client data or secrets beyond the recipient-scoped token.

### Prototype limits

The company builder is a separate demonstration of company management; it does not rewrite the original fictional coach marketplace scenarios or simulate full scheduling, live invitations, authentication, persistent storage, or billing. New company coaches appear on their company landing preview. Production must connect the shared provider model to directory eligibility and checkout. Newly accepted coaches use the invitation's sample specialty rather than a complete profile editor.
