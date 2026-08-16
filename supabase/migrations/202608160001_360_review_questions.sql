-- Store each observable behavior as a separately scored question within its competency.
create table public.review_360_snapshot_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  snapshot_competency_id uuid not null references public.review_360_snapshot_competencies(id) on delete cascade,
  prompt text not null,
  display_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (snapshot_competency_id, display_order)
);

create index review_360_snapshot_questions_cycle_idx
  on public.review_360_snapshot_questions (review_cycle_id, snapshot_competency_id, display_order);

create table public.review_360_question_ratings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_cycle_id uuid not null references public.review_360_cycles(id) on delete cascade,
  respondent_id uuid not null references public.review_360_respondents(id) on delete cascade,
  snapshot_question_id uuid not null references public.review_360_snapshot_questions(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  not_observed boolean not null default false,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((rating is null) = not_observed),
  unique (respondent_id, snapshot_question_id)
);

create index review_360_question_ratings_cycle_idx
  on public.review_360_question_ratings (review_cycle_id, snapshot_question_id);

create trigger set_updated_at_review_360_question_ratings
  before update on public.review_360_question_ratings
  for each row execute function public.set_updated_at();

alter table public.review_360_snapshot_questions enable row level security;
alter table public.review_360_question_ratings enable row level security;

create policy "360 admins manage snapshot questions"
  on public.review_360_snapshot_questions for all to authenticated
  using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'))
  with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));

create policy "360 admins manage question ratings"
  on public.review_360_question_ratings for all to authenticated
  using (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'))
  with check (organization_id = public.current_profile_organization_id() and public.current_app_role() in ('system_admin','hospital_admin'));

-- Backfill saved review snapshots. Five questions are the maximum per category.
insert into public.review_360_snapshot_questions (
  organization_id, review_cycle_id, snapshot_competency_id, prompt, display_order
)
select snapshot.organization_id, snapshot.review_cycle_id, snapshot.id, question.prompt, question.display_order
from public.review_360_snapshot_competencies snapshot
cross join lateral (
  select value as prompt, ordinal::integer as display_order
  from jsonb_array_elements_text(snapshot.behavioral_indicators) with ordinality as indicators(value, ordinal)
  where ordinal <= 5
  union all
  select snapshot.definition, 1
  where jsonb_array_length(snapshot.behavioral_indicators) = 0
) question;
