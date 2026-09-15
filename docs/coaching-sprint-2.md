# Leader Continuity coaching — Sprint 2

## Operational workflow

The new workflow is available at `/coaching/request`, `/coaching/requests`, `/coaching/request/:id/matches`, `/coaching/opportunities`, and `/coaching/engagements/setup/:id`.

1. An authorized organization administrator selects an existing leader/candidate, chooses objectives and source context, and sets optional preferences. New leaders use the existing Organization Administration invitation process.
2. Requests can be saved as drafts and reopened, or submitted for matching. The request references the existing candidate, target role, and competency IDs. Selected development-plan context contributes matching competency references through the existing development-record competency table.
3. Rules-based matching evaluates approved coaches with linked accounts, available capacity, and accepting-client status. Default weights total 100 and are editable at `/admin/coaching/matching`.
4. Results retain their run ID, score, factor weights/points, reasons, unmet preferences, and algorithm version. Refreshing matches never overwrites history. Compare up to three coaches. Administrators can add/remove recommendations; explicit capacity overrides require a platform administrator and a reason.
5. Invitations enter the coach's opportunity inbox. A safe database projection shows organization and controlled coaching-need categories, not the leader's identity, internal free text, detailed assessments, or private development records.
6. Coach interest sends the request to leader review. The leader can accept, request another coach, or request an introduction. Coach/administrator meeting coordination becomes available after a leader requests an introduction or accepts the coach. Meeting scheduling updates the original introduction record.
7. After leader acceptance, setup establishes organization objectives and the engagement structure. New Sprint 2 engagements require four independent consents before activation: record retention, credential verification, development-data access, and organization reporting. Development access still requires explicit record-level permissions. Recording is not enabled.
8. Active engagement participants can schedule sessions using available UTC instants, request rescheduling/cancellation, and log completed sessions using the existing Sprint 1 log.
9. Engagement views show planned/completed sessions and hours, permitted shared goals/actions, and remaining days. Closeout collects explicitly shared feedback from coach, leader, and organization. All three parties must finish before an organization administrator finalizes it. Extensions preserve prior plan values in the audit trail.

## Availability and time zones

`/coaching/availability` manages recurring weekly rules and unavailable/custom exceptions. PostgreSQL's IANA time-zone database generates actual instants; the UI uses `Intl.DateTimeFormat`, including zone abbreviations, so the repeated fall-back hour is distinguishable.

General coach availability is now visible without Coaching activation, as specified by Sprint 2. General time windows require active Coaching. Exact slots require an authorized request/engagement workflow or ownership of the coach profile. A coach cannot query another coach's exact availability.

Scheduling uses a coach-row lock and a PostgreSQL exclusion constraint to prevent overlapping reservations. Adjacent appointments are permitted. Completed sessions remain in the conflict check when their scheduled timestamps are present. Reschedules keep the original session ID and record original/requested times in `coaching_session_changes`.

Manual introduction/reschedule/session timestamps must include an explicit UTC offset or `Z`. Date/time arithmetic is not performed with hand-written frontend offsets.

## Privacy and compatibility

Sprint 1 session-bound clients, RLS, private-note rules, and source-data permission checks remain in force. The original mutation function is now a non-client-callable compatibility function. New coach requests cannot use the legacy conversion path to bypass coach/leader acceptance.

Existing Sprint 1 engagements keep their original consent policy, while new Sprint 2 engagements use the four-consent gate. Revoking any required Sprint 2 consent pauses an active engagement. Revoking a specific source-data permission immediately prevents subsequent source access without erasing already-created coaching content.

The current matcher uses exact competency-to-specialty names, categorical preferences, self-reported general availability, and capacity. Unspecified preferences receive their full weight, which is disclosed in the results UI. A score is preference fit, not scientific certainty or a success probability. Detailed 360/assessment scoring and semantic interpretation are not part of the initial matching rules.

## Notifications and email

A reusable recipient-owned `notifications` inbox appears at `/coaching/notifications`. Workflow events create in-app notifications with no confidential narrative. Upcoming sessions, incomplete logs, due actions, and approaching closeout are refreshed when the inbox is opened; this sprint does not install an external background scheduler.

When the existing Resend and server Supabase configuration are present, mutation handlers also deliver generic email notifications through the existing email adapter. A service-only, claimed outbox prevents exposing recipient addresses to browser clients and uses idempotency keys. Failed email attempts leave the in-app notification intact and can be retried by subsequent actions after the claim lease expires. No new email provider or external account was configured during implementation.

## Routes

- Requests and matching: `/coaching/request`, `/coaching/requests`, `/coaching/request/:requestId/matches`
- Coach inbox/availability: `/coaching/opportunities`, `/coaching/availability`
- Setup: `/coaching/engagements/setup/:requestId`
- Scheduling/closeout: engagement `Schedule` and `Closeout` tabs
- Operations: `/admin/coaching`, `/admin/coaching/matching`, `/admin/coaching/workflow-requests`, `/admin/coaching/workflow-engagements`

Coaching remains at the end of the main navigation.

## Rollout

Apply `202609150001_coaching_foundation.sql` before `202609150002_coaching_operations.sql`, then deploy the application through the normal project process. Neither hosted migration nor website deployment has been performed here.

Before applying Sprint 2 to existing data, review any overlapping scheduled sessions: the new exclusion constraint intentionally refuses installation if existing reservations conflict. Resolve those conflicts through the normal coaching workflow; the migration does not delete or silently move bookings.

```sql
select a.id as first_session, b.id as conflicting_session, a.coach_id
from public.coaching_sessions a
join public.coaching_sessions b on a.coach_id=b.coach_id and a.id<b.id
where a.status in ('scheduled','completed') and b.status in ('scheduled','completed')
  and a.scheduled_start_at is not null and a.scheduled_end_at is not null
  and b.scheduled_start_at is not null and b.scheduled_end_at is not null
  and tstzrange(a.scheduled_start_at,a.scheduled_end_at,'[)')
      && tstzrange(b.scheduled_start_at,b.scheduled_end_at,'[)');
```

## Verification

- Sprint 1 regression suite: `scripts/coaching/rls.test.sql` against the Sprint 1 schema.
- Sprint 2: `scripts/coaching/sprint2.test.sql` after the Sprint 2 migration. Local-only fixture extensions are in `scripts/coaching/sprint2-bootstrap.sql`; they are not application migrations.
- Log/CSV/time-zone tests: `node --experimental-strip-types --test scripts/coaching/model.test.mjs scripts/coaching/timezone.test.mjs`.
- Production build with webpack, TypeScript, and targeted ESLint.
- Browser walkthrough against fictional data in an isolated PostgreSQL database: request wizard, reference selection, matching, comparison, invitation, coach interest, leader acceptance, setup, and mobile request dashboard.

Local test fixtures are deliberately minimal representations of existing platform tables. A hosted staging smoke test remains necessary after migration, especially for real account invitations, existing data associations, and configured email delivery.

No payment processing, payouts, commercial packages, external calendars, conferencing APIs, generative matching, public ratings, chat, or SMS were added.
