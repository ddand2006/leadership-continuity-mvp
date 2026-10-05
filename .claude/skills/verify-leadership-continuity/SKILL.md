# Verify Leadership Continuity

Use `bin/control-app.sh` against the local, seeded development app only. Never point it at production.

## Launch

From the repository root, start the local Supabase stack and app with `supabase start` and `pnpm dev`. The launch is ready when `bin/control-app.sh doctor --json` reports `ok:true` and the app displays the Leader Continuity build marker.

## Doctor

Run `bin/control-app.sh doctor` before a drive and after an unexpected result. Exit 0 means the local app answered and contained the expected marker; exit 1 means it is reachable but not the expected build; exit 2 means the check could not determine health.

## Drive

Use `bin/control-app.sh goto <route>` for a deep link. The current lever captures server HTML; use the browser for authenticated interaction and visible controls. Never conclude that a control is absent from a server-only dump when the page requires a signed-in session.

## Evidence

Capture the route before and after each meaningful action. Evidence is written under `artifacts/verification/` and may contain personal data; keep it local and uncommitted.

## Cleanup

Run `bin/control-app.sh cleanup` to remove scratch files. It does not remove evidence or reset the database.

## Isolation

Runs share the local Supabase database and seeded accounts. Do not run mutating journeys concurrently; use separate accounts or reset the fixture deliberately.
