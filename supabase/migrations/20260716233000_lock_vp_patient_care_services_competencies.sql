update public.roles
set title = 'VP - Patient Care Services'
where lower(trim(translate(title, '‐‑‒–—−', '------'))) in (
  'vp - patient care services',
  'vp patient care services',
  'assistant administrator of patient care services',
  'assistant administrator of patient care services (aapcs)',
  'aapcs',
  'vp patient care services / cno',
  'vp patient care services/cno'
);

update public.personal_role_profiles
set title = 'VP - Patient Care Services'
where lower(trim(translate(title, '‐‑‒–—−', '------'))) in (
  'vp - patient care services',
  'vp patient care services',
  'assistant administrator of patient care services',
  'assistant administrator of patient care services (aapcs)',
  'aapcs',
  'vp patient care services / cno',
  'vp patient care services/cno'
);

create temporary table tmp_locked_vp_roles
on commit drop
as
select r.id, r.organization_id
from public.roles r
join public.role_competencies rc
  on rc.role_id = r.id
where lower(trim(translate(r.title, '‐‑‒–—−', '------'))) = 'vp - patient care services'
group by r.id, r.organization_id
having count(*) = 6
  and count(*) filter (
    where rc.name in (
      'Relational and Emotionally Intelligent Leadership',
      'Accountability and Standards Enforcement',
      'Quality, Patient Safety, and Regulatory Readiness',
      'Systems Thinking and Strategic Alignment',
      'Workforce Leadership and People Development',
      'Operational and Financial Collaboration'
    )
  ) = 6
  and not exists (
    select 1
    from public.role_competencies existing_competency
    join public.interview_scores interview_score
      on interview_score.competency_id = existing_competency.id
    where existing_competency.role_id = r.id
  )
  and not exists (
    select 1
    from public.role_competencies existing_competency
    join public.candidate_role_strength_assessments assessment
      on assessment.competency_id = existing_competency.id
    where existing_competency.role_id = r.id
  );

delete from public.role_interview_scorecards
where role_id in (select id from tmp_locked_vp_roles);

delete from public.mentor_reports
where role_id in (select id from tmp_locked_vp_roles);

delete from public.role_composite_documents
where role_id in (select id from tmp_locked_vp_roles)
  and document_source = 'generated';

delete from public.role_competencies
where role_id in (select id from tmp_locked_vp_roles);

insert into public.role_competencies (
  organization_id,
  role_id,
  name,
  definition,
  weight,
  target_score,
  behavioral_indicators,
  red_flags
)
select
  target_role.organization_id,
  target_role.id,
  competency.name,
  competency.definition,
  competency.weight,
  competency.target_score,
  competency.behavioral_indicators,
  competency.red_flags
from tmp_locked_vp_roles as target_role
cross join (
  values
    (
      'Relational Leadership',
      'Builds trust across clinical and operational relationships through visible presence, clear communication, and steady leadership in difficult situations.',
      1::numeric,
      4::numeric,
      '["Builds trust with nurses, providers, and cross-functional leaders","Addresses difficult performance or culture issues directly and respectfully","Repairs strained relationships without avoiding accountability"]'::jsonb,
      '["Avoids hard relational conversations","Allows mistrust or siloed behavior to persist","Responds defensively when relationships become strained"]'::jsonb
    ),
    (
      'Accountability',
      'Owns outcomes, sets clear standards, and responds to performance gaps with responsibility, follow-through, and corrective action.',
      1::numeric,
      4::numeric,
      '["Takes ownership when results fall short","Sets clear expectations and follows through on commitments","Learns visibly from decisions that did not work"]'::jsonb,
      '["Blames external factors instead of taking responsibility","Lets standards drift without intervention","Fails to close the loop after identifying a problem"]'::jsonb
    ),
    (
      'Systems Thinking',
      'Sees how decisions affect finance, quality, staffing, and operations across the broader organization and adjusts plans accordingly.',
      1::numeric,
      4::numeric,
      '["Anticipates downstream consequences across departments","Connects operational decisions to quality and financial impact","Partners cross-functionally to solve enterprise-level problems"]'::jsonb,
      '["Optimizes one area while creating problems in another","Misses downstream operational or financial consequences","Works too narrowly within department lines"]'::jsonb
    ),
    (
      'Emotional Intelligence',
      'Demonstrates self-awareness, composure, empathy, and emotional steadiness under pressure while leading others through tense situations.',
      1::numeric,
      4::numeric,
      '["Stays composed during high-pressure situations","Reads team dynamics accurately and adjusts approach","De-escalates conflict without losing clarity or standards"]'::jsonb,
      '["Escalates tension through reactivity or defensiveness","Misreads how others are experiencing the situation","Loses composure when challenged"]'::jsonb
    ),
    (
      'People Development',
      'Builds leadership depth by identifying talent early, coaching intentionally, and developing staff into stronger contributors and future leaders.',
      1::numeric,
      4::numeric,
      '["Spots high-potential staff and invests in their growth","Coaches under-performers with clarity and follow-through","Develops others into larger leadership responsibilities"]'::jsonb,
      '["Keeps development informal or inconsistent","Avoids direct coaching of under-performance","Fails to create a visible leadership pipeline"]'::jsonb
    ),
    (
      'Stewardship',
      'Protects the mission, culture, and long-term health of patient care services through principled decision-making and courage under pressure.',
      1::numeric,
      4::numeric,
      '["Makes decisions that protect culture and quality over convenience","Understands how nursing culture influences patient outcomes","Acts as a faithful steward of the VP-PCS role and its broader responsibility"]'::jsonb,
      '["Compromises standards to avoid conflict","Treats the role too narrowly or transactionally","Fails to connect culture to patient care outcomes"]'::jsonb
    ),
    (
      'Technical Competence',
      'Leads patient care services with credible command of quality systems, regulatory readiness, staffing models, and financial fundamentals.',
      1::numeric,
      4::numeric,
      '["Leads quality and patient safety systems with confidence","Maintains readiness for CMS, Joint Commission, and other regulatory expectations","Manages staffing, labor, and budgeting decisions with sound judgment"]'::jsonb,
      '["Shows limited command of quality or regulatory systems","Cannot explain staffing or labor decisions clearly","Lacks practical financial understanding for the role"]'::jsonb
    )
) as competency(
  name,
  definition,
  weight,
  target_score,
  behavioral_indicators,
  red_flags
);
