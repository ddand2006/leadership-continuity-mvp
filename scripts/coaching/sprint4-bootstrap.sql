-- Only for the isolated coaching test fixture, never the hosted application database.
alter table candidates add column full_name text default 'Fixture Leader', add column deleted_at timestamptz;
alter table roles add column description text, add column deleted_at timestamptz, add column updated_at timestamptz default now();
alter table role_competencies add column target_score numeric default 4, add column weight numeric default 1, add column deleted_at timestamptz, add column updated_at timestamptz default now();
alter table development_records add column role_id uuid, add column mentor_review_date date, add column archived_at timestamptz;
alter table development_record_competencies add column current_score integer, add column target_score integer;
create table interview_panels(id uuid primary key default gen_random_uuid(),organization_id uuid,candidate_id uuid,role_id uuid,panel_name text,date_completed date);
create table interview_scores(id uuid primary key default gen_random_uuid(),organization_id uuid,panel_id uuid,competency_id uuid,score_numeric numeric,evidence_notes text,concern_notes text);
create table development_projects(id uuid primary key,organization_id uuid,title text,description text,deleted_at timestamptz);
create table candidate_project_assignments(id uuid primary key,organization_id uuid,candidate_id uuid,development_project_id uuid,status text,updated_at timestamptz default now());
create table training_programs(id uuid primary key,organization_id uuid,name text,description text);
create table training_selections(id uuid primary key,organization_id uuid,candidate_id uuid,training_program_id uuid,status text,updated_at timestamptz default now());
create table mentor_role_assignments(id uuid primary key,organization_id uuid,candidate_id uuid,role_id uuid,mentor_profile_id uuid,status text,updated_at timestamptz default now());
create table candidate_role_matches(id uuid primary key default gen_random_uuid(),organization_id uuid,candidate_id uuid,role_id uuid,match_status text check(match_status in ('match','not_yet','not_recommended')),readiness_score numeric check(readiness_score between 0 and 100),decision_notes text,recorded_by_profile_id uuid,created_at timestamptz default now());
create table review_360_cycles(id uuid primary key,organization_id uuid,candidate_id uuid,employee_organization_user_id uuid,role_id uuid,status text,results_released_at timestamptz,confidentiality_threshold int default 3);
create table review_360_snapshot_competencies(id uuid primary key,organization_id uuid,review_cycle_id uuid,source_role_competency_id uuid,name text,target_score numeric);
create table review_360_respondents(id uuid primary key,organization_id uuid,review_cycle_id uuid,status text,confirmed_relationship text,invited_relationship text);
create table review_360_ratings(id uuid primary key,organization_id uuid,review_cycle_id uuid,respondent_id uuid,snapshot_competency_id uuid,rating int,not_observed boolean,comment text);

create table candidate_strengths(id uuid primary key,organization_id uuid,candidate_id uuid,theme_name text,rank integer,domain text,notes text,updated_at timestamptz default now());
