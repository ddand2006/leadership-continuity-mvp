# Coaching private preview

The Sprints 1–5 release is limited to the authenticated account `david@cycleofbusiness.com`. Coaching stays last in the top navigation. Other users cannot open coaching or development intelligence routes or exports, and do not see the new candidate or organization dashboard links. Existing personal development remains available.

The server checks the authenticated user before reading coaching data. Database identity checks use `auth.users.email` for `auth.uid()`, independent of editable profile metadata. Existing role, organization, consent and billing restrictions still apply. The gate migration precedes the five feature migrations so deployment does not temporarily expose the module. No fictional demo data is deployed.

## Public release later

After David approves the organization and design, explicitly update the app preview helper and add a new migration replacing `coaching_preview_allowed()` with the intended wider access rule. Keep existing authorization and consent checks. Deploy the new database rule and app together. Do not edit already applied migrations.

## Validation

Run `node --test scripts/coaching/private-preview.test.mjs`. Run `scripts/coaching/private-preview.test.sql` only on a disposable fixture database with all coaching migrations applied. Historical multi-role sprint tests exercise the eventual public rollout and predate the private gate; use an isolated transaction override of the gate when rerunning those domain tests.
