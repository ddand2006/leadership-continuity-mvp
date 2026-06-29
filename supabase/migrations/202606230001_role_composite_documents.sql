create table public.role_composite_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null unique references public.roles(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  document_source text not null check (document_source in ('generated', 'manual')),
  file_name text not null,
  file_extension text not null,
  mime_type text,
  file_size_bytes integer not null check (file_size_bytes > 0),
  storage_bucket text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index role_composite_documents_role_idx
on public.role_composite_documents (role_id, created_at desc);

alter table public.role_composite_documents enable row level security;

create policy "organization members can manage role composite documents"
on public.role_composite_documents
for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into storage.buckets (id, name, public)
values ('role-composite-documents', 'role-composite-documents', false)
on conflict (id) do nothing;

