begin;

create or replace function public.coach_portal_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  is_admin boolean;
  profile_row jsonb;
  insurance_rows jsonb;
  credential_rows jsonb;
begin
  select cp.id into cid from public.coach_profiles cp where cp.user_id = auth.uid();
  select exists(select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.role = 'system_admin') into is_admin;
  if cid is null and not is_admin then raise exception 'Coach profile not found'; end if;
  select to_jsonb(cp) into profile_row from public.coach_profiles cp where cp.id = cid;
  select coalesce(jsonb_agg(to_jsonb(ci) order by ci.expiration_date desc), '[]'::jsonb)
    into insurance_rows from public.coach_insurance ci where ci.coach_id = cid;
  select coalesce(jsonb_agg(to_jsonb(cc) order by cc.expiration_date desc nulls last, cc.created_at desc), '[]'::jsonb)
    into credential_rows from public.coach_credentials cc where cc.coach_id = cid;
  return jsonb_build_object('profile', profile_row, 'insurance', insurance_rows, 'credentials', credential_rows);
end;
$$;

create or replace function public.coach_portal_save_profile(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  select id into cid from public.coach_profiles where user_id = auth.uid();
  if cid is null then raise exception 'Coach profile not found'; end if;
  update public.coach_profiles set
    headline = nullif(payload->>'headline',''), short_bio = nullif(payload->>'short_bio',''),
    full_bio = nullif(payload->>'full_bio',''), coaching_philosophy = nullif(payload->>'coaching_philosophy',''),
    city = nullif(payload->>'city',''), country = nullif(payload->>'country',''), timezone = nullif(payload->>'timezone',''),
    phone = nullif(payload->>'phone',''), years_coaching = coalesce(nullif(payload->>'years_coaching','')::int, years_coaching),
    years_leadership_experience = coalesce(nullif(payload->>'years_leadership_experience','')::int, years_leadership_experience),
    virtual_available = coalesce((payload->>'virtual_available')::boolean, virtual_available),
    in_person_available = coalesce((payload->>'in_person_available')::boolean, in_person_available),
    updated_at = now() where id = cid;
  perform public.coach_recalculate_eligibility(cid, auth.uid(), false);
  return cid::text;
end;
$$;

create or replace function public.coach_portal_add_credential(payload jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare cid uuid; rid uuid;
begin
  select id into cid from public.coach_profiles where user_id = auth.uid();
  if cid is null then raise exception 'Coach profile not found'; end if;
  insert into public.coach_credentials(coach_id, credential_type, credential_name, issuing_organization, credential_number, issued_date, expiration_date, notes)
  values (cid, coalesce(nullif(payload->>'credential_type',''),'professional'), payload->>'credential_name', nullif(payload->>'issuing_organization',''), nullif(payload->>'credential_number',''), nullif(payload->>'issued_date','')::date, nullif(payload->>'expiration_date','')::date, nullif(payload->>'notes','')) returning id into rid;
  perform public.coach_recalculate_eligibility(cid, auth.uid(), false); return rid;
end;
$$;

create or replace function public.coach_portal_review(coach_id uuid, decision text, note text default null)
returns text language plpgsql security definer set search_path = public
as $$
declare admin_ok boolean; next_status text;
begin
  select exists(select 1 from public.profiles where auth_user_id = auth.uid() and role = 'system_admin') into admin_ok;
  if not admin_ok then raise exception 'Administrator access required'; end if;
  if decision not in ('verify_insurance','reject_insurance','verify_credential','reject_credential','suspend','restore') then raise exception 'Unsupported review decision'; end if;
  if decision = 'suspend' then update public.coach_profiles set profile_status='suspended', marketplace_status='suspended', suspension_reason=note, suspended_at=now() where id=coach_id;
  elsif decision = 'restore' then update public.coach_profiles set profile_status='pending_review', marketplace_status='pending_review', suspension_reason=null, suspended_at=null where id=coach_id;
  else next_status := case when decision like 'verify_%' then 'verified' else 'rejected' end;
    if decision like '%insurance' then update public.coach_insurance set verification_status=next_status, verified_by=auth.uid(), verified_at=now(), rejection_reason=case when next_status='rejected' then note else null end where id=(select id from public.coach_insurance where coach_id=coach_id order by expiration_date desc limit 1);
    else update public.coach_credentials set verification_status=next_status, verified_by=auth.uid(), verified_at=now(), notes=coalesce(note,notes) where id=(select id from public.coach_credentials where coach_id=coach_id order by created_at desc limit 1); end if;
  end if;
  perform public.coach_recalculate_eligibility(coach_id, auth.uid(), false); return 'ok';
end;
$$;

revoke all on function public.coach_portal_summary() from public, anon;
revoke all on function public.coach_portal_save_profile(jsonb) from public, anon;
revoke all on function public.coach_portal_add_credential(jsonb) from public, anon;
revoke all on function public.coach_portal_review(uuid,text,text) from public, anon;
grant execute on function public.coach_portal_summary() to authenticated;
grant execute on function public.coach_portal_save_profile(jsonb) to authenticated;
grant execute on function public.coach_portal_add_credential(jsonb) to authenticated;
grant execute on function public.coach_portal_review(uuid,text,text) to authenticated;
commit;
