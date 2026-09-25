begin;
alter table public.partner_applications add column if not exists affiliate_id uuid references public.affiliates(id);
create table if not exists public.affiliate_people (id uuid primary key default gen_random_uuid(), partner_application_id uuid not null references public.partner_applications(id) on delete cascade, name text not null, email text not null, role text not null check (role in ('decision_maker','budget_owner','organization_admin','leader','coach','implementation_contact')), organization_name text, invitation_status text not null default 'pending' check (invitation_status in ('pending','invited','accepted','inactive')), user_id uuid references auth.users(id) on delete set null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(partner_application_id,email,role));
alter table public.affiliate_people enable row level security;
revoke all on public.affiliate_people from public,anon,authenticated;
grant select on public.affiliate_people to authenticated;
create policy affiliate_people_owner_read on public.affiliate_people for select to authenticated using (exists(select 1 from public.partner_applications p where p.id=partner_application_id and (p.auth_user_id=auth.uid() or exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='system_admin'))));
commit;
