-- Install the private gate before any coaching tables or RPCs become available.
begin;
create or replace function public.coaching_preview_allowed() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users where id=auth.uid() and lower(trim(email))='david@cycleofbusiness.com')
$$;
revoke all on function public.coaching_preview_allowed() from public,anon;
grant execute on function public.coaching_preview_allowed() to authenticated;
commit;
