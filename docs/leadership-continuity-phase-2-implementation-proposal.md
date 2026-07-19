# Leadership Continuity Phase 2 Implementation Proposal

This document extends the implementation assessment in:

- `docs/leadership-continuity-implementation-assessment.md`

It is intentionally still an assessment and proposal artifact. It does not introduce production schema changes or dashboard rewrites.

## 1. Existing Feature-to-Requirement Mapping

### Executive Question Mapping

| Executive Question | Existing Component | Keep | Revise | Remove | Reason |
| --- | --- | ---: | ---: | ---: | --- |
| Are we prepared? | Leadership Continuity Score and Critical Roles Covered cards in `src/app/dashboard/page.tsx` | Yes | Yes | No | The current score exists and is useful, but it is not yet critical-role aware and does not expose data completeness or score-change explanations. |
| Where are we exposed? | Leadership Risk by Role table | Yes | Yes | No | This is already a strong executive surface, but risk is currently inferred from limited signals and all roles are treated equally. |
| Who is becoming ready? | Ready Successors card and Candidate Movement section | Yes | Yes | No | The components exist, but readiness depends heavily on development-record quality and lacks historical snapshots. |
| Is development occurring? | Competency Growth Trends and Development Experience Impact | Yes | Yes | No | Strong existing sections, but they depend on scored development records and loose textual experience attribution. |
| Are mentors engaged? | Mentor Effectiveness section | Yes | Yes | No | Existing section is useful, but “engagement” is too dependent on mentor review dates and not enough on recent mentor activity evidence. |
| What must we do next? | Recommendations and Succession Risks | Yes | Yes | No | Keep this as the action layer, but separate factual alerts from calculated alerts and AI-generated suggestions more clearly. |
| Are we improving? | Existing time filters, candidate movement, competency growth, average-time-to-readiness calculations | Yes | Yes | No | There is some trend logic, but no persisted history or snapshot comparison, so the current trend story is incomplete. |

### Broader Feature Mapping

| Requirement Area | Existing Support | Assessment |
| --- | --- | --- |
| Role coverage | `roles`, `candidate_role_considerations`, `mentor_role_assignments`, dashboard coverage logic | Reusable, but missing critical-role metadata and coverage targets |
| Candidate readiness | Candidate role-fit analysis plus development-record readiness | Reusable, but split across two different readiness models |
| Mentor engagement | Assignments, review dates, worksheets, mentor reports | Reusable, but engagement logic needs stronger structured evidence |
| Development activity | Development plans, project assignments, development records, worksheets | Reusable, but relationships between planned work and tracked work need tightening |
| Continuity risk | Current dashboard `riskByRole` logic | Reusable as baseline, but needs criticality, coverage target, ownership, and due-date context |
| Historical reporting | Live calculations only | Missing |

## 2. Existing Score Calculation Documentation

### What the Existing Leadership Continuity Score Currently Measures

The current Leadership Continuity Score in `src/app/dashboard/page.tsx` is an equal-weight average of five calculated category scores:

- role coverage
- candidate readiness
- development progress
- mentor engagement
- review completion

It is currently a live operational score for the filtered dashboard view, not a historical or versioned index.

### Exact Current Formula

The current score is calculated in `buildDashboardIntelligence`.

#### Step 1: Build visible role-track set

- Candidate-role “tracks” are derived from:
  - `candidates`
  - `candidate_role_considerations`
  - `mentor_role_assignments`
  - `development_records`
- Each visible track is `candidateId + roleId`.

#### Step 2: Calculate component scores

1. `roleCoverageScore`

- Formula:
  - unique active role IDs appearing in active candidate tracks
  - divided by visible roles in the filtered scope
  - multiplied by 100
- Notes:
  - “active” excludes candidates with `status = 'on_hold'`
  - every visible role is weighted equally
  - there is no critical-role weighting

2. `candidateReadinessScore`

- Formula:
  - average latest readiness score across visible tracks
  - divided by 5
  - multiplied by 100
- Latest readiness score comes from `getRecordNumericReadiness`, which uses:
  - `development_records.average_feedback_score` if present
  - otherwise `development_records.readiness_signal` mapped as:
    - `developing = 2`
    - `progressing = 3`
    - `near_role_ready = 4`
    - `role_ready = 5`

3. `developmentProgressScore`

- Formula:
  - average of `(current_score - baseline_score)` across visible `development_record_competencies`
  - divided by 2
  - multiplied by 100
  - capped at 100
- Notes:
  - only competencies with `current_score` are counted
  - there is no minimum sample threshold

4. `mentorEngagementScore`

- Formula:
  - active tracks with `mentor_review_date` in the last 60 days
  - divided by total active tracks
  - multiplied by 100
- Notes:
  - this treats recent mentor review as the main engagement proxy

5. `reviewCompletionScore`

- Formula:
  - visible development records in time range with at least one `development_record_feedback` row
  - divided by all visible development records in range
  - multiplied by 100

#### Step 3: Final score

- Formula:
  - average of the five category scores above
  - then rounded/clamped into a 0-100 integer-like percent

#### Step 4: Current label thresholds

- `>= 85` = `Strong`
- `>= 70` = `Stable`
- `>= 50` = `Moderate Risk`
- `< 50` = `High Risk`

### Which Data Sources Contribute to the Score

- `roles`
- `candidates`
- `candidate_role_considerations`
- `mentor_role_assignments`
- `development_records`
- `development_record_competencies`
- `development_record_feedback`

### Which Score Components Are Inferred Rather Than Directly Tracked

- Role coverage
  - inferred from presence of active candidate-role tracks
- Candidate readiness
  - inferred from latest development record
  - partly manual because `readiness_signal` is manually entered
- Development progress
  - inferred from scored deltas between baseline and current competency values
- Mentor engagement
  - inferred mostly from mentor review recency
- Review completion
  - inferred from the existence of any feedback rows

### Existing vs Proposed LCI Logic

| Area | Existing Score Logic | Proposed LCI Logic | Required Change |
| --- | --- | --- | --- |
| Role coverage | Visible roles with at least one active candidate track | Critical-role-aware coverage with target bench depth and emergency coverage considerations | Revise |
| Candidate readiness | Latest development record score or manual readiness signal | Unified role-specific readiness model with explicit data completeness and review freshness | Revise |
| Development activity | Competency score improvement from development records | Structured track-level development activity with due dates, milestones, and evidence | Revise |
| Mentor engagement | Recent mentor review date within 60 days | Activity-based mentor engagement using assignment status, due dates, recent interactions, and reporting freshness | Revise |
| Continuity risk | High/moderate/low from candidate count, readiness, recent activity, mentor review | Role criticality + coverage target + readiness + transition risk + activity freshness + emergency coverage | Revise |
| Outcome validation | Implicit through movement and reviewer scores | Explicit outcome validation once enough historical snapshots and promotion/transition outcomes exist | Add later |

### Comparison to Proposed Working LCI Category Framework

| Proposed LCI Category | Current Dashboard Coverage | Assessment |
| --- | --- | --- |
| Critical Role Coverage 25% | Partially covered by role coverage and critical roles covered cards | Needs explicit critical-role fields and coverage targets |
| Candidate Readiness 25% | Covered by candidate readiness score, ready successors, movement, readiness filtering | Needs unification and stronger role-specific persisted evidence |
| Development Activity 20% | Covered by development progress, experience impact, competency growth | Needs stronger linkage between plans, assignments, and completed development records |
| Mentor Engagement 15% | Covered by mentor effectiveness and overdue review inference | Needs stronger factual activity model |
| Continuity Risk Management 10% | Covered by risk-by-role and succession risks | Needs role criticality, ownership, review cadence, and transition data |
| Outcome Validation 5% | Weakly covered by completed program and reviewer scores | Not yet reliable enough; should be deferred until history and outcome tracking mature |

## 3. Current Data-Quality Risks

### Metrics That Cannot Currently Be Reproduced Historically

- overall leadership continuity score
- category scores
- role coverage percentages for past periods
- risk-by-role history
- data completeness history
- mentor engagement trend
- successor additions and removals over time
- score-driver explanations over time

### Records That Lack Due Dates, Owners, Review Dates, Status Values, or Completion Evidence

- `roles`
  - no responsible owner
  - no last review date
  - no next review date
  - no continuity-review cadence
  - no incumbent / vacancy / transition fields
- `candidate_role_considerations`
  - no readiness-review date
  - no target readiness date
  - no explicit track owner
  - no explicit current recommendation field
- `candidate_project_assignments`
  - has dates and status, but no `role_id`, no completion date, no structured evidence field, no milestone structure
- `mentor_role_assignments`
  - has `start_date`, but no expected meeting cadence, next interaction date, report due date, last interaction date
- `development_records`
  - has status and mentor review date, but no due date, no completion date, no direct project-assignment link

### Metrics That Depend on Free-Text Interpretation

- development experience type is inferred from `development_records.experience_title`
- development activity classification depends on manually written titles and notes
- project-to-role applicability uses text role titles in `development_projects.applicable_roles`
- development-record competency tracking uses `competency_name` text rather than a competency ID
- mentor recommendations are embedded in narrative or free-text notes

### Metrics That May Produce Misleading Results When Records Are Incomplete

- readiness score
  - can look stable or good even when no recent review exists
- mentor engagement score
  - can appear low for active mentors who are using worksheets but not logging mentor review dates
- review completion score
  - treats any feedback row as meaningful completion
- role coverage score
  - can show full coverage for low-priority roles while truly critical roles remain under-covered
- development progress score
  - may overrepresent a small number of scored competencies and ignore stale tracks with no current scoring
- candidate movement
  - depends on development records existing in the selected period

## 4. Exact Fields Proposed for Addition

### Extend `roles`

- `is_critical boolean not null default false`
- `criticality_tier text null`
- `current_role_holder_name text null`
- `vacancy_status text null`
- `anticipated_transition_date date null`
- `anticipated_retirement_date date null`
- `interim_coverage_plan text null`
- `emergency_coverage_plan text null`
- `last_role_review_date date null`
- `next_role_review_date date null`
- `continuity_owner_profile_id uuid null references profiles(id)`
- `successor_coverage_target integer not null default 1`
- `calculated_continuity_risk text null`
- `calculated_continuity_risk_reason jsonb not null default '[]'::jsonb`

### Extend `candidate_role_considerations`

- `track_status text not null default 'active'`
  - values:
    - `active`
    - `on_hold`
    - `withdrawn`
    - `promoted`
    - `archived`
- `readiness_stage text null`
- `stored_readiness_score numeric(4,2) null`
- `estimated_months_to_readiness numeric(5,2) null`
- `target_readiness_date date null`
- `last_readiness_review_date date null`
- `next_readiness_review_date date null`
- `assessment_status text null`
- `interview_status text null`
- `development_plan_status text null`
- `mentor_engagement_status text null`
- `current_recommendation text null`
- `decision_owner_profile_id uuid null references profiles(id)`

Note:
- these fields should store leadership decisions and review management, not replace calculated status.

### Extend `candidate_project_assignments`

- `role_id uuid null references roles(id)`
- `assigned_by_profile_id uuid null references profiles(id)`
- `completion_date date null`
- `evidence_of_completion text null`
- `candidate_reflection text null`
- `mentor_evaluation text null`
- `leadership_evaluation text null`
- `next_required_action text null`
- `next_action_due_date date null`
- `milestones jsonb not null default '[]'::jsonb`
- `primary_competency_id uuid null references role_competencies(id)`
- `applied_strengths jsonb not null default '[]'::jsonb`

### Extend `mentor_role_assignments`

- `expected_meeting_frequency_days integer null`
- `last_interaction_date date null`
- `next_expected_interaction_date date null`
- `report_due_date date null`
- `report_completed_date date null`
- `most_recent_recommendation text null`

### Extend `development_records`

- `candidate_project_assignment_id uuid null references candidate_project_assignments(id)`
- `owner_profile_id uuid null references profiles(id)`
- `due_date date null`
- `completion_date date null`
- `evidence_of_completion text null`
- `candidate_reflection text null`
- `leadership_evaluation text null`
- `next_required_action text null`
- `next_action_due_date date null`
- `calculated_readiness_score numeric(4,2) null`
- `calculation_version text null`

### Extend `development_record_competencies`

- `role_competency_id uuid null references role_competencies(id)`

## 5. Exact Tables Proposed for Addition

### `organization_continuity_snapshots`

Purpose:
- versioned historical organization-level executive reporting

Suggested columns:
- `id uuid primary key`
- `organization_id uuid not null`
- `overall_score numeric(5,2) not null`
- `category_scores jsonb not null`
- `category_weights jsonb not null`
- `recognition_level text null`
- `data_completeness_percentage numeric(5,2) not null`
- `calculation_version text not null`
- `calculated_at timestamptz not null`
- `positive_score_drivers jsonb not null default '[]'::jsonb`
- `negative_score_drivers jsonb not null default '[]'::jsonb`
- `snapshot_scope jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### `role_continuity_snapshots`

Purpose:
- persist role-by-role coverage and risk for historical trend reporting

Suggested columns:
- `id uuid primary key`
- `organization_snapshot_id uuid not null references organization_continuity_snapshots(id)`
- `organization_id uuid not null`
- `role_id uuid not null`
- `role_title text not null`
- `is_critical boolean not null`
- `coverage_count integer not null`
- `coverage_target integer not null`
- `highest_readiness_score numeric(4,2) null`
- `successor_depth_status text null`
- `risk_level text not null`
- `risk_reasons jsonb not null default '[]'::jsonb`
- `last_activity_at timestamptz null`
- `last_readiness_review_date date null`
- `last_role_review_date date null`
- `created_at timestamptz not null default now()`

### `candidate_role_readiness_snapshots`

Purpose:
- persist candidate-role movement and readiness trend by track

Suggested columns:
- `id uuid primary key`
- `organization_snapshot_id uuid not null references organization_continuity_snapshots(id)`
- `organization_id uuid not null`
- `candidate_id uuid not null`
- `role_id uuid not null`
- `candidate_role_consideration_id uuid null references candidate_role_considerations(id)`
- `readiness_score numeric(4,2) null`
- `readiness_stage text null`
- `assessment_status text null`
- `development_plan_status text null`
- `mentor_engagement_status text null`
- `last_activity_at timestamptz null`
- `last_readiness_review_date date null`
- `created_at timestamptz not null default now()`

### Optional later table: `continuity_alerts`

Not recommended for this phase.

Reason:
- most actionable deficiencies can first be calculated from live records or snapshots
- avoid prematurely creating a parallel task-management system

## 6. Existing Tables That Will Be Extended

- `roles`
- `candidate_role_considerations`
- `candidate_project_assignments`
- `mentor_role_assignments`
- `development_records`
- `development_record_competencies`

## 7. Historical Snapshot Design

### Design Direction

Use a versioned snapshot model.

Why:
- executive reporting needs explainable point-in-time history
- score formulas will change over time
- past score values should not be recomputed using future formulas

### Snapshot Layers

1. Organization snapshot
- one record per calculation event
- stores score, completeness, weights, recognition, drivers, version

2. Role snapshot
- one record per role inside each organization snapshot
- stores coverage and risk state

3. Candidate-role snapshot
- one record per candidate-role track inside each organization snapshot
- stores readiness and engagement state

### Frequency

Recommended:
- manual recalculation initially
- scheduled daily snapshot later

### Snapshot Generation Flow

1. Load current live dashboard intelligence inputs
2. Run versioned calculation service
3. Compute completeness and category scores
4. Write organization snapshot
5. Write role snapshots
6. Write candidate-role snapshots
7. Expose previous snapshot comparison in the dashboard

## 8. Calculation-Versioning Design

### Goal

Allow formula evolution without corrupting historical interpretation.

### Proposed design

- Add `calculation_version` to:
  - `organization_continuity_snapshots`
  - `development_records.calculation_version`
- Create a calculation module with named versions, for example:
  - `continuity-v1-current-dashboard`
  - `continuity-v2-critical-role-aware`

### Rules

- Historical snapshots must always retain the exact version used
- Dashboard detail view should show:
  - version
  - category weights
  - completeness
  - top drivers
- Version changes should require:
  - test coverage
  - explicit release note

## 9. Dashboard Components to Retain

- Leadership Continuity Score card
- Critical Roles Covered card
- Ready Successors card
- High-Risk Roles card
- Average Time to Readiness card
- Leadership Risk by Role
- Candidate Movement
- Competency Growth Trends
- Mentor Effectiveness
- Development Experience Impact
- Recommendations
- Succession Risks
- Learned Insights

## 10. Dashboard Components to Revise

- Leadership Continuity Score
  - revise to show:
    - score details
    - data completeness
    - change from previous snapshot
    - last calculated date
    - version
- Critical Roles Covered
  - revise to use explicit critical-role designation
- Ready Successors
  - revise to rely on track-level readiness review freshness
- High-Risk Roles
  - revise to incorporate role criticality and risk reasons
- Mentor Effectiveness
  - revise to distinguish assignment from active engagement
- Recommendations / Succession Risks
  - revise to separate:
    - factual deficiencies
    - calculated risks
    - AI-generated insight
- Trend capability
  - revise from live-period inference to snapshot-based comparison

## 11. Dashboard Components Proposed for Removal

No major component should be fully removed in Phase 2.

Instead:
- preserve all existing high-level sections
- tighten definitions
- reduce misleading interpretation
- avoid adding duplicate KPI bands or alternate dashboards

Potential future reduction:
- the “Learned Insights” section may eventually become subordinate to a score-detail drawer if it becomes noisy or duplicative, but it should not be removed during this phase

## 12. Migration Sequence

### Phase 2A: Foundation Extensions

1. Extend `roles`
2. Extend `candidate_role_considerations`
3. Extend `candidate_project_assignments`
4. Extend `mentor_role_assignments`
5. Extend `development_records`
6. Extend `development_record_competencies`

### Phase 2B: Calculation Preparation

7. Backfill synchronization fields where safe
8. Document `target_role_id` synchronization requirements
9. Add calculation services for:
   - data completeness
   - revised coverage
   - revised mentor engagement
   - revised risk

### Phase 2C: Historical Layer

10. Add snapshot tables
11. Add snapshot writer service
12. Add versioned calculation metadata

### Phase 2D: Dashboard Revision

13. Add score detail surface
14. Add snapshot comparison support
15. Revise cards and tables to use validated snapshot-aware logic

## 13. Test Plan

### Unit tests

- continuity score category calculation
- completeness percentage calculation
- role risk calculation
- mentor engagement calculation
- `target_role_id` synchronization rules
- snapshot version behavior

### Integration tests

- candidate creation with target role creates synchronized primary role consideration
- primary role updates keep `candidates.target_role_id` aligned
- mentor assignment updates role-track records correctly
- development project assignment linkage to role track works
- snapshot generation writes organization, role, and candidate-role records consistently

### Data regression tests

- existing dashboard results remain stable before the revised formula is enabled
- old records without new fields continue to load
- mentor/candidate/admin permissions remain intact

### UI tests

- dashboard still renders with incomplete history
- score detail shows version and completeness
- mentor view remains scoped to assigned tracks

## 14. Feature-Flag Plan

Use additive feature flags rather than replacing the existing dashboard immediately.

Recommended flags:

- `continuity_tracking_phase2_fields`
  - enables writes to new fields
- `continuity_snapshots_enabled`
  - enables snapshot generation
- `continuity_v2_score_enabled`
  - enables revised LCI calculations
- `continuity_dashboard_v2_details`
  - enables new top-of-page score detail and change indicators

Rollout sequence:

1. fields only
2. snapshot writing
3. internal validation
4. revised score read path
5. UI detail exposure

## 15. Rollback Plan

### Safe rollback principles

- no destructive migrations
- no removal of existing score logic during initial rollout
- retain current live dashboard logic until revised calculation is validated

### Rollback steps

1. Disable `continuity_v2_score_enabled`
2. Disable `continuity_dashboard_v2_details`
3. Keep snapshot tables in place but stop reading them
4. Keep new fields in place but ignore them in calculations
5. Fall back to the current `buildDashboardIntelligence` score path

### Data rollback stance

- Do not delete snapshot data
- Do not delete additive fields
- Treat rollback as a read-path and feature-flag rollback, not a schema reversal

## 16. Items Deferred to Later Phases

- configurable LEGACY Recognition rules engine
- promotion outcome validation logic tied to actual staffing outcomes
- transition and retirement forecasting models
- scenario planning for vacancy shock analysis
- accountability task center if calculated alerts prove insufficient
- advanced AI explanation overlays
- benchmark comparisons across organizations

## Target Role Synchronization Recommendation

`candidates.target_role_id` should be retained in this phase as a primary-role convenience field and backward-compatible reference.

### Why it should remain

- it is used broadly across pages, routes, and calculations
- it supports older candidate flows
- it helps preserve simple “active role” behavior in existing UI

### Required synchronization rule

`candidate_role_considerations` should remain the primary track model.

`candidates.target_role_id` should be treated as:
- the synchronized reference to the primary active role consideration

### Practical rule set

1. When a primary candidate-role consideration is set:
   - synchronize `candidates.target_role_id` to that `role_id`
2. When a primary track is changed:
   - update `candidates.target_role_id`
3. When a primary track is archived/withdrawn/promoted:
   - select the next valid primary active track, or clear `target_role_id`
4. Readiness should remain role-specific at the consideration/track level
   - not on the `candidates` table

## Bottom Line

The current application already contains the right core concepts and a real dashboard worth preserving. Phase 2 should not build a replacement. It should:

- document and stabilize the current score
- add only the minimum missing structured fields
- make candidate-role tracking the authoritative readiness context
- persist historical snapshots
- introduce versioned score logic
- revise the current dashboard only after the revised model is validated

That is the lowest-risk path to a trustworthy historical Leadership Continuity Index.
