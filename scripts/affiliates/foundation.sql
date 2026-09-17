-- Run only in a disposable PostgreSQL database after the affiliate migration.
insert into affiliates(id,slug,name,draft_branding,published_branding,initial_bps,renewal_bps)
values ('11111111-1111-4111-8111-111111111111','sample','Sample','{}','{}',2000,1000);
insert into organizations(id,name,affiliate_id,affiliate_terms)
values ('22222222-2222-4222-8222-222222222222','First','11111111-1111-4111-8111-111111111111','{"initial_bps":9999}');
do $$ begin
 if (select affiliate_terms->>'initial_bps' from organizations where name='First') <> '2000' then raise exception 'Client spoofed rate'; end if;
 begin
  update organizations set affiliate_terms='{}' where name='First';
  raise exception 'Expected immutable attribution';
 exception when raise_exception then
  if SQLERRM <> 'Affiliate attribution and agreed terms cannot be changed' then raise; end if;
 end;
end $$;
update affiliates set initial_bps=2500,renewal_bps=1500;
insert into organizations(id,name,affiliate_id) values ('33333333-3333-4333-8333-333333333333','Second','11111111-1111-4111-8111-111111111111');
do $$ begin
 if (select affiliate_terms->>'initial_bps' from organizations where name='First') <> '2000' then raise exception 'Existing rates changed'; end if;
 if (select affiliate_terms->>'initial_bps' from organizations where name='Second') <> '2500' then raise exception 'New rate missing'; end if;
 if (select terms_version from affiliates) <> 2 then raise exception 'Version missing'; end if;
 if has_table_privilege('authenticated','affiliates','SELECT') or has_table_privilege('anon','affiliates','UPDATE') then raise exception 'Private terms exposed'; end if;
end $$;
update affiliates set published_branding=null;
do $$ begin
 begin
  insert into organizations(id,name,affiliate_id) values (gen_random_uuid(),'Blocked','11111111-1111-4111-8111-111111111111');
  raise exception 'Expected unpublished rejection';
 exception when raise_exception then
  if SQLERRM <> 'Affiliate is not accepting referrals' then raise; end if;
 end;
end $$;
select 'Affiliate database checks passed' as result;
