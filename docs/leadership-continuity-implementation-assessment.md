# Leadership Continuity Implementation Assessment

## Scope Audited

This assessment was based on the current implementation in:

- Dashboard and executive reporting:
  - `src/app/dashboard/page.tsx`
  - `src/app/dashboard/actions.ts`
  - `src/app/reports-forms/page.tsx`
- Candidate workflow and role-fit reporting:
  - `src/app/candidates/page.tsx`
  - `src/app/candidates/[candidateId]/page.tsx`
  - `src/app/api/candidates/*.ts`
  - `src/lib/fit-analysis.ts`
  - `src/lib/strengths-role-fit.ts`
  - `src/app/api/mentor-reports/route.ts`
- Mentoring workflow:
  - `src/app/mentoring/page.tsx`
  - `src/app/api/mentoring/*.ts`
  - `src/components/leadership-development-record-manager.tsx`
  - mentoring worksheet components
- Role management and successor context:
  - `src/app/roles/page.tsx`
  - `src/app/api/roles/*.ts`
- Development plan library and generation:
  - `src/app/development-plans/page.tsx`
  - `src/app/development-plans/actions.ts`
- Access control and paid workspace enforcement:
  - `src/lib/api-route.ts`
  - `src/lib/workspace.ts`
  - `src/lib/mentor-access.ts`
- Database schema and additive migrations:
  - `supabase/migrations/*.sql`

## Existing Functionality

### Current Dashboard Components

- The executive dashboard is already implemented as a server-rendered organization intelligence page in `src/app/dashboard/page.tsx`.
- Most of the dashboard logic lives inside two internal functions:
  - `getDashboardSnapshot`
  - `buildDashboardIntelligence`
- The current dashboard already renders:
  - Leadership Continuity Score
  - Critical Roles Covered
  - Ready Successors
  - High-Risk Roles
  - Average Time to Readiness
  - Leadership Risk by Role
  - Candidate Movement
  - Competency Growth Trends
  - Mentor Effectiveness
  - Development Experience Impact
  - Recommendations and succession risks
  - Learned organization insights
- The dashboard page also includes:
  - organization setup state
  - subscription/paywall state
  - role list
  - candidate list with calculated stage labels
  - mentor directory

### Current Data Sources

- The dashboard currently pulls live data from:
  - `roles`
  - `profiles`
  - `candidates`
  - `candidate_role_considerations`
  - `mentor_role_assignments`
  - `mentor_reports`
  - `candidate_strengths`
  - `candidate_source_documents`
  - `candidate_project_assignments`
  - `development_records`
  - `development_record_competencies`
  - `development_record_feedback`
- It does not use snapshot tables. All metrics are computed on-demand at request time.

### Existing Tracking Capabilities

- Role setup:
  - roles can be created, edited, imported, and assigned mentors
  - role competencies and ideal candidate characteristics are stored separately
  - composite narrative and interview scorecard generation already exist
- Candidate pipeline:
  - candidates can be created and attached to one or more roles
  - one primary target role is still mirrored onto `candidates.target_role_id`
  - candidate role tracks can be active or on hold
- Interview and role fit:
  - interview panels and interviewer scores are stored by candidate-role-competency
  - strengths-based competency fit can be generated and stored
  - mentor reports combine interview evidence, strengths evidence, and recommended projects
- Mentoring:
  - mentors can be assigned at the role level and candidate-role level
  - preparation worksheets and project worksheets exist
  - leadership development records track scored development experiences
- Development planning:
  - reusable development projects exist
  - AI-generated development plans can be added to the project library
  - candidate-specific mentoring ideas can be promoted into project assignments
- Resource/document tracking:
  - candidate source documents are stored
  - mentor reports are versioned
  - role composite documents are stored

### Existing Candidate Readiness Logic

- There are currently two readiness models in the system.

- Model 1: candidate-role fit readiness
  - Implemented in `src/lib/fit-analysis.ts`
  - Uses:
    - interview scores
    - strengths-based competency assessments
    - role competency weights
  - Logic:
    - interview score and strengths score are combined
    - average competency score is compared with target score
    - readiness is a weighted average across competencies
  - This model is visible in candidate role-fit workflows.

- Model 2: development-program readiness
  - Implemented through `development_records`
  - Uses:
    - manual `readiness_signal`
    - `average_feedback_score`
    - scored development competencies over time
  - This model drives most organization-level dashboard readiness reporting.

- Current issue:
  - The platform does not yet have one unified readiness definition used consistently across candidate detail, mentoring, and the dashboard.

### Existing Mentor Tracking

- Mentor identity and access:
  - mentors are stored in `profiles` with `role = 'mentor'`
  - `organization_users.is_mentor` provides access alignment on login
- Mentor assignment layers:
  - `role_mentor_assignments` attaches mentors to roles
  - `mentor_role_assignments` attaches mentors to candidate-role tracks
- Mentor activity signals currently come from:
  - mentor assignments
  - start dates and notes on mentor-role assignments
  - preparation worksheets
  - project worksheets
  - leadership development records
  - mentor review dates
- Dashboard mentor effectiveness is currently derived from:
  - number of active candidate-role tracks
  - completed reviews
  - development-record competency improvement
  - overdue reviews
  - average reviewer score

### Existing Development Plan Tracking

- Development plan library:
  - `development_projects`
  - stores reusable projects, difficulty, duration, applicable roles, targeted competencies, strengths leverage, outcomes, questions, and evidence of success
- Candidate assignment layer:
  - `candidate_project_assignments`
  - stores candidate, mentor, project, status, dates, and notes
- Development record layer:
  - `development_records`
  - stores actual tracked experience execution and scored feedback
- Current issue:
  - `candidate_project_assignments` is candidate-based but not role-track-based
  - `development_records` are role-track-based but not directly linked to `candidate_project_assignments`
  - this breaks clean attribution between planned development and completed development

### Existing Role and Successor Tracking

- Roles:
  - stored in `roles`
  - enriched by `role_competencies`, `role_candidate_characteristics`, `role_composite_documents`
- Successor pipeline:
  - `candidate_role_considerations` stores role tracks for a candidate
  - `is_primary` indicates the primary role track
  - `candidates.target_role_id` still mirrors the primary role for backward compatibility
- Dashboard coverage today:
  - coverage is currently defined as “role has at least one active candidate track”
  - successor depth beyond one candidate is not modeled as a target requirement
- Ready successor logic today:
  - derived from latest `development_records.readiness_signal`
  - near-ready and role-ready are surfaced

### Existing Permissions

- Access control is centralized through:
  - `requireApiWorkspaceProfile`
  - `requireWorkspaceProfile`
  - `requirePaidWorkspaceProfile`
  - `src/lib/mentor-access.ts`
- Current functional permission model:
  - admins:
    - `system_admin`
    - `hospital_admin`
  - mentors:
    - limited to assigned candidate-role tracks
  - candidates:
    - limited to self-access where enabled
- Product access:
  - paid workspace gating is already implemented
  - leadership continuity and leadership help are gated separately
- Important note:
  - `organization_users.admin_role` stores `ceo_admin` and `manager_admin`
  - app-level authorization still primarily relies on `profiles.role`
  - this is a workable design, but it is a source of conceptual overlap

### Existing Database Tables and Relevant Fields

- `organizations`
  - `id`
  - `name`
  - `industry`
  - subscription/billing fields added later by migration

- `profiles`
  - `auth_user_id`
  - `organization_id`
  - `full_name`
  - `email`
  - `role`
  - `position_title`

- `organization_users`
  - `profile_id`
  - `candidate_id`
  - `is_candidate`
  - `is_mentor`
  - `admin_role`
  - `status`
  - invitation and activation timestamps

- `roles`
  - `title`
  - `department`
  - `description`
  - `status`

- `role_competencies`
  - `role_id`
  - `name`
  - `definition`
  - `weight`
  - `target_score`
  - `behavioral_indicators`
  - `red_flags`

- `role_candidate_characteristics`
  - `role_id`
  - `category`
  - `characteristic`
  - `sort_order`

- `role_characteristic_library`
  - `organization_id`
  - `category`
  - `characteristic`

- `role_composite_documents`
  - `role_id`
  - `document_source`
  - `file_name`
  - `storage_bucket`
  - `storage_path`

- `role_mentor_assignments`
  - `role_id`
  - `mentor_profile_id`
  - `status`
  - `notes`

- `role_surveys`
  - `role_id`
  - `title`
  - `description`
  - `status`
  - `launched_at`
  - `closed_at`

- `role_survey_recipients`
  - `survey_id`
  - `recipient_name`
  - `recipient_email`
  - `recipient_title`
  - `relationship_to_role`
  - `status`

- `role_survey_responses`
  - `survey_id`
  - `recipient_id`
  - `response_json`
  - `normalized_competencies`

- `candidates`
  - `full_name`
  - `current_title`
  - `target_role_id`
  - `mentor_profile_id`
  - `status`

- `candidate_role_considerations`
  - `candidate_id`
  - `role_id`
  - `status`
  - `is_primary`

- `mentor_role_assignments`
  - `candidate_id`
  - `role_id`
  - `mentor_profile_id`
  - `status`
  - `start_date`
  - `notes`

- `candidate_strengths`
  - `candidate_id`
  - `theme_name`
  - `rank`
  - `domain`
  - `notes`

- `candidate_source_documents`
  - `candidate_id`
  - `document_category`
  - `file_name`
  - `extracted_text`
  - storage fields

- `candidate_role_strength_assessments`
  - `candidate_id`
  - `role_id`
  - `competency_id`
  - `strength_score`
  - `supporting_strengths`
  - `rationale`

- `interview_panels`
  - `role_id`
  - `candidate_id`
  - `panel_name`
  - `date_completed`

- `interview_scores`
  - `panel_id`
  - `interviewer_profile_id`
  - `competency_id`
  - `score_numeric`
  - `evidence_notes`
  - `concern_notes`

- `mentor_reports`
  - `candidate_id`
  - `role_id`
  - `version`
  - `report_json`
  - `narrative_text`

- `development_projects`
  - `organization_id`
  - `title`
  - `description`
  - `difficulty`
  - `duration_days`
  - `applicable_roles`
  - `competencies_developed`
  - `strengths_leveraged`
  - `expected_outcomes`
  - `mentor_questions`
  - `evidence_of_success`

- `candidate_project_assignments`
  - `candidate_id`
  - `mentor_profile_id`
  - `development_project_id`
  - `status`
  - `start_date`
  - `due_date`
  - `mentor_notes`
  - `evidence_notes`

- `development_records`
  - `candidate_id`
  - `role_id`
  - `mentor_id`
  - `target_role`
  - `date_assigned`
  - `status`
  - `growth_areas`
  - `assignment_reason`
  - `experience_title`
  - `mentee_task`
  - `readiness_signal`
  - `mentor_improvement_observed`
  - `mentor_development_needed`
  - `next_recommended_experience`
  - `mentor_review_date`
  - `average_feedback_score`

- `development_record_competencies`
  - `development_record_id`
  - `competency_name`
  - `baseline_score`
  - `target_score`
  - `current_score`
  - `improvement`
  - `gap_remaining`

- `development_record_leaders`
  - `development_record_id`
  - `leader_name`
  - `department`
  - `purpose`
  - `meeting_completed`

- `development_record_feedback`
  - `development_record_id`
  - `reviewer_name`
  - `reviewer_role`
  - `review_date`
  - `growth_score`
  - `communication_score`
  - `collaboration_score`
  - `feedback_application_score`
  - `readiness_score`
  - `evidence_comments`

- Worksheet tables already exist for mentoring preparation and project execution:
  - `mentoring_preparation_worksheets`
  - `mentoring_departmental_project_worksheets`
  - `mentoring_cross_departmental_project_worksheets`

## Gaps

### Data Required by the Proposed Dashboard That Is Not Currently Tracked

- No explicit critical-role designation on `roles`
- No criticality tier, risk weighting, or business-impact ranking on roles
- No required successor depth per role
- No explicit “bench strength target” per role
- No incumbent relationship on roles
- No vacancy exposure / urgency / time-to-fill expectation per role
- No single normalized readiness score persisted per candidate-role track
- No stored readiness trend snapshots over time
- No stored role coverage trend snapshots over time
- No stored continuity index history over time
- No stored mentor engagement events
- No stored overdue review queue table
- No explicit role-track-level project assignment linkage

### Existing Data That Is Incomplete or Inconsistently Structured

- Readiness is split across:
  - interview + strengths fit calculations
  - development record readiness signals
  - average reviewer scores
- Role coverage currently treats all roles equally because there is no critical-role metadata.
- `development_projects.applicable_roles` stores role titles as text, not role IDs.
- `development_records.target_role` stores role title text, not only a relational ID.
- `development_record_competencies` stores `competency_name` text instead of a competency foreign key.
- `candidate_project_assignments` is not scoped to `role_id`, which makes role-specific development attribution weak.
- `candidates.mentor_profile_id` is legacy-style candidate-level mentoring, while current flows use role-track mentoring tables.

### Duplicate or Overlapping Concepts

- `candidates.target_role_id` overlaps with `candidate_role_considerations.is_primary`
- `candidates.mentor_profile_id` overlaps with `mentor_role_assignments`
- `profiles.role` authorization overlaps conceptually with `organization_users.admin_role` and `organization_users.is_mentor`
- Readiness appears in:
  - calculated fit analysis
  - `development_records.readiness_signal`
  - `development_records.average_feedback_score`
- Development activity appears in:
  - `candidate_project_assignments`
  - `development_records`
  - worksheet tables

### Missing Relationships Between Records

- No foreign key from `candidate_project_assignments` to `role_id`
- No foreign key from `development_records` to `candidate_project_assignments`
- No foreign key from `development_record_competencies` to `role_competencies`
- No direct linkage from `mentor_reports` to the exact interview panel set or development record snapshot used
- No direct linkage from survey results to finalized role competency revisions

### Tracking Actions That Currently Rely on Manually Entered Text

- `development_records.target_role`
- `development_records.assignment_reason`
- `development_records.experience_title`
- `development_records.mentee_task`
- `development_records.mentor_improvement_observed`
- `development_records.mentor_development_needed`
- `development_records.next_recommended_experience`
- `development_record_competencies.competency_name`
- `development_record_leaders.leader_name`
- `development_record_feedback.reviewer_name`
- `candidate_project_assignments.mentor_notes`
- `candidate_project_assignments.evidence_notes`

### Areas Where Calculated Status Should Replace Manual Status

- Candidate pipeline stage should remain calculated from underlying facts, not stored manually.
- Role coverage should remain calculated from role-track assignments and successor depth, not manually flagged.
- Continuity risk should be calculated from role criticality, successor depth, readiness, and activity freshness.
- Mentor engagement should be calculated from assignments, review cadence, and activity timestamps.
- `development_records.readiness_signal` should eventually be supported by calculated evidence, not rely only on manual selection.

### Areas Where Historical Snapshots Are Needed

- Organization continuity index over time
- Role coverage over time
- Role risk level over time
- Candidate readiness trend over time by role track
- Mentor engagement trend over time
- Development activity trend over time
- Average time-to-readiness trend over time
- Competency growth trend snapshots by period

## Recommended Implementation Plan

### Reuse Without Modification

- Reuse `roles`, `role_competencies`, `role_candidate_characteristics`, and role document tables
- Reuse `candidates`, `candidate_role_considerations`, and `mentor_role_assignments`
- Reuse `candidate_strengths`, `candidate_source_documents`, and `candidate_role_strength_assessments`
- Reuse `interview_panels`, `interview_scores`, and `mentor_reports`
- Reuse `development_records`, `development_record_competencies`, and `development_record_feedback`
- Reuse `development_projects`
- Reuse existing access-control helpers and product gating
- Reuse the existing dashboard route and current KPI layout as the base executive surface

### Extend Existing Functionality

- Extend the current dashboard intelligence layer instead of replacing it.
- Extend the current role model to distinguish critical from non-critical roles.
- Extend development record reporting so dashboard calculations use durable evidence instead of mixed inference.
- Extend candidate project assignments so assignments can be attributed to a specific role track.
- Extend dashboard filtering and recommendation logic rather than replacing the current dashboard page.

### Add New Fields

- `roles`
  - `is_critical boolean not null default false`
  - `criticality_tier text`
  - `successor_coverage_target integer not null default 1`
  - `vacancy_risk_level text`
  - `business_function text`
- `candidate_project_assignments`
  - `role_id uuid null references roles(id)`
  - `assigned_by_profile_id uuid null references profiles(id)`
- `development_records`
  - `candidate_project_assignment_id uuid null references candidate_project_assignments(id)`
  - `calculated_readiness_score numeric(4,2) null`
  - `readiness_calculation_version text null`
- `development_record_competencies`
  - `role_competency_id uuid null references role_competencies(id)`
- `candidate_role_strength_assessments`
  - `source_strengths_updated_at timestamptz null`
  - `calculated_at timestamptz null`

### Add New Tables

- `organization_continuity_snapshots`
  - org-level daily or weekly executive metrics
  - continuity index
  - coverage score
  - readiness score
  - mentor engagement score
  - review completion score
- `role_continuity_snapshots`
  - one row per role per snapshot date
  - role coverage depth
  - highest readiness
  - last activity age
  - calculated risk
- `candidate_role_readiness_snapshots`
  - one row per candidate-role track per snapshot date
  - normalized readiness score
  - readiness bucket
  - development activity freshness
- Optional later:
  - `continuity_alerts`
  - `mentor_engagement_events`

### Add New Calculations

- Unified candidate-role readiness score
  - combines:
    - interview evidence
    - strengths fit
    - development record progression
    - reviewer feedback
- Critical-role coverage score
  - based on critical roles only
  - honors required successor depth
- Role risk score
  - based on:
    - criticality
    - successor depth
    - top readiness
    - last activity freshness
    - mentor-review freshness
- Mentor engagement score
  - based on assigned tracks, review completion, overdue items, and active development records
- Continuity trend score
  - compares snapshots over time rather than recomputing history from current state only

### Add New Dashboard Components

- Executive summary band
  - refined continuity index with directional trend
- Critical-role coverage matrix
  - role-by-role depth and bench sufficiency
- High-risk role queue
  - top immediate continuity risks with action links
- Successor pipeline view
  - readiness distribution per critical role
- Mentor activity panel
  - overdue reviews and stale role tracks
- Trend charts
  - continuity score
  - readiness trend
  - coverage trend
  - mentor engagement trend
- Data quality panel
  - missing readiness inputs
  - roles without criticality flags
  - tracks without active development activity

### Defer to a Later Phase

- Predictive vacancy modeling
- Incumbent succession planning with retirement timing
- Cross-organization benchmarking
- AI-generated executive recommendations persisted as workflow tasks
- Reminder automation and escalation workflows
- Advanced scenario planning for “what if this role opens in 90 days”
- Full unification of `profiles.role` and `organization_users.admin_role` authorization semantics

## Bottom Line

The platform already has a strong operational foundation. The current system is not missing a dashboard; it already has one. The real opportunity is to make the existing intelligence more durable, more consistent, and more trustworthy by:

- unifying readiness logic
- strengthening role-track relationships
- adding critical-role metadata
- snapshotting key metrics over time
- refining the executive dashboard around those durable calculations

This should be implemented as an extension of the current architecture, not a rewrite.
