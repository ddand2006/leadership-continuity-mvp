# Leader Continuity coaching — Sprint 1

## Implemented

- Organization coaching workspace at `/coaching`, separate from the existing personal-development guidance at `/personal-development/coaching`.
- Approved-coach marketplace, normalized specialties/industries/leadership levels, keyword search, filtering, and profile pages.
- Marketplace browsing without Coaching activation; availability and coach requests gated by an active, unexpired entitlement.
- Organization access requests and platform-admin approval; approval activates the reusable `organization_features` entitlement.
- Coach administration and own-profile editing. Coach edits return the profile to review; coaches cannot approve themselves or verify their own credentials.
- Coach requests converted to engagements, consent-gated activation, session logging/confirmation, goals, actions, reflections, and organization-shared progress.
- Separate versioned record-retention, credential-verification, development-data, and organization-reporting consents. Record retention is the required activation consent. Revoking it pauses the engagement.
- Client-selected access to existing role competencies and development records. These are references/projections, not duplicate development profiles. Other source-data adapters can be added to the permission mapping later.
- Coaching log generated from completed sessions, seven filters, recalculated metrics, and CSV download with a privacy notice and formula-injection protection.
- Responsive organization, coach, and coachee pages using the existing site styling.

## Identity and confidentiality

Coach profile `user_id` and engagement `coachee_user_id` refer to **auth user IDs**, not `profiles.id`. Platform administrators can link an existing outside-coach account when creating/editing its profile. No organization membership is granted to an outside coach.

Existing `system_admin` and `hospital_admin` roles remain authoritative. Coaching pages and actions deliberately use the session-bound Supabase client rather than the platform-support service-role client. Platform support's selected-organization context does not override the coaching identity.

All new tables have RLS and authenticated clients have SELECT privileges only. `coaching_mutate` performs narrowly validated writes with the authenticated actor, derives organization/coach/client associations, and records metadata-only events in the existing `platform_audit_events` table. Private narrative text is never copied into that audit log.

Approved marketplace profiles use an explicit database projection that omits email, phone, credential number, and internal capacity information. Availability is null without an entitlement. Raw profiles are restricted to their owner and platform administrators.

Private notes are restricted to the assigned coach. Coach-client content is restricted to the participants. Organization-shared narrative also requires organization-reporting consent. Administrators receive aggregate session hours; they cannot query raw session content. Credential contact details appear in the log only when credential-verification consent is current.

Engagement title/objectives/progress are explicitly organization-shared administrative information. Private narrative belongs in visibility-controlled notes/goals/actions. Revocation removes access to original development records; it cannot erase information a coach already saw or copied into a permitted coaching note.

## Database rollout

The code requires `supabase/migrations/202609150001_coaching_foundation.sql`. Review and apply it through the project's normal migration process before deploying the routes. This implementation has **not** applied a migration to the hosted database or deployed the website.

Existing subscription billing covers the two product subscriptions and does not have a reusable add-on table. The migration adds `organization_features` for Coaching; it does not change product subscription billing or activate Coaching for existing organizations.

`supabase/coaching-demo-seed.sql` contains five explicitly fictional profiles (ACC/PCC/MCC, unavailable, and pending review). Run this only in development/demo environments. Production receives reference taxonomies but no fictional approved coaches.

Outside-coach account invitation/provisioning uses the existing account process. Link the resulting auth user ID in Coach Administration. Automated invitations, calendars, payments, email sequences, matching, contracts, chat, ratings, and group-participant management remain future work.

Session timestamp fields accept ISO timestamps with an explicit UTC offset. Completed sessions require start/end/category/compensation; the database calculates minutes and rejects invalid durations. Group/team categories classify session hours; the application does not multiply duration by participant count.

## Verification

- Production Next.js build (`next build --webpack`), TypeScript, and targeted ESLint.
- `node --experimental-strip-types --test scripts/coaching/model.test.mjs` tests filtering, hour totals, unique client counts, and CSV escaping.
- `scripts/coaching/test-bootstrap.sql` provides a minimal existing-platform fixture for a **fresh disposable PostgreSQL database**. Load it, then the migration, then `scripts/coaching/rls.test.sql` with `psql -v ON_ERROR_STOP=1`. Never run the bootstrap against a real application database.
- The database suite switches authenticated identities and verifies the request-to-log workflow, organization isolation, private content access, forged writes, consent independence/revocation, and development-source linking. It tests the new migration against a minimal platform fixture, not a copy of hosted production data.
- Local browser verification with fictional Supabase responses covers locked/active marketplaces, coach profiles, the opt-in modal, and mobile overflow. Live Supabase/browser integration remains a rollout check after migration.
