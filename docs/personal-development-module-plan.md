# Personal Development Module Plan

## Current Status

The codebase has **started the product rename and entry-point work**, but it has **not started the actual Personal Development module architecture** described in the brief.

What already exists:

- public route and navigation rename from `Leadership Help` to `Personal Development`
- challenge-support page and coaching request flow
- reusable role survey engine
- reusable role composite generation workflow
- reusable Gallup strengths upload parser
- reusable AI coaching guidance flow
- reusable mentoring and development-record components

What does **not** exist yet:

- personal dashboard and home experience
- personal role profile / role connection model
- personal leadership composite storage
- 360 leadership assessment workflow
- AI feedback report for 360 responses
- personal growth planner
- leadership journal
- progress tracking widgets
- cross-product data-sharing model for a leader who later becomes a candidate

## Reuse Map

The brief is directionally right: most of the module should be built by **reusing workflows and prompts**, not by copying them.

### Reuse Directly

- `roles`
  - use as the source for organizational role selection
- `role_surveys`, recipients, responses
  - reuse survey engine and invitation flow
- `extractRoleCompositeFromText` and `generateRoleCompositeFromIdealCompetencies`
  - reuse AI composite generation workflow
- Gallup parser and upload logic
  - reuse parsing services from `src/lib/strengths-upload.ts`
- coaching request flow
  - reuse and expand `coaching_requests` and `generateLeadershipCoachingGuidance`
- development projects and mentoring assets
  - reuse `development_projects`, mentoring worksheets, and development-record concepts

### Reuse With Extension

- dashboard patterns
  - reuse layout, summary-card patterns, and filtered-intelligence approach from `src/app/dashboard/page.tsx`
- role survey panel
  - extend into a personal-role 360 assessment launcher
- mentor / coaching data
  - extend current coaching request flow with richer context inputs, worksheet generation, and journal persistence
- narrative generation
  - reuse OpenAI client, zod response parsing, and prompt structure patterns used across existing AI libs

### Do Not Reuse As-Is

- `candidate_strengths`
  - parser can be reused, but the table is candidate-owned and should not be overloaded for personal-leader ownership
- `mentor_reports`
  - generation pattern is reusable, but the output belongs in a dedicated personal-development report model
- candidate-specific fit scoring
  - concepts are useful, but candidate-role fit and personal-leadership growth are different domains

## Recommended Product Architecture

Treat this as the first module in a **Leadership Intelligence Platform** with shared services and product-specific ownership tables.

### Shared Layer

- auth, profiles, organization membership
- subscription / product access
- roles
- survey engine
- OpenAI client and prompt helpers
- strengths parsing
- file/document storage
- development project library

### Personal Development Layer

- personal role profile
- personal composite
- personal strengths profile
- 360 assessments
- growth plans
- journal / worksheet history
- coaching context aggregation

### Cross-Module Integration Layer

- a shared data-link model between:
  - personal development profile
  - candidate profile
  - organizational role
  - mentor assignments

The key principle is:

- **shared engines**
- **separate ownership records**
- **optional cross-linking when both products are licensed**

## Recommended Phase Plan

## Phase 0: Foundations Already Started

- rename route and navigation to `Personal Development`
- preserve `/leadership-help` as redirect
- keep internal product key `leadership_help` unchanged for now

## Phase 1: Personal Development MVP

Build the minimum coherent module:

1. Personal dashboard
2. personal role profile
3. personal composite generation
4. Gallup strengths upload for personal leader
5. enhanced AI coaching page using personal context

This phase should give one leader a private development workspace before tackling 360 and journal complexity.

## Phase 2: 360 Leadership Assessment

Build:

- assessment question generation
- participant invitations
- secure response collection
- response analysis
- AI 360 feedback narrative

This phase should reuse the survey engine rather than inventing another survey stack.

## Phase 3: Growth Planner + Journal

Build:

- AI growth planner
- challenge worksheets
- journal entries
- milestone tracking
- coaching session history

## Phase 4: Cross-Module Intelligence

Build:

- succession-candidate linkage
- shared role/composite/strengths references
- development history reuse inside Leadership Continuity

## Data Model Recommendation

Keep the internal product code as `leadership_help` for now, but create **new Personal Development ownership tables** instead of forcing candidate tables to do double duty.

## Phase 1 Tables

### `personal_development_profiles`

Purpose:
- one record per leader using the Personal Development product

Suggested fields:

- `id`
- `organization_id`
- `profile_id`
- `current_role_id` nullable
- `current_position_title`
- `years_in_role`
- `leadership_history`
- `organizational_context`
- `last_composite_generated_at`
- `created_at`
- `updated_at`

### `personal_role_profiles`

Purpose:
- stores the leader's active role context
- can point to an organizational role or store a personal role built for development use

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `source_role_id` nullable
- `role_mode` enum: `organization_role`, `personal_role`
- `title`
- `department`
- `description`
- `created_at`
- `updated_at`

### `personal_leadership_composites`

Purpose:
- stores AI-generated leadership composite outputs for the personal leader

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `personal_role_profile_id`
- `composite_json`
- `narrative_json` nullable
- `source_survey_id` nullable
- `version`
- `status`
- `generated_at`
- `created_at`

### `personal_strength_profiles`

Purpose:
- stores parsed Gallup strengths for the personal leader

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `theme_name`
- `rank`
- `domain`
- `source_document_id` nullable
- `created_at`

### `personal_source_documents`

Purpose:
- stores uploaded source files for the personal leader

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `document_category`
- `file_name`
- `file_extension`
- `mime_type`
- `file_size_bytes`
- `storage_bucket`
- `storage_path`
- `extracted_text`
- `created_at`

## Phase 2 Tables

### `personal_assessments`

Purpose:
- one record per 360 assessment cycle

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `personal_role_profile_id`
- `personal_leadership_composite_id`
- `assessment_type` enum: `competency_survey`, `leadership_360`
- `title`
- `description`
- `status`
- `anonymous_responses`
- `created_at`
- `updated_at`

### `personal_assessment_questions`

Purpose:
- stores generated 360 questions for one assessment

Suggested fields:

- `id`
- `assessment_id`
- `category`
- `prompt`
- `question_type`
- `sort_order`

### `personal_assessment_recipients`

Purpose:
- participant invitations for personal assessments

Suggested fields:

- `id`
- `assessment_id`
- `recipient_name`
- `recipient_email`
- `recipient_title`
- `relationship_to_leader`
- `access_token`
- `status`
- `invited_at`
- `opened_at`
- `completed_at`

### `personal_assessment_responses`

Purpose:
- stores 360 survey responses and comments

Suggested fields:

- `id`
- `assessment_id`
- `recipient_id`
- `response_json`
- `normalized_themes`
- `overall_score`
- `submitted_at`

### `personal_feedback_reports`

Purpose:
- AI-generated analysis of a 360 cycle

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `assessment_id`
- `report_json`
- `version`
- `generated_at`
- `created_at`

## Phase 3 Tables

### `personal_growth_plans`

Purpose:
- AI-generated development priorities and plan

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `personal_leadership_composite_id`
- `feedback_report_id` nullable
- `plan_json`
- `status`
- `generated_at`
- `created_at`
- `updated_at`

### `personal_growth_priorities`

Purpose:
- normalized priority tracking for progress and analytics

Suggested fields:

- `id`
- `growth_plan_id`
- `title`
- `why_it_matters`
- `success_metrics`
- `review_timeline`
- `status`
- `sort_order`

### `personal_journal_entries`

Purpose:
- searchable journal of reflections, AI sessions, worksheets, and milestones

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `entry_type` enum: `reflection`, `worksheet`, `coaching_session`, `goal`, `milestone`, `lesson_learned`
- `title`
- `body`
- `metadata_json`
- `search_text`
- `created_at`
- `updated_at`

### `personal_coaching_sessions`

Purpose:
- stores AI leadership coach sessions with context and outputs

Suggested fields:

- `id`
- `organization_id`
- `personal_development_profile_id`
- `challenge_title`
- `challenge_summary`
- `context_snapshot_json`
- `guidance_json`
- `created_at`

## API / Route Recommendation

## Pages

- `/personal-development`
  - dashboard / home
- `/personal-development/role`
  - role setup and current-role view
- `/personal-development/composite`
  - composite generation and narrative
- `/personal-development/strengths`
  - Gallup upload and strengths interpretation
- `/personal-development/assessment`
  - survey / 360 workspace
- `/personal-development/growth-plan`
  - AI priorities and development plan
- `/personal-development/journal`
  - journal and worksheets
- `/personal-development/coaching`
  - AI leadership coach

## Phase 1 APIs

- `POST /api/personal-development/profile`
- `POST /api/personal-development/role`
- `POST /api/personal-development/composite/generate`
- `GET /api/personal-development/composite`
- `POST /api/personal-development/strengths/upload`
- `POST /api/personal-development/coaching`

## Phase 2 APIs

- `POST /api/personal-development/assessments`
- `POST /api/personal-development/assessments/[id]/generate-questions`
- `POST /api/personal-development/assessments/[id]/recipients`
- `POST /api/personal-development/assessments/respond/[token]`
- `POST /api/personal-development/assessments/[id]/generate-report`

## AI Workflow Recommendation

Every AI workflow should use a shared context builder instead of pulling ad hoc fields directly in each route.

Add a future helper such as:

- `buildPersonalDevelopmentContext(profileId)`

The assembled context should include:

- current role
- latest personal composite
- latest narrative
- strengths profile
- 360 report
- growth plan
- previous coaching sessions
- relevant journal context
- organization context

This satisfies the brief rule:

- never recommend from one isolated data source when richer context exists

## Phase 1 Build Order

1. add architecture doc and approve data model
2. create Personal Development profile + role tables
3. build `/personal-development` dashboard shell
4. build role setup and organizational-role linking
5. build personal composite generation and storage
6. wire Gallup upload into personal ownership tables
7. extend coaching flow to use role + composite + strengths context

## Phase 1 Success Criteria

At the end of phase 1, one leader should be able to:

- open Personal Development
- set or select their role
- generate their leadership composite
- upload Gallup strengths
- receive AI coaching that references their role, composite, and strengths

## Recommended Next Step

The best next code step is:

- build the **Phase 1 schema migration**
- then scaffold `/personal-development` as a real dashboard instead of a renamed coaching page

That gives the module a real data backbone before we add 360 surveys and journal features.
