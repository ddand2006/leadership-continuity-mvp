# Leadership Continuity feature map

The route map is validated in CI on every feature-map change.

## Baseline

Use the local Next app at `http://localhost:3000` with local Supabase running. The verification account must be signed in before authenticated routes are driven. The imported demo-hospital fixture is the current local dataset; mutating journeys must run serially.

## Seeded roles

The live local fixture contains administrator, candidate, and mentor records imported from the demo hospital. Partner checks require separate fictional coach, partner-owner, platform-operator, and referred-organization accounts created for an isolated run; do not assume the baseline fixture includes them.

## Features

| Area | Route | Feature file |
| --- | --- | --- |
| Role design | `/roles` | `role-composite.md` |
| Candidate readiness | `/candidates` | `candidate-readiness.md` |
| Candidate detail | `/candidates/[candidateId]` | `candidate-readiness.md` |
| Mentoring | `/mentoring` | `mentoring-and-sharing.md` |
| Partner workspace | `/partner-account` | `partner-affiliate-workflows.md` |
| Partner administration | `/partner-account/administration` | `partner-affiliate-workflows.md` |
| Partner dashboard | `/partner-account/dashboard` | `partner-affiliate-workflows.md` |
| Affiliate payments | `/affiliate-payments` | `partner-affiliate-workflows.md` |
| Affiliate administration | `/platform-operations/affiliates` | `partner-affiliate-workflows.md` |
| Partner applications | `/platform-operations/partner-applications` | `partner-affiliate-workflows.md` |
| Payout approvals | `/platform-operations/affiliate-payouts` | `partner-affiliate-workflows.md` |

## Full-sweep order

Start with read-only role design, then candidate list/detail and readiness, mentoring, the partner workspace, and affiliate payment history. Run project creation, role assignment, sharing, partner approval, coach affiliation, payout approval, and AI actions only after capturing a baseline and confirming the fixture can be restored.

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
| `/platform-operations` | Platform operator workflow needs a separate privileged fixture. |
| `/leadership-help` | Support preview is not part of the first sweep. |
| `/role-surveys/[token]` | Requires a generated survey token. |
| `/360-review/survey/[token]` | Requires a generated survey token. |
| `/personal-development/surveys/[token]` | Requires a generated survey token. |
| `/roles/[roleId]/print` | Printable output is deferred. |
| `/candidates/[candidateId]/competencies/[competencyId]/evidence` | Evidence editing is covered after candidate readiness baseline. |
| `/candidates/[candidateId]/development` | Covered through candidate detail first. |
| `/candidates/[candidateId]/readiness-review` | Covered through candidate detail first. |
| `/candidates/[candidateId]/progress` | Progress editing is covered after the candidate readiness baseline. |
| `/candidates/[candidateId]/development-intelligence` | AI workflow requires a separate cost-controlled run. |
| `/coaching/[...path]` | Coach workflow is not yet complete end to end. |
| `/admin/coaching` | Coach administration is deferred. |
| `/admin/coaching/[section]` | Coach administration is deferred. |
| `/view-as/[role]/[[...section]]` | Preview mode is not evidence of real permissions. |
| `/partner-account/register` | Partner workflow is outside this organization’s first slice. |
| `/partners/[slug]` | Public partner page is not part of the first sweep. |
| `/platform-operations/support/[organizationId]` | Platform operator workflow is deferred. |
| `/platform-operations/support/[organizationId]/award` | Platform operator workflow is deferred. |
| `/personal-development/coaching` | Candidate coaching forms are still being built. |
| `/personal-development/composite` | Candidate coaching forms are still being built. |
| `/personal-development/growth-plan` | Candidate coaching forms are still being built. |
| `/personal-development/role` | Candidate coaching forms are still being built. |
| `/personal-development/strengths` | Candidate coaching forms are still being built. |
| `/personal-development/survey` | Candidate coaching forms are still being built. |
