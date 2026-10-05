alter table public.candidate_source_documents
  add column if not exists document_status text not null default 'current'
    check (document_status in ('draft', 'reviewed', 'approved', 'superseded', 'archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.mentor_reports
  add column if not exists document_status text not null default 'current'
    check (document_status in ('draft', 'reviewed', 'approved', 'superseded', 'archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists candidate_source_documents_status_idx
  on public.candidate_source_documents (organization_id, document_status, created_at desc);
create index if not exists mentor_reports_status_idx
  on public.mentor_reports (organization_id, document_status, created_at desc);
