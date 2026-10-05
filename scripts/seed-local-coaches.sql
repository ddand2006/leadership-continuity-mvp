-- Local-only coaching marketplace fixtures. No auth users or organization
-- memberships are created; these profiles exercise directory/approval states.
delete from public.coach_profiles
where email in ('jordan.avery.coach@example.test', 'riley.morgan.coach@example.test');

insert into public.coach_profiles (
  display_name, email, headline, short_bio, full_bio, city, state_region,
  country, timezone, years_coaching, years_leadership_experience,
  coaching_philosophy, languages, icf_credential, credential_verification_status,
  virtual_available, in_person_available, accepting_clients, availability_status,
  max_active_clients, profile_status, approved_at
)
values
(
  'Jordan Avery', 'jordan.avery.coach@example.test',
  'Executive and succession coach',
  'Supports high-performing leaders through role transitions and succession readiness.',
  'A local test coach profile for verifying approved marketplace discovery and organization-controlled coaching access.',
  'Denver', 'Colorado', 'United States', 'America/Denver', 12, 9,
  'Clear goals, practical experiments, and reflective accountability.',
  array['English'], 'pcc', 'verified', true, false, true, 'available', 6,
  'approved', now()
)
;
update public.coach_profiles set
  display_name = 'Jordan Avery', profile_status = 'approved', accepting_clients = true,
  availability_status = 'available', approved_at = coalesce(approved_at, now()), updated_at = now()
where email = 'jordan.avery.coach@example.test';

insert into public.coach_profiles (
  display_name, email, headline, short_bio, full_bio, city, state_region,
  country, timezone, years_coaching, years_leadership_experience,
  coaching_philosophy, languages, icf_credential, credential_verification_status,
  virtual_available, in_person_available, accepting_clients, availability_status,
  max_active_clients, profile_status
)
values (
  'Riley Morgan', 'riley.morgan.coach@example.test',
  'Leadership development coach',
  'Helps leaders turn feedback into focused development plans.',
  'A local test coach profile for verifying pending review and budget/approval gating.',
  'Austin', 'Texas', 'United States', 'America/Chicago', 7, 11,
  'Curious questions, structured reflection, and small observable commitments.',
  array['English', 'Spanish'], 'acc', 'pending', true, true, false, 'limited', 3,
  'pending_review'
)
;
update public.coach_profiles set
  display_name = 'Riley Morgan', profile_status = 'pending_review', accepting_clients = false,
  availability_status = 'limited', updated_at = now()
where email = 'riley.morgan.coach@example.test';
