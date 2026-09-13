-- Files are private. Access is checked by authenticated API routes using the service client.
create table public.mentoring_documents (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create index mentoring_documents_candidate_idx on public.mentoring_documents (organization_id, candidate_id, created_at desc);
alter table public.mentoring_documents enable row level security;
revoke all on public.mentoring_documents from anon, authenticated;
insert into storage.buckets (id, name, public)
values ('mentoring-documents', 'mentoring-documents', false)
on conflict (id) do nothing;
