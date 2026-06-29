create table public.candidate_source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  document_category text not null,
  file_name text not null,
  file_extension text not null,
  mime_type text,
  file_size_bytes integer not null check (file_size_bytes > 0),
  storage_bucket text not null,
  storage_path text not null unique,
  extracted_text text not null,
  created_at timestamptz not null default now()
);

create index candidate_source_documents_candidate_idx
on public.candidate_source_documents (candidate_id, document_category, created_at desc);

alter table public.candidate_source_documents enable row level security;

create policy "organization members can manage candidate source documents"
on public.candidate_source_documents
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into storage.buckets (id, name, public)
values ('candidate-source-documents', 'candidate-source-documents', false)
on conflict (id) do nothing;
