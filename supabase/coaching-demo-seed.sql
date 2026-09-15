-- Development/demo use only. Fictional profiles are not seeded into production migrations.
insert into public.coach_profiles(id,display_name,headline,short_bio,icf_credential,years_coaching,years_leadership_experience,profile_status,availability_status,approved_at) values
('cc000000-0000-0000-0000-000000000001','Alex Example (Demo)','Executive transitions','Fictional demonstration profile.','acc',5,12,'approved','available',now()),
('cc000000-0000-0000-0000-000000000002','Jordan Sample (Demo)','Leadership development','Fictional demonstration profile.','pcc',12,20,'approved','limited',now()),
('cc000000-0000-0000-0000-000000000003','Morgan Fiction (Demo)','Succession readiness','Fictional demonstration profile.','mcc',20,25,'approved','available',now()),
('cc000000-0000-0000-0000-000000000004','Casey Example (Demo)','Team leadership','Fictional demonstration profile.','pcc',10,15,'approved','unavailable',now()),
('cc000000-0000-0000-0000-000000000005','Taylor Sample (Demo)','Emerging leaders','Fictional demonstration profile.','acc',3,8,'pending_review','available',null)
on conflict(id) do nothing;
insert into public.coach_specialties(coach_id,specialty_id) select c.id,s.id from public.coach_profiles c cross join public.coaching_specialties s where c.id::text like 'cc000000-%' on conflict do nothing;
insert into public.coach_industries(coach_id,industry_id) select c.id,s.id from public.coach_profiles c cross join public.industries s where c.id::text like 'cc000000-%' on conflict do nothing;
insert into public.coach_leadership_levels(coach_id,leadership_level_id) select c.id,s.id from public.coach_profiles c cross join public.leadership_levels s where c.id::text like 'cc000000-%' on conflict do nothing;
