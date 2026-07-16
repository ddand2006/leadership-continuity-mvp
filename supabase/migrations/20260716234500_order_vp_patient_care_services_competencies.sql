update public.role_competencies
set created_at = ordering.created_at,
    updated_at = ordering.created_at
from (
  select
    rc.id,
    base.base_created_at + make_interval(secs => base.sort_order) as created_at
  from public.role_competencies rc
  join public.roles r
    on r.id = rc.role_id
  join lateral (
    select min(existing.created_at) as base_created_at
    from public.role_competencies existing
    where existing.role_id = rc.role_id
  ) baseline
    on true
  join lateral (
    select
      baseline.base_created_at,
      case rc.name
        when 'Relational Leadership' then 0
        when 'Accountability' then 1
        when 'Systems Thinking' then 2
        when 'Emotional Intelligence' then 3
        when 'People Development' then 4
        when 'Stewardship' then 5
        when 'Technical Competence' then 6
        else 999
      end as sort_order
  ) base
    on true
  where lower(trim(translate(r.title, '‐‑‒–—−', '------'))) = 'vp - patient care services'
    and rc.name in (
      'Relational Leadership',
      'Accountability',
      'Systems Thinking',
      'Emotional Intelligence',
      'People Development',
      'Stewardship',
      'Technical Competence'
    )
) as ordering
where public.role_competencies.id = ordering.id;
