begin;
alter table public.affiliate_people add column if not exists roles text[] not null default '{}';
update public.affiliate_people set roles=array[role] where cardinality(roles)=0;
commit;
