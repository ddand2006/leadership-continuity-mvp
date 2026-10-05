alter table public.candidate_source_documents
  add column if not exists document_status text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

update public.candidate_source_documents
set document_status = case
  when document_status in ('draft', 'reviewed', 'approved', 'superseded', 'archived') then document_status
  else 'current'
end
where document_status is null
   or document_status not in ('draft', 'reviewed', 'approved', 'superseded', 'archived');

alter table public.candidate_source_documents
  alter column document_status set default 'current',
  alter column document_status set not null,
  drop constraint if exists candidate_source_documents_document_status_check,
  add constraint candidate_source_documents_document_status_check
    check (document_status in ('current', 'draft', 'reviewed', 'approved', 'superseded', 'archived'));

alter table public.mentor_reports
  add column if not exists document_status text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

update public.mentor_reports
set document_status = case
  when document_status in ('draft', 'reviewed', 'approved', 'superseded', 'archived') then document_status
  else 'current'
end
where document_status is null
   or document_status not in ('draft', 'reviewed', 'approved', 'superseded', 'archived');

alter table public.mentor_reports
  alter column document_status set default 'current',
  alter column document_status set not null,
  drop constraint if exists mentor_reports_document_status_check,
  add constraint mentor_reports_document_status_check
    check (document_status in ('current', 'draft', 'reviewed', 'approved', 'superseded', 'archived'));

create index if not exists candidate_source_documents_status_idx
  on public.candidate_source_documents (organization_id, document_status, created_at desc);
create index if not exists mentor_reports_status_idx
  on public.mentor_reports (organization_id, document_status, created_at desc);
