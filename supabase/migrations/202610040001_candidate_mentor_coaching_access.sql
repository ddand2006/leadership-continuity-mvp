-- Candidate and mentor workspaces use the development-intelligence RPCs too.
-- Keep the private administrator preview allowlist while allowing active
-- organization users with an assigned candidate/mentor profile to pass the
-- identity gate for their own authorized records.
create or replace function public.coaching_preview_allowed() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from auth.users
    where id = auth.uid()
      and lower(trim(email)) = 'david@cycleofbusiness.com'
  )
  or exists(
    select 1
    from organization_users u
    join profiles p on p.id = u.profile_id
    where coalesce(u.auth_user_id, p.auth_user_id) = auth.uid()
      and u.status = 'active'
      and u.deleted_at is null
      and p.deleted_at is null
      and p.role in ('candidate', 'mentor')
  );
$$;
