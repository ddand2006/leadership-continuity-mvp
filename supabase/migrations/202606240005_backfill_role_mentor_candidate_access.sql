insert into public.mentor_role_assignments (
  organization_id,
  candidate_id,
  role_id,
  mentor_profile_id,
  status
)
select distinct
  considerations.organization_id,
  considerations.candidate_id,
  considerations.role_id,
  role_assignments.mentor_profile_id,
  'active'
from public.candidate_role_considerations as considerations
inner join public.role_mentor_assignments as role_assignments
  on role_assignments.organization_id = considerations.organization_id
 and role_assignments.role_id = considerations.role_id
where role_assignments.status = 'active'
on conflict (candidate_id, role_id, mentor_profile_id) do nothing;
