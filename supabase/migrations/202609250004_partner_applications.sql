begin;
create table if not exists public.partner_applications (id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade, organization_name text not null, contact_name text not null, email text not null, phone text, website text, address text, status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')), review_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.partner_applications enable row level security;
revoke all on public.partner_applications from public, anon, authenticated;
grant select on public.partner_applications to authenticated;
create policy partner_application_owner_read on public.partner_applications for select to authenticated using (auth_user_id=auth.uid() or exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='system_admin'));
commit;
