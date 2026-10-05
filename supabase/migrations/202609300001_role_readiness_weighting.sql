alter table public.roles
  add column if not exists readiness_weighting text not null default 'equal';

alter table public.roles
  drop constraint if exists roles_readiness_weighting_check;

alter table public.roles
  add constraint roles_readiness_weighting_check
  check (readiness_weighting in ('equal', 'role'));
