# Coaching Sprint 5 — marketplace scale, quality and analytics

Implemented in **Leader Continuity**. Coaching remains last in the top navigation. Sprints 1–4 retain their underlying operational, commercial, consent and development records.

## Delivery and rollout

The migration, application screens, authorized exports and isolated tests are implemented. The preview uses fictional data. No hosted migration, live deployment, real agreement publication, payment transaction or message to an external recipient has been performed.

Apply `202609150005_marketplace_scale.sql` after Sprint 4 in a Supabase staging environment and rehearse with representative existing data. The isolated PostgreSQL fixture validates the queried schema and access rules, not every production data condition. Review the organization’s marketplace agreement, eligibility configuration, retention policies and sample thresholds before enabling them for real coaches. Existing approved coaches retain eligibility under the initial configuration; optional credential, agreement, payment and orientation requirements start disabled. Profile approval remains required.

The migration schedules `coaching_scale_internal.daily()` at 03:15 database time when `pg_cron` is already enabled. Without that extension it emits a setup notice; a platform administrator can use **Refresh metrics and alerts now**. The local preview has no scheduled job. Enable pg_cron and run the same named daily schedule during hosted setup. Jobs calculate snapshots and create in-app credential/capacity notifications, with deduplication; they do not send external messages.

Sprint 3’s Stripe credentials, webhook and real-provider verification remain outstanding. Optional AI summaries, public reviews, industry benchmarking and operational group coaching are not enabled. The participant relationship table prepares for future group work while existing individual consent boundaries remain intact.

## Screens

### Platform

- `/admin/coaching/marketplace`: marketplace cards, funnel, conversion rates, timing, financial summaries, supply/demand, growth and utilization.
- `/admin/coaching/recruitment`: the same authorized report with shortage and structured search-gap tables.
- `/admin/coaching/executive`: executive marketplace, development, quality and financial view.
- `/admin/coaching/credentials`: existing credentials plus verification dates, source and expiration monitoring.
- `/admin/coaching/quality-review`: private feedback, concern queue, separate coach-visible review messages, human resolution and conflicts.
- `/admin/coaching/coach-applications` and `/admin/coaching/compliance`: applications, agreement versions, training, verification, eligibility and human marketplace status decisions.
- `/admin/coaching/scale-settings`: versioned requirements and thresholds, daily refresh and entered acquisition/administrative costs.
- `/admin/coaching/privacy`: category-specific retention rules and reviewed privacy requests.

### Organization and leader

- `/coaching/analytics`: organization-only development, role, competency, readiness, renewal, coverage and investment summaries; filtered by dates, coach, specialty, industry, leadership level and package.
- `/coaching/programs`: program budgets, existing candidate/engagement links, hours, shared goals/evidence, readiness reviews, spending and organization program feedback.
- `/coaching/roi`: organization-entered outcomes with method, sources, assumptions, measurement dates and author. Financial values are labeled **Organization-provided estimate**.
- `/coaching/saved`: saved/preferred coaches and an organization-approved pool. Marketplace supports “Our coach network,” similar-role/need experience and recent availability filters.
- `/coaching/renewals`: fresh editable request from a completed engagement. Same-coach preference does not bypass matching, invitation, leader acceptance, commercial agreements or new consents.
- `/coaching/feedback`: one private closeout response per coachee/organization group, plus an engagement concern form. Existing closeout screens link here and to continuation requests.
- `/coaching/executive-report`: printable organization report and authorized CSV/XLSX export.

### Coach

- `/coaching/quality`: multidimensional quality metrics with sample size, period, method, visibility and version; professional development and requested review responses.
- `/coaching/onboarding`: application, profile/payment links, agreement acceptance and platform orientation completion.
- `/coaching/conflicts`: declaration tied to an assigned opportunity or engagement. Human clearance is required before accepting an affected opportunity or activating an engagement.
- `/coaching/practice-report`: quality, coaching hours, paid/pro bono breakdown, professional development and CSV/XLSX/print output. The ICF-compatible log remains separate.
- `/coaching/privacy`: an own-account request to review deletion, anonymization, retention or processing restrictions.

## Architecture and privacy

New tables cover only new workflow facts, configuration versions and derived analytics snapshots. Existing sessions, engagements, payments, revenue ledger, development needs, goals, evidence and readiness records remain the sources. `coaching_marketplace_funnel` is a restricted view over cached funnel projections. Operational data remains live; whole-marketplace calculations run on explicit refresh or daily processing, not every page load. Date/custom-filter snapshots disclose their refresh timestamp and version.

All new tables enable RLS and deny raw authenticated table access. RPCs perform role, organization, owner and engagement checks using the signed-in session. Exports use those same projections. Organization reports cannot select another organization. Platform operational dashboards are restricted to platform administrators; no identifiable cross-company benchmark is exposed to organizations.

Written feedback defaults to platform-private. Coaches receive thresholded numeric aggregates, never client comments or an unshared concern description. A platform reviewer must write a separate coach-visible message before a coach may respond. Quality resolutions do not automatically suspend anyone; marketplace status requires a separate explicit human action with a retained audit reason.

Confidential notes, reflections, interview narratives and raw 360 comments are not queried by the analytics engine. Development counts use explicitly shared evidence/goals with current reporting consent. Consent, evidence or goal changes invalidate cached reports and affected quality metrics immediately; daily or manual refresh rebuilds them. Earlier metric versions remain interpretable. No automated promotion, readiness change, psychological label or disciplinary decision is introduced.

Credential badges are evaluated against current verification and expiration on every marketplace read. Credential numbers and verification sources remain coach/platform data. A credential preference does not receive matching points for an unverified or expired credential.

## Matching version 3

Historical factors default **off**. When enabled, the prior fit model contributes 90 relative weight, consented shared-goal outcomes up to 5 and completion reliability up to 5. Outcomes require at least the configured number of distinct completed engagements with shared goals (minimum/default 5); reliability requires the configured completed-engagement sample. Metrics must use the current version and be no more than two days old. Missing factors have zero weight and the remaining weights normalize to 100. Previous matching runs remain unchanged.

Feedback averages are not used in matching. Public star ratings and a combined quality score are not created. Preferred status can affect unscored marketplace browsing among otherwise filtered coaches; it never changes a match score. The factor projection records sample sizes, thresholds, effective weights and version.

## Metric interpretation

- Quality metrics show sample size, dates and exact calculation method. Feedback averages are hidden below the configured distinct-engagement threshold (default 5; configurable minimum 3).
- Reporting uses request-submission and engagement-creation cohorts in the selected dates, with subsequent outcomes as of refresh. It is not a reconstruction of historical state at the period end.
- Marketplace views are distinct signed-in organization/day observations beginning with Sprint 5, not unique visitors. Search events retain only validated taxonomy filters, never free-text search queries. Different funnel stages use different units, so raw stages are not presented as a person-level conversion cohort.
- Coach/specialty/industry/level/package filters apply to request and engagement cohorts. View/activation totals remain organization/date operational counts, as disclosed in reports. Supply and coach growth show current/recorded marketplace conditions. Time-to-activation excludes unknown historical timestamps instead of inventing them.
- Supply categories are configurable internal indicators. Missing maximum capacity stays “Capacity incomplete.” Geography uses recorded labels and does not infer geographic equivalence. Overlapping dimensions must not be summed.
- Financial summaries use existing ledger facts. Organization investment and program spending include paid, partially refunded and refunded receipts less completed refunds. Contribution subtracts only recorded costs and is not labeled net profit.
- Role-goal score movement preserves the existing human readiness scale. No “Ready Now” or critical-role designation is invented where those fields do not exist. Continuity coverage reports existing target-role/development coverage.
- ROI estimates disclose source, author, period and assumptions. Association is not causation.
- Retention/privacy work is a reviewed workflow, not an automatic erasure engine. Completion requires a documented execution reference. The code does not claim a restriction/deletion has occurred merely because it was requested or approved, and never automatically erases financial/audit records.

## Validation

- 37 Sprint 5 database assertions covering scoped programs/ROI, private feedback, sample thresholds, matching history, consent invalidation, credential expiry, renewal creation, conflicts, onboarding and privacy review.
- Sprint 4’s 44 and Sprint 3’s 52 assertions also pass against the upgraded schema. Earlier Sprint 1–3 checks remain validated at their relevant migration stages; they include behavior intentionally superseded by later sprints.
- 21 Node model/provider tests, including missing metrics, supply denominators and filter allowlists.
- 16 browser workflow checks across platform, organization, coach and leader roles, including exports and mobile layout.
- TypeScript, targeted ESLint and production webpack build.

Use disposable databases only. Run migrations and fixture tests 1–4 first, then the Sprint 5 migration and `scripts/coaching/sprint5.test.sql`. Node: `node --test scripts/coaching/*.test.mjs scripts/coaching/commerce-provider.test.cjs`. Browser: `scripts/coaching/sprint5.browser.cjs`, with Playwright installed or `PLAYWRIGHT_MODULE` set, expects the fictional localhost adapter at 55448 and website at 55449.
