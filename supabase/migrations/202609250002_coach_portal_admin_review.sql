begin;
create or replace function public.coach_portal_admin_summary()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare admin_ok boolean; result jsonb;
begin
  select exists(select 1 from public.profiles where auth_user_id = auth.uid() and role = 'system_admin') into admin_ok;
  if not admin_ok then raise exception 'Administrator access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(cp), 'insurance', (select to_jsonb(ci) from public.coach_insurance ci where ci.coach_id=cp.id order by ci.created_at desc limit 1), 'credential', (select to_jsonb(cc) from public.coach_credentials cc where cc.coach_id=cp.id order by cc.created_at desc limit 1)) order by cp.display_name), '[]'::jsonb) into result
  from public.coach_profiles cp;
  return result;
end;
$$;
revoke all on function public.coach_portal_admin_summary() from public, anon;
grant execute on function public.coach_portal_admin_summary() to authenticated;
commit;
