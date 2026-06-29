# Leadership Continuity Architecture

## Product Direction

Leadership Continuity is a succession-planning and mentoring platform for hospital organizations. The product should guide an organization from role definition through candidate evaluation, mentoring, development planning, and final hiring decisions.

The experience should feel workflow-driven, not just form-driven.

## Primary Workflow

1. Create account and organization workspace.
2. Add the first role and describe the ideal candidate.
3. Generate or upload a role composite.
4. Generate supporting forms for that role.
5. Create or import candidate profiles and attach source documents.
6. Evaluate whether a candidate matches the role.
7. If the fit is not ready yet, begin mentoring and assign development plans.
8. Reassess readiness over time.
9. Make a hiring decision: yes, no, or continue mentoring.

## Page Map

### 1. Landing / Auth

Purpose:
- Sign in
- Create account
- Initialize organization

Key data:
- auth users
- organization
- admin profile

### 2. Company Dashboard

Purpose:
- Main company hub after sign-in
- Show pipeline health and action items

Sections:
- organization overview
- counts for roles, candidates, development plans, reports
- mentoring activity
- pending decisions
- quick links into workflow stages

### 3. Roles

Purpose:
- Define what success looks like in each role

Capabilities:
- create role manually
- upload role composite
- attach ideal candidate competencies
- generate role-specific forms
- view role competencies and red flags

Key data:
- roles
- role_candidate_characteristics
- role_competencies
- generated_forms

### 4. Candidates

Purpose:
- Maintain each succession candidate profile

Capabilities:
- candidate record creation
- attach candidate to target role
- upload Gallup / strengths documents
- upload nomination forms and interview materials
- generate mentor report
- review readiness and fit evidence

Key data:
- candidates
- candidate_strengths
- candidate_source_documents
- interview_panels
- interview_scores
- mentor_reports

### 5. Reports / Forms

Purpose:
- Central library for generated and uploaded forms

Capabilities:
- view blank templates
- view generated role-specific forms
- upload completed forms
- store PDFs, DOCX, CSV, and text assets

Key data:
- generated_forms
- candidate_source_documents
- future form submission records

### 6. Development Plans

Purpose:
- Turn role gaps into practical growth assignments

Capabilities:
- browse seeded development plans
- recommend plans from candidate gaps and strengths
- tie plans to roles and candidates
- track plan status over time

Key data:
- development_projects
- future candidate_development_plans

### 7. Mentoring

Purpose:
- Manage ongoing mentor-driven development

Capabilities:
- assign mentor
- schedule start date
- send reminders
- log check-ins
- monitor growth against the target role

Key data:
- future mentor_assignments
- future mentoring_cycles
- future mentoring_checkins

## Core Data Model

### Existing / In Progress

- `organizations`
- `profiles`
- `roles`
- `role_candidate_characteristics`
- `role_competencies`
- `candidates`
- `candidate_strengths`
- `candidate_source_documents`
- `interview_panels`
- `interview_scores`
- `mentor_reports`
- `openai_usage_logs`
- `development_projects`

### Recommended Next Tables

#### `generated_forms`

Purpose:
- Stores role-generated or candidate-generated forms

Suggested fields:
- `id`
- `organization_id`
- `role_id` nullable
- `candidate_id` nullable
- `form_type`
- `title`
- `storage_bucket`
- `storage_path`
- `source_context_json`
- `created_at`

#### `candidate_role_matches`

Purpose:
- Stores an explicit role fit decision snapshot for a candidate

Suggested fields:
- `id`
- `organization_id`
- `candidate_id`
- `role_id`
- `match_status` (`match`, `not_yet`, `not_recommended`)
- `readiness_score`
- `decision_notes`
- `created_at`

#### `mentor_assignments`

Purpose:
- Tracks which mentor owns a candidate’s development path

Suggested fields:
- `id`
- `organization_id`
- `candidate_id`
- `role_id`
- `mentor_profile_id`
- `start_date`
- `status`
- `created_at`

#### `candidate_development_plans`

Purpose:
- Assigns development plans to a candidate

Suggested fields:
- `id`
- `organization_id`
- `candidate_id`
- `role_id`
- `development_project_id`
- `assigned_by_profile_id`
- `status`
- `target_outcome`
- `due_date`
- `created_at`

#### `hiring_decisions`

Purpose:
- Captures the final or interim decision for a role-candidate pairing

Suggested fields:
- `id`
- `organization_id`
- `candidate_id`
- `role_id`
- `decision` (`hire`, `continue_mentoring`, `decline`)
- `decision_notes`
- `decided_by_profile_id`
- `created_at`

## Navigation Model

Top navigation should be:

- Dashboard
- Roles
- Candidates
- Reports / Forms
- Development Plans
- Mentoring

Short-term MVP note:
- `Reports / Forms` and `Mentoring` can launch after the current Roles, Candidates, and Development Plans foundation is stable.

## Implementation Phases

### Phase 1: Clarify the core experience

- rename Projects to Development Plans
- keep Dashboard, Roles, Candidates, Development Plans as primary navigation
- improve the dashboard so it acts as the company hub

### Phase 2: Complete role and candidate intake

- finish role creation workflow
- attach ideal candidate competencies to roles
- support document-driven candidate intake
- support generated role forms

### Phase 3: Add workflow state

- add candidate-to-role match records
- add development-plan assignment records
- add decision tracking

### Phase 4: Add mentoring operations

- mentor assignment
- start dates
- reminders
- check-in logging
- progress status

### Phase 5: Expand reports and forms

- dedicated reports/forms page
- generated nomination forms
- generated scorecards
- generated candidate profile packets

## Immediate Build Priorities

1. Keep the page language aligned with the workflow: Development Plans instead of Projects.
2. Turn the dashboard into the company hub from the website structure diagram.
3. Add a Reports / Forms area.
4. Add database records for candidate-role decisions and assigned development plans.
5. Add mentor assignment and mentoring-cycle tracking.
