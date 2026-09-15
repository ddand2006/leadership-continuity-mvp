-- Minimal existing-platform fixture for the isolated coaching RLS test database.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create type public.app_role as enum('system_admin','hospital_admin','mentor','candidate');
create table public.organizations(id uuid primary key, name text,manual_access_status text default 'active');
create table public.profiles(id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, organization_id uuid references organizations(id),role public.app_role,full_name text,email text,deleted_at timestamptz);
create table public.candidates(id uuid primary key,organization_id uuid,target_role_id uuid);
create table public.role_competencies(id uuid primary key,organization_id uuid,role_id uuid,name text,definition text);
create table public.development_records(id uuid primary key,organization_id uuid,candidate_id uuid,experience_title text,mentee_task text);
create table public.organization_users(id uuid primary key,profile_id uuid,organization_id uuid,candidate_id uuid,auth_user_id uuid,status text,deleted_at timestamptz);
create table public.platform_audit_events(id uuid primary key default gen_random_uuid(),actor_profile_id uuid,organization_id uuid,event_type text,details jsonb);
create function public.current_profile_organization_id() returns uuid language sql stable security definer set search_path=public as $$ select organization_id from profiles where auth_user_id=auth.uid() limit 1 $$;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
