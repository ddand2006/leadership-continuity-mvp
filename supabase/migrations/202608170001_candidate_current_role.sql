-- A candidate's current organizational role is distinct from the role(s)
-- they are being considered for in succession planning.
alter table public.candidates
  add column if not exists current_role_id uuid references public.roles(id) on delete set null;

create index if not exists candidates_current_role_idx
  on public.candidates (organization_id, current_role_id)
  where current_role_id is not null;
