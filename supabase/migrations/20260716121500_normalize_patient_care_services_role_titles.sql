update public.roles
set title = 'VP - Patient Care Services'
where lower(trim(title)) in (
  'assistant administrator of patient care services',
  'assistant administrator of patient care services (aapcs)',
  'aapcs',
  'vp patient care services',
  'vp - patient care services',
  'vp patient care services / cno',
  'vp patient care services/cno'
);

update public.personal_role_profiles
set title = 'VP - Patient Care Services'
where lower(trim(title)) in (
  'assistant administrator of patient care services',
  'assistant administrator of patient care services (aapcs)',
  'aapcs',
  'vp patient care services',
  'vp - patient care services',
  'vp patient care services / cno',
  'vp patient care services/cno'
);
