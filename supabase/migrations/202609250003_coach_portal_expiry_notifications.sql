begin;
create or replace function public.coach_portal_expiry_sweep()
returns integer language plpgsql security definer set search_path = public
as $$
declare changed integer := 0; c record; recipient uuid;
begin
  for c in select cp.id, cp.user_id, ci.id as insurance_id, ci.expiration_date
    from public.coach_profiles cp join lateral (select * from public.coach_insurance where coach_id=cp.id order by created_at desc limit 1) ci on true
    where ci.expiration_date <= current_date + 30 loop
    if c.expiration_date < current_date then
      update public.coach_insurance set verification_status='expired' where id=c.insurance_id and verification_status <> 'expired';
      perform public.coach_recalculate_eligibility(c.id, null, true);
      changed := changed + 1;
    end if;
    if c.user_id is not null then insert into public.notifications(recipient_user_id,event_type,title,href,dedupe_key) values(c.user_id,'coach_insurance_expiry','Insurance certificate expires within 30 days','/coaching/onboarding','coach-insurance:'||c.id||':'||c.expiration_date) on conflict do nothing; end if;
    for recipient in select auth_user_id from public.profiles where role='system_admin' and deleted_at is null loop
      insert into public.notifications(recipient_user_id,event_type,title,href,dedupe_key) values(recipient,'coach_insurance_expiry','Coach insurance requires review','/admin/coaching/coaches','coach-insurance-admin:'||c.id||':'||c.expiration_date) on conflict do nothing;
    end loop;
  end loop;
  return changed;
end;
$$;
revoke all on function public.coach_portal_expiry_sweep() from public, anon, authenticated;
grant execute on function public.coach_portal_expiry_sweep() to service_role;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('coach-portal-expiry-sweep','30 3 * * *','select public.coach_portal_expiry_sweep()'); end if; end $$;
commit;
