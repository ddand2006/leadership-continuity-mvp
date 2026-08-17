-- Allow a 360 review to be created for a candidate who may not have an
-- organization-user account, while preserving the existing employee workflow.
alter table public.review_360_cycles
  alter column employee_organization_user_id drop not null;

alter table public.review_360_cycles
  add column if not exists candidate_id uuid references public.candidates(id) on delete restrict;

alter table public.review_360_cycles
  add constraint review_360_cycles_subject_check
  check (
    (employee_organization_user_id is not null and candidate_id is null)
    or (employee_organization_user_id is null and candidate_id is not null)
  );

create index if not exists review_360_cycles_candidate_idx
  on public.review_360_cycles (candidate_id, created_at desc)
  where candidate_id is not null;
