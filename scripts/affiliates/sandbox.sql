-- Disposable database only, after all three affiliate migrations.
begin;
insert into affiliates(id,slug,name,draft_branding,initial_bps,renewal_bps,is_sandbox) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sandbox-check','Sandbox','{}',1000,0,true);
do $$ begin
 begin
  update affiliates set published_branding='{}' where slug='sandbox-check';
  raise exception 'Expected publication rejection';
 exception when raise_exception then
  if SQLERRM <> 'Sandbox affiliate pages cannot be published for live enrollment' then raise; end if;
 end;
 begin
  insert into organizations(id,name,affiliate_id) values(gen_random_uuid(),'Fake live enrollment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Expected enrollment rejection';
 exception when raise_exception then
  if SQLERRM not in ('Sandbox affiliates cannot enroll live customers','Affiliate is not accepting referrals') then raise; end if;
 end;
 if has_table_privilege('authenticated','affiliate_sandbox_clients','SELECT') or has_table_privilege('anon','affiliate_sandbox_invoices','SELECT') then raise exception 'Sandbox data exposed'; end if;
end $$;
insert into affiliate_sandbox_clients(affiliate_id,terms) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}');
do $$ begin
 begin
  update affiliates set is_sandbox=false where slug='sandbox-check';
  raise exception 'Expected environment lock';
 exception when raise_exception then
  if SQLERRM <> 'Cannot change affiliate environment after enrollment or Stripe setup' then raise; end if;
 end;
end $$;
rollback;
select 'Sandbox database isolation checks passed' as result;
