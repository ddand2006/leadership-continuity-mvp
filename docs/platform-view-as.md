# Platform “View as” previews

The global **View as** dropdown is available to the authenticated, non-deleted platform administrator `david@cycleofbusiness.com`. It appears on live application pages. The dropdown opens a separate sample workspace for Candidate, Mentor, Coach, Person Being Coached, or Company Administrator; choosing Platform Administrator or Return to Administrator restores the original live page.

## Scope

This release provides illustrative sample dashboards and role-specific workflows. These are dedicated preview components, not the live application rendered under another user's identity. It does not impersonate a person or certify the live role's database permissions. Current sample areas cover candidate development, mentoring preparation, projects, personal development, coaching goals/sessions/consent/feedback, coach practice tools, and company roles/people/programs/reporting/billing. Each perspective has its own menu and authorized sample routes.

Two fictional companies and two sample leaders per company can be selected. All business records are defined in the preview code; no production companies, candidates, coaching notes, billing records, or private feedback are loaded. Forms update browser state only and reset when the page or selected person changes. There are no send, payment, invitation, or business-data mutation endpoints in this feature. The banner and page text identify the sample experience throughout.

## Access and navigation

- Every `/view-as/[role]/[[...section]]` page checks the authenticated user and current profile role on the server. URL parameters and dropdown state do not grant permissions.
- Unknown roles, disallowed sections, deleted administrators, and other users are rejected.
- Sample company/person input is normalized against fixed fictional identifiers.
- All preview navigation stays in the `/view-as` namespace. Return paths accept only local application paths and exclude auth, API, and nested-preview destinations.
- The existing audited company support mode is unchanged and remains a separate live-data feature.
- The David-only coaching restriction and all live authorization remain unchanged.

## Validation

`node --test scripts/platform-preview/access.test.cjs` checks authorization, invalid inputs, sample selection, return paths, menu boundaries, and server-guard behavior.

`scripts/platform-preview/browser.cjs` uses the isolated local fixture login service. Set `PLAYWRIGHT_MODULE`, `PREVIEW_BASE`, and `PREVIEW_LOGIN` as needed. It checks every listed role page, switching, sample isolation, local-only edits, mobile layout, returning to administrator, and denial to another account. Production webpack build, TypeScript, and targeted ESLint are also checked.

A future live-person view would require a separately designed, audited, read-only impersonation boundary; it is deliberately not implemented through admin-role overrides or service-role queries in these previews.
