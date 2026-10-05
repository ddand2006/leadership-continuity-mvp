# Leadership Continuity feature map

The route map is validated in CI on every feature-map change.

## Baseline

Use the local Next app at `http://localhost:3000` with local Supabase running. The verification account must be signed in before authenticated routes are driven. The imported demo-hospital fixture is the current local dataset; mutating journeys must run serially.

## Seeded roles

The live local fixture contains administrator, candidate, and mentor records imported from the demo hospital. Coaches and sharing permissions are not yet represented as a completed end-to-end journey and remain an explicit gap.

## Features

| Area | Route | Feature file |
| --- | --- | --- |
| Role design | `/roles` | `role-composite.md` |
| Candidate readiness | `/candidates` | `candidate-readiness.md` |
| Candidate detail | `/candidates/[candidateId]` | `candidate-readiness.md` |
| Mentoring | `/mentoring` | `mentoring-and-sharing.md` |

## Full-sweep order

Start with read-only role design, then candidate list/detail and readiness, then mentoring. Run project creation, role assignment, sharing, and AI actions only after capturing a baseline and confirming the fixture can be restored.

## Driving conventions

Use visible labels and links in the browser. Use `bin/control-app.sh goto <route>` to establish the route and capture server evidence. For dynamic routes, replace the bracket segment with an ID from the local page or fixture; the checker treats the declared template route as the mapped route.

## Unmapped routes

| Route | Reason |
| --- | --- |
| `/` | Public landing page; not part of the role workflow sweep. |
| `/about` | Informational page; no workflow state. |
| `/auth` | Authentication setup is a precondition, not a workflow feature. |
| `/auth/confirm` | Authentication setup is a precondition, not a workflow feature. |
| `/auth/logout` | Authentication setup is a precondition, not a workflow feature. |
| `/account-request-received` | Account provisioning is outside the workflow sweep. |
| `/administration` | Administrative controls require a separate destructive-data review. |
| `/coaching` | Coach workflow is not yet complete end to end. |
| `/projects` | Project workflow is covered through candidate and mentoring journeys first. |
| `/dashboard` | Reporting sweep is deferred until readiness permissions are locked. |
| `/dashboard/continuity-score` | Reporting sweep is deferred until readiness permissions are locked. |
| `/dashboard/critical-roles` | Reporting sweep is deferred until readiness permissions are locked. |
| `/dashboard/high-risk-roles` | Reporting sweep is deferred until readiness permissions are locked. |
| `/dashboard/ready-successors` | Reporting sweep is deferred until readiness permissions are locked. |
| `/360-review` | Review workflow needs fixture-specific survey tokens. |
| `/360-review/[reviewId]` | Review workflow needs a seeded review ID. |
| `/360-review/[reviewId]/results` | Review workflow needs a seeded review ID. |
| `/personal-development` | Candidate-owned coaching forms are still being built. |
| `/development-plans` | Covered by candidate detail after the first journey is stable. |
| `/outside-training` | External training is outside the first verification slice. |
| `/reports-forms` | Printable/report outputs are deferred. |
| `/subscribe` | Billing is not part of local workflow verification. |
| `/partner-account` | Partner workflow is outside this organization’s first slice. |
| `/platform-operations` | Platform operator workflow needs a separate privileged fixture. |
| `/affiliate-payments` | Affiliate commerce is outside this workflow. |
| `/leadership-help` | Support preview is not part of the first sweep. |
| `/role-surveys/[token]` | Requires a generated survey token. |
| `/360-review/survey/[token]` | Requires a generated survey token. |
| `/personal-development/surveys/[token]` | Requires a generated survey token. |
| `/roles/[roleId]/print` | Printable output is deferred. |
| `/candidates/[candidateId]/competencies/[competencyId]/evidence` | Evidence editing is covered after candidate readiness baseline. |
| `/candidates/[candidateId]/development` | Covered through candidate detail first. |
| `/candidates/[candidateId]/readiness-review` | Covered through candidate detail first. |
| `/candidates/[candidateId]/development-intelligence` | AI workflow requires a separate cost-controlled run. |
| `/coaching/[...path]` | Coach workflow is not yet complete end to end. |
| `/admin/coaching` | Coach administration is deferred. |
| `/admin/coaching/[section]` | Coach administration is deferred. |
| `/view-as/[role]/[[...section]]` | Preview mode is not evidence of real permissions. |
| `/partner-account/administration` | Partner workflow is outside this organization’s first slice. |
| `/partner-account/dashboard` | Partner workflow is outside this organization’s first slice. |
| `/partner-account/register` | Partner workflow is outside this organization’s first slice. |
| `/partners/[slug]` | Public partner page is not part of the first sweep. |
| `/platform-operations/support/[organizationId]` | Platform operator workflow is deferred. |
| `/platform-operations/support/[organizationId]/award` | Platform operator workflow is deferred. |
| `/platform-operations/affiliates` | Affiliate workflow is deferred. |
| `/platform-operations/affiliate-payouts` | Affiliate workflow is deferred. |
| `/platform-operations/partner-applications` | Partner workflow is outside this organization’s first slice. |
| `/affiliate-payments` | Affiliate workflow is deferred. |
| `/personal-development/coaching` | Candidate coaching forms are still being built. |
| `/personal-development/composite` | Candidate coaching forms are still being built. |
| `/personal-development/growth-plan` | Candidate coaching forms are still being built. |
| `/personal-development/role` | Candidate coaching forms are still being built. |
| `/personal-development/strengths` | Candidate coaching forms are still being built. |
| `/personal-development/survey` | Candidate coaching forms are still being built. |
