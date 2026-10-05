# Role Permission Matrix

This is the working authorization model for the Leadership Continuity workflow.

## Core concepts

- The **role composite** is the organization-approved source of truth.
- A **role pipeline** is one candidate’s preparation path for one future role.
- A candidate may have multiple role pipelines and multiple role-specific mentors.
- A coach is external, optional, budget-approved, and candidate-selected.

## Role capabilities

| Capability | Administrator | Candidate | Mentor | External coach |
| --- | --- | --- | --- | --- |
| Create a role composite | Create | View approved composite | View; propose changes | View only when shared |
| Approve composite changes | Approve | View | Propose | No |
| Add candidate to pipeline | Add/select | View own pipelines | View assigned pipelines | No |
| Create project draft | Create | Suggest goals and context | Create and use AI drafting | Suggest during coaching |
| Finalize project | Approve organizational fit | Co-design and accept | Finalize and assign | No |
| Complete project work | View assigned work | Execute and add evidence | Review and coach | View only when shared |
| Score competencies | Configure scoring rules | View own scores | Assess assigned evidence | View only when shared |
| Approve readiness evidence | Formal/organizational evidence | Submit evidence | Project/evidence approval | No |
| View role readiness | Organization-wide | Own role pipelines | Assigned role pipelines | Shared role sections only |
| Manage mentor relationship | Assign/reassign | Participate | Work assigned pipeline | No |
| Request external coaching | Approve availability and budget | Request and authorize sharing | Approve role-specific sharing | Accept engagement |
| Approve external coach | Approve coach, budget, scope, dates | No | No | No |
| Manage sharing defaults | Set hard restrictions | Request shares and revoke own shares | Set defaults and approve exceptions | No |
| View private mentor notes | Organization policy permitting | Only when explicitly shared | Own notes | Never by default |
| Complete coaching forms | Configure templates | Complete/co-author candidate forms | No, unless shared | Complete static coaching forms |

## Sharing rules

1. The candidate initiates every external sharing request.
2. The mentor approves role-specific sharing using category defaults and exceptions.
3. The candidate may revoke access; revocation is immediate.
4. Administrators define hard restrictions that no user can bypass.
5. Private mentor notes, other employees' confidential information, compensation data, and internal employment decisions are never externally shareable.
6. A single coach may support one candidate across multiple roles, but the coaching workspace keeps role sections and permissions separate.
7. Sharing remains active until revoked unless an administrator later adds an expiration policy.

## Readiness rules

- Readiness is calculated separately for each role pipeline.
- Administrators choose equal-weight or composite-weighted scoring per role.
- Readiness may increase or decrease as evidence changes.
- Historical readiness values remain visible.
- Candidate readiness is expressed as a percentage and a Bronze/Silver/Gold/Platinum tier.
- Evidence must be approved by the mentor and/or administrator according to evidence type.

## Open implementation constraints

- The current code calculates role readiness as equal-weight progress toward each competency target. Weighted role readiness is a pending per-role option.
- The current award thresholds are Bronze 60%, Silver 75%, Gold 90%, and Platinum 100%, with additional mentor/development gates.
- Coaching templates begin as static forms available to approved coaches.

## Repository document permissions

The repository is organization-scoped by default. Every document keeps its
source, owner organization, creator, created date, version, status, and
visibility rationale. A user sees only documents allowed by both the document
type rule and their relationship to the organization or candidate.

| Document type | Company administrator | Candidate | Assigned mentor | Approved coach | Platform administrator |
| --- | --- | --- | --- | --- | --- |
| Approved role composite | View and manage | View approved expectations | View assigned role | View only when shared | Full access |
| Hiring scorecard / interview packet | View and manage | Never by default | Only if explicitly authorized | Never by default | Full access |
| Candidate progress, strengths, and development | View | View and contribute to own record | View assigned candidate | View only approved shared sections | Full access |
| Mentor report / worksheet | View according to organization policy | View only when approved for the candidate | View and manage assigned work | Never by default | Full access |
| Private coaching narrative or notes | Restricted | Never by default | Author-only or explicit share | Never by default | Full access with audit |
| Candidate portfolio export | Approve and revoke sharing | Generate and request sharing | View when approved | View when approved | Full access with audit |

### Repository controls

- The default repository view is filtered to the user's organization and
  permissions.
- Archived documents remain searchable to authorized users and are visibly
  marked archived.
- New versions mark the prior version superseded while preserving history.
- Permanent deletion is unavailable to normal users; only controlled platform
  administration may delete records.
- Exceptions may be granted by a company administrator or platform
  administrator, require a documented expiration date, and remain revocable by
  platform administration.
- Contextual links to restricted documents explain that access is restricted
  without revealing document contents or sensitive metadata.
- Portfolio exports exclude hiring scorecards, private coaching narratives,
  and restricted notes automatically. Candidate sharing requires company
  administrator approval, recipient notification, a liability acknowledgement,
  password-protected PDF/Word delivery, and a complete audit record.
- View-as is read-only and must show the selected role prominently. It cannot
  grant or bypass document permissions.
