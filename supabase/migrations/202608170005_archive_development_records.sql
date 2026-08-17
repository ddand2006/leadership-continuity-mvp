-- Keep leadership development history recoverable without showing archived work
-- in the active candidate progress record.
alter table public.development_records
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists development_records_active_lookup_idx
  on public.development_records (
    organization_id,
    candidate_id,
    role_id,
    mentor_id,
    archived_at
  );
