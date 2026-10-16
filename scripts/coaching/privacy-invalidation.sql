\set ON_ERROR_STOP on
begin;
-- Exercise the real trigger and all cache scopes in a rolled-back transaction.
-- Also run the consent workflow through the hosted Data API to cover pg_safeupdate;
-- managed staging does not permit loading that library from the SQL connection.
insert into public.coaching_scale_snapshots(scope_key,filters,data,definition_version)
values ('platform:privacy-regression','{}','{"stale":true}','privacy-regression'),
       ('organization:privacy-regression','{}','{"stale":true}','privacy-regression');
create temp table coaching_privacy_trigger_probe(id integer);
create trigger privacy_probe after insert on coaching_privacy_trigger_probe
for each statement execute function coaching_scale_internal.invalidate_privacy();
insert into coaching_privacy_trigger_probe values(1);
do $$ begin
 if exists(select 1 from public.coaching_scale_snapshots) then
  raise exception 'FAIL: privacy change retained cached aggregates';
 end if;
 raise notice 'PASS: guarded privacy trigger invalidates all cached aggregate scopes';
end $$;
rollback;
