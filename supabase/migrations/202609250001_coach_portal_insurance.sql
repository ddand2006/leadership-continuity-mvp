begin;
create or replace function public.coach_portal_add_insurance(payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare cid uuid; rid uuid;
begin
  select id into cid from public.coach_profiles where user_id = auth.uid();
  if cid is null then raise exception 'Coach profile not found'; end if;
  insert into public.coach_insurance(coach_id, insurer, policy_number, coverage_type, coverage_amount, effective_date, expiration_date, certificate_bucket, certificate_path)
  values (cid, payload->>'insurer', payload->>'policy_number', payload->>'coverage_type', nullif(payload->>'coverage_amount','')::numeric, (payload->>'effective_date')::date, (payload->>'expiration_date')::date, payload->>'certificate_bucket', payload->>'certificate_path') returning id into rid;
  perform public.coach_recalculate_eligibility(cid, auth.uid(), false); return rid;
end;
$$;
revoke all on function public.coach_portal_add_insurance(jsonb) from public, anon;
grant execute on function public.coach_portal_add_insurance(jsonb) to authenticated;
commit;
