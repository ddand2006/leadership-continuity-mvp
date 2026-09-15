-- Only after test-bootstrap.sql in a disposable database.
create table public.roles(id uuid primary key,organization_id uuid,title text);
alter table public.organizations add column industry text;
alter table public.candidates add column current_title text;
alter table public.development_records add column status text;

alter table auth.users add column email text;

create table public.development_record_competencies(id uuid primary key,development_record_id uuid,competency_name text);
