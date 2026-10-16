begin;

-- Membership is independent of payment-recipient email and workspace roles.
create table public.affiliate_memberships (
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','finance','member')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  primary key (affiliate_id,user_id)
);
alter table public.affiliate_memberships enable row level security;
revoke all on public.affiliate_memberships from public,anon,authenticated;
grant all on public.affiliate_memberships to service_role;

-- Preserve existing verified payout contacts as explicit members once.
insert into public.affiliate_memberships(affiliate_id,user_id,role)
select a.id,u.id,'owner' from public.affiliates a join auth.users u
on lower(u.email)=lower(a.payout_email) and u.email_confirmed_at is not null
where not a.is_sandbox on conflict do nothing;
insert into public.affiliate_memberships(affiliate_id,user_id,role)
select affiliate_id,auth_user_id,'owner' from public.partner_applications
where affiliate_id is not null and status='approved' on conflict(affiliate_id,user_id) do update set role='owner';

create function public.affiliate_member_role(affiliate uuid, actor uuid) returns text
language sql stable security definer set search_path=public as $$
 select m.role from affiliate_memberships m join affiliates a on a.id=m.affiliate_id
 join auth.users u on u.id=m.user_id
 where m.affiliate_id=affiliate and m.user_id=actor and m.status='active'
 and u.email_confirmed_at is not null and not a.is_sandbox
 and (not exists(select 1 from partner_applications p where p.affiliate_id=affiliate)
   or exists(select 1 from partner_applications p where p.affiliate_id=affiliate and p.status='approved'))
$$;
revoke all on function public.affiliate_member_role(uuid,uuid) from public,anon,authenticated;
grant execute on function public.affiliate_member_role(uuid,uuid) to service_role;

create function public.partner_user_for_email(address text) returns uuid
language sql stable security definer set search_path=public as $$
 select id from auth.users where lower(email)=lower(trim(address)) limit 1
$$;
revoke all on function public.partner_user_for_email(text) from public,anon,authenticated;
grant execute on function public.partner_user_for_email(text) to service_role;

create function public.partner_team_members(affiliate uuid, actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if affiliate_member_role(affiliate,actor)<>'owner' or affiliate_member_role(affiliate,actor) is null then raise exception 'Partner owner required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'status',m.status) order by m.created_at),'[]') from affiliate_memberships m join auth.users u on u.id=m.user_id where m.affiliate_id=affiliate);
end $$;
revoke all on function public.partner_team_members(uuid,uuid) from public,anon,authenticated;
grant execute on function public.partner_team_members(uuid,uuid) to service_role;

-- One transaction, so retrying approval cannot produce orphan affiliate records.
create function public.review_partner_application(application uuid, decision text, actor uuid, note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p partner_applications; aid uuid; branding jsonb;
begin
 if not exists(select 1 from profiles where auth_user_id=actor and role='system_admin' and deleted_at is null)
 then raise exception 'Platform administrator required'; end if;
 if decision not in ('approved','rejected','suspended') then raise exception 'Unsupported decision'; end if;
 select * into p from partner_applications where id=application for update;
 if not found then raise exception 'Partner application not found'; end if;
 aid:=p.affiliate_id;
 if decision='approved' then
  if aid is null then
   branding:=jsonb_build_object('displayName',p.organization_name,'headline','Build your next generation of leaders',
    'description','Prepare your organization for leadership transitions through development, mentoring, and succession.',
    'contactName',p.contact_name,'contactEmail',p.email,'phone',coalesce(p.phone,''),'address',coalesce(p.address,''),'color','#1d4ed8','logoUrl','');
   insert into affiliates(name,slug,draft_branding,initial_bps,renewal_bps,payout_email)
   values(p.organization_name,coalesce(nullif(trim(both '-' from left(regexp_replace(lower(p.organization_name),'[^a-z0-9]+','-','g'),60)),''),'partner')||'-'||left(p.id::text,8),branding,0,0,lower(p.email)) returning id into aid;
  end if;
  insert into affiliate_memberships(affiliate_id,user_id,role) values(aid,p.auth_user_id,'owner')
  on conflict(affiliate_id,user_id) do update set role='owner',status='active';
 end if;
 update partner_applications set status=decision,affiliate_id=aid,review_notes=nullif(note,''),reviewed_by=actor,reviewed_at=now(),updated_at=now() where id=application;
 return jsonb_build_object('id',p.id,'status',decision,'affiliate_id',aid,'review_notes',nullif(note,''),'reviewed_at',now());
end $$;
revoke all on function public.review_partner_application(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_partner_application(uuid,text,uuid,text) to service_role;

alter table public.partner_coaches add column coach_profile_id uuid references public.coach_profiles(id);
update partner_coaches r set coach_profile_id=c.id from coach_profiles c where c.user_id=r.coach_user_id;

create function public.link_partner_coach(application uuid, coach_user uuid, coach_name text, coach_email text, specialty text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid;
begin
 if not exists(select 1 from partner_applications where id=application and status='approved') then raise exception 'Approved partner required'; end if;
 if not exists(select 1 from auth.users where id=coach_user and lower(email)=lower(coach_email)) then raise exception 'Coach identity mismatch'; end if;
 insert into coach_profiles(user_id,display_name,email,first_name,last_name)
 values(coach_user,coach_name,lower(coach_email),split_part(coach_name,' ',1),nullif(trim(substr(coach_name,length(split_part(coach_name,' ',1))+1)),''))
 on conflict(user_id) do nothing;
 select id into cid from coach_profiles where user_id=coach_user;
 insert into partner_coaches(partner_application_id,coach_user_id,coach_profile_id,coach_name,coach_email,specialty,invitation_status)
 values(application,coach_user,cid,coach_name,lower(coach_email),nullif(specialty,''),'invited')
 on conflict on constraint partner_coaches_partner_application_id_coach_email_key do update set coach_user_id=excluded.coach_user_id,coach_profile_id=excluded.coach_profile_id,invitation_status=case when partner_coaches.invitation_status='inactive' then 'invited' else partner_coaches.invitation_status end,updated_at=now()
 returning id into rid;
 return (select to_jsonb(r) from partner_coaches r where id=rid);
end $$;
revoke all on function public.link_partner_coach(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.link_partner_coach(uuid,uuid,text,text,text) to service_role;

-- Resolve old invitations only through the verified signed-in identity, never metadata.
create function public.partner_complete_coach_onboarding() returns uuid
language plpgsql security definer set search_path=public as $$
declare cid uuid; invite_email text; invite_name text;
begin
 select email into invite_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if invite_email is null then return null; end if;
 select id into cid from coach_profiles where user_id=auth.uid();
 select r.coach_name into invite_name from partner_coaches r join partner_applications p on p.id=r.partner_application_id
 where lower(r.coach_email)=lower(invite_email) and (r.coach_user_id is null or r.coach_user_id=auth.uid()) and r.invitation_status in ('invited','accepted') and p.status='approved' limit 1;
 if invite_name is null then return cid; end if;
 insert into coach_profiles(user_id,display_name,email,first_name,last_name)
 values(auth.uid(),invite_name,lower(invite_email),split_part(invite_name,' ',1),nullif(trim(substr(invite_name,length(split_part(invite_name,' ',1))+1)),'')) on conflict(user_id) do nothing;
 select id into cid from coach_profiles where user_id=auth.uid();
 update partner_coaches set coach_user_id=auth.uid(),coach_profile_id=cid,updated_at=now()
 where lower(coach_email)=lower(invite_email) and (coach_user_id is null or coach_user_id=auth.uid()) and invitation_status in ('invited','accepted');
 return cid;
end $$;
create function public.partner_coach_affiliations() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',p.organization_name,'status',r.invitation_status)),'[]')
 from partner_coaches r join partner_applications p on p.id=r.partner_application_id
 join auth.users u on u.id=r.coach_user_id
 where r.coach_user_id=auth.uid() and u.email_confirmed_at is not null and p.status='approved' and r.invitation_status<>'inactive'
$$;
create function public.confirm_partner_coach(roster uuid, accepted boolean) returns text
language plpgsql security definer set search_path=public as $$
declare next_status text:=case when accepted then 'accepted' else 'inactive' end;
begin
 if not coaching_identity_enabled() then raise exception 'Active coaching identity required'; end if;
 update partner_coaches r set invitation_status=next_status,updated_at=now()
 from partner_applications p,auth.users u where r.id=roster and r.partner_application_id=p.id and p.status='approved'
 and r.coach_user_id=auth.uid() and u.id=auth.uid() and u.email_confirmed_at is not null
 and r.coach_profile_id is not null;
 if not found then raise exception 'Coach invitation unavailable'; end if;
 return next_status;
end $$;
revoke all on function public.partner_complete_coach_onboarding(),public.partner_coach_affiliations(),public.confirm_partner_coach(uuid,boolean) from public,anon;
grant execute on function public.partner_complete_coach_onboarding(),public.partner_coach_affiliations(),public.confirm_partner_coach(uuid,boolean) to authenticated;

-- Roll out identities while keeping all existing organization/engagement/consent checks.
create or replace function public.coaching_preview_allowed() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and (
  exists(select 1 from profiles p where p.auth_user_id=u.id and p.deleted_at is null and p.role in ('system_admin','hospital_admin','candidate','mentor'))
  or exists(select 1 from coach_profiles c where c.user_id=u.id and c.profile_status not in ('suspended','inactive'))))
$$;

create function public.partner_marketplace_affiliations() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('coach_id',r.coach_profile_id,'partner_id',p.affiliate_id,'partner_name',p.organization_name)),'[]')
 from partner_coaches r join partner_applications p on p.id=r.partner_application_id
 where coaching_identity_enabled() and p.status='approved' and r.invitation_status='accepted' and p.affiliate_id is not null
 and coaching_scale_internal.eligible(r.coach_profile_id)
$$;
revoke all on function public.partner_marketplace_affiliations() from public,anon;
grant execute on function public.partner_marketplace_affiliations() to authenticated;

-- Version every field that changes the agreed economics.
create or replace function public.version_affiliate_terms() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.slug<>old.slug then raise exception 'Affiliate links cannot be renamed'; end if;
 new.terms_version:=old.terms_version+case when (new.initial_bps,new.renewal_bps,new.renewal_years,new.commission_exclusions,new.payout_hold_days,new.attribution_days)
 is distinct from (old.initial_bps,old.renewal_bps,old.renewal_years,old.commission_exclusions,old.payout_hold_days,old.attribution_days) then 1 else 0 end;
 new.updated_at:=now();return new;
end $$;
commit;
