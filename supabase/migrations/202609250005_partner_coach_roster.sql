begin;
alter table public.partner_applications add column if not exists account_type text not null default 'company' check (account_type in ('company','individual_coach'));
create table if not exists public.partner_coaches (id uuid primary key default gen_random_uuid(), partner_application_id uuid not null references public.partner_applications(id) on delete cascade, coach_user_id uuid references auth.users(id) on delete set null, coach_name text not null, coach_email text not null, specialty text, invitation_status text not null default 'pending' check (invitation_status in ('pending','invited','accepted','inactive')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(partner_application_id,coach_email));
alter table public.partner_coaches enable row level security;
revoke all on public.partner_coaches from public, anon, authenticated;
grant select on public.partner_coaches to authenticated;
create policy partner_coaches_owner_read on public.partner_coaches for select to authenticated using (exists(select 1 from public.partner_applications p where p.id=partner_application_id and (p.auth_user_id=auth.uid() or exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='system_admin'))));
commit;
