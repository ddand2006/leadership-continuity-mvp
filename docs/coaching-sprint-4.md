# Coaching Sprint 4 — development intelligence

Implemented in **Leader Continuity**. Coaching remains the last top navigation item.

## Status and rollout

Application code, database migration and isolated tests are implemented. The preview uses fictional records and a local authenticated database adapter. No hosted migration or deployment has been performed. Apply `202609150004_development_intelligence.sql` after Sprints 1–3 in a Supabase staging project, then smoke-test real existing records and normal authentication before production rollout. Isolated fixtures cover the queried schema and access rules; they do not replace a full production-data migration rehearsal.

Recommendations use deterministic, versioned rules. Optional AI assistance is not enabled and no development or coaching content is sent to an AI provider. Sprint 3's outstanding Stripe test-credential, webhook and real-provider transaction verification requirements remain unchanged.

## Where to see it

- Candidate → **Development priorities**: sourced needs, explanations, human recommendation review and editable coaching requests.
- `/candidates/:id/development`: interactive development ecosystem, linked existing activities, evidence and progress reviews.
- `/candidates/:id/competencies/:competencyId/evidence`: competency evidence timeline.
- `/candidates/:id/readiness-review`: evidence coverage, human role-match decision and history.
- `/coaching/clients/:engagementId/development`: selected development context, linked coaching focus/goals, separately authored milestones and outcome measures.
- `/coaching/outcomes`: organization opportunities, development heatmap and role-level summaries; coaches receive their own engagement metrics.
- `/admin/coaching/development-rules`: platform method rules, versioned matching/evidence weights and verified coach experience.
- Organization dashboard: development entry point. Existing coaching notifications include plan/review reminders generated when an authorized team member opens the candidate workspace; no unattended notification scheduler is installed.

## Data and decisions

The source adapter references canonical roles/competencies, completed interview panel numeric aggregates, mentor-reviewed development scores, released thresholded non-self 360 aggregates, existing projects, training, mentor assignments, strengths themes and human role-match records. Role composite context is synthesized from canonical competencies/targets; document contents and storage paths are not exposed. Strengths and strengths-to-role AI fit are not treated as observed competency performance. Missing scores remain **Not assessed**.

Analysis uses the latest eligible dated observation. It creates source-linked development needs with immutable original recommendation snapshots. Reanalysis deduplicates the same source/competency and retains previous recommendations. Human review can accept, modify the focus, dismiss or complete a recommendation; reviewed focus carries into the editable Sprint 2 request. New method/configuration versions apply to future recommendations. Platform method weights are internal guidance, not scientifically validated psychometric scores.

Method plans reference existing project assignments, training selections, mentoring and development records instead of duplicating those systems. Coaching is suggested only when the configured rule supports it. A coaching entitlement is required to create the request, not to identify development needs. Requests retain Sprint 2 matching and Sprint 3 commerce/activation controls. Matching v2 adds platform-verified development-need and exact target-role experience, preserves prior runs and does not use outcome history to rank coaches.

## Privacy and evidence

All new tables have RLS and deny direct authenticated reads/writes. Authorized RPC projections use the signed-in session, not a service-role support context. Company, candidate, mentor and assigned-coach relationships are checked on the server. Coaches receive client-selected records only while development-data consent remains active. Unselected records cannot be enumerated by the coach. Released 360 aggregates require the cycle's respondent threshold; raw respondent identities/comments are excluded.

Coaching notes, reflections, interview narratives and mentor private notes are never evidence-engine inputs. Completing sessions or goals does not create organizational evidence. A milestone is an intentional, separate factual record. Coaching evidence, progress reviews and outcomes begin visible only to coach/client. The client must explicitly publish them and maintain organization-reporting consent for organization/readiness access. Revocation removes access from those views. Independent evidence starts private and its author controls sharing. Verification requires a different authorized person. Evidence keeps provenance, verification, visibility, scoring version and weight.

Readiness uses existing `candidate_role_matches` status and optional 0–100 role-goal score, plus a new append-only-through-the-API history of human changes and evidence references. It does not introduce a probability/readiness scale, select promotions, edit hiring decisions or automatically change readiness. New shared/verified evidence can suggest a **human review**, including evidence approved after the previous review. Evidence coverage is a configurable internal indicator. The learning dataset contains authorized structured references and activity counts; it does not train a model or imply coaching caused readiness changes.

## Validation

- 194 database assertions: 150 checks at the relevant Sprint 1–3 migration stages and 44 Sprint 4 checks.
- Sprint 3's 52 commerce assertions also pass against the upgraded Sprint 4 schema (fixture inserts use explicit column lists).
- 18 Node model/provider tests, including missing-data, source precedence and method-selection behavior.
- 11 browser checks across administrator, coach, leader and platform roles, including request prefill, evidence creation, human readiness review, outcomes, privacy and mobile width.
- TypeScript, targeted ESLint and production webpack build.

SQL test order: existing `test-bootstrap.sql` and migrations/tests 1–3; then `sprint4-bootstrap.sql`, Sprint 4 migration and `sprint4.test.sql`. Use a disposable PostgreSQL database with the test auth roles; never run fixture scripts against real data. Earlier sprint assertions run at their original migration stage because later sprints intentionally changed availability and commerce behavior.

Node tests: `node --test scripts/coaching/*.test.mjs scripts/coaching/commerce-provider.test.cjs`.

Browser checks: `scripts/coaching/sprint4.browser.cjs`, with Playwright installed or `PLAYWRIGHT_MODULE` set to its module path. It expects the fictional adapter on localhost 55446 and preview on 55447. It writes only fictional preview records.
