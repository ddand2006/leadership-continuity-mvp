create table public.role_job_descriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null unique references public.roles(id) on delete cascade,
  file_name text not null,
  file_extension text not null,
  mime_type text,
  file_size_bytes integer not null check (file_size_bytes > 0),
  storage_bucket text not null,
  storage_path text not null unique,
  extracted_text text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.role_job_descriptions enable row level security;
create policy "organization members can manage role job descriptions"
on public.role_job_descriptions for all
using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

insert into storage.buckets (id, name, public)
values ('role-job-descriptions', 'role-job-descriptions', false)
on conflict (id) do nothing;
