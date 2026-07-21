create table if not exists public.master_role_competency_templates (
  id uuid primary key default gen_random_uuid(),
  industry text,
  role_title text not null,
  normalized_role_title text not null,
  role_family text,
  default_department text,
  description text,
  talents text[] not null default '{}',
  skills text[] not null default '{}',
  behaviors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists master_role_competency_templates_unique_idx
on public.master_role_competency_templates (
  coalesce(lower(trim(industry)), ''),
  normalized_role_title
);

create index if not exists master_role_competency_templates_industry_idx
on public.master_role_competency_templates (industry, role_title);

create trigger set_updated_at_master_role_competency_templates
before update on public.master_role_competency_templates
for each row execute function public.set_updated_at();

alter table public.master_role_competency_templates enable row level security;

drop policy if exists "authenticated users can read master role competency templates"
on public.master_role_competency_templates;

create policy "authenticated users can read master role competency templates"
on public.master_role_competency_templates
for select
using (auth.role() = 'authenticated');

insert into public.master_role_competency_templates (
  industry,
  role_title,
  normalized_role_title,
  role_family,
  default_department,
  description,
  talents,
  skills,
  behaviors
)
values
  (
    'Healthcare',
    'CEO',
    'ceo',
    'Executive Leadership',
    'Administration',
    'Leads the enterprise, aligns mission and performance, and builds executive accountability across the organization.',
    '{"Enterprise thinker","Decisive under pressure","Relationship builder"}',
    '{"Strategic planning","Board communication","Culture stewardship"}',
    '{"Sets system-wide direction clearly","Makes high-stakes decisions with accountability","Builds trust across clinical and business leaders"}'
  ),
  (
    'Healthcare',
    'CFO',
    'cfo',
    'Executive Leadership',
    'Finance',
    'Guides financial stewardship, capital planning, and enterprise decision-making with operational credibility.',
    '{"Analytical thinker","Steady under scrutiny","Long-range planner"}',
    '{"Financial strategy","Capital planning","Executive communication"}',
    '{"Translates financial risk into operational decisions","Balances mission with margin discipline","Builds confidence through data-backed recommendations"}'
  ),
  (
    'Healthcare',
    'COO',
    'coo',
    'Executive Leadership',
    'Operations',
    'Coordinates operational execution across departments and turns strategic goals into measurable daily performance.',
    '{"Systems thinker","Execution focused","Cross-functional organizer"}',
    '{"Operational planning","Performance management","Change leadership"}',
    '{"Clarifies owners and expectations across departments","Resets broken workflows without delay","Leads accountability conversations with peers directly"}'
  ),
  (
    'Healthcare',
    'Chief Nursing Officer',
    'chief nursing officer',
    'Clinical Leadership',
    'Nursing',
    'Leads nursing practice, patient care standards, and workforce readiness across the clinical enterprise.',
    '{"Clinical judgment","People developer","Calm presence"}',
    '{"Nursing operations","Quality leadership","Leader coaching"}',
    '{"Sets clear expectations for nursing leaders","Addresses patient care breakdowns with urgency","Builds capability through direct coaching and follow-through"}'
  ),
  (
    'Healthcare',
    'VP - Patient Care Services',
    'vp - patient care services',
    'Clinical Leadership',
    'Patient Care Services',
    'Leads patient care delivery across service lines and ensures cross-departmental accountability for patient outcomes.',
    '{"Influences across boundaries","Operationally aware","Mission anchored"}',
    '{"Cross-functional leadership","Patient flow improvement","Escalation management"}',
    '{"Names recurring care-delay patterns directly","Drives shared ownership across departments","Balances empathy with executive accountability"}'
  ),
  (
    'Healthcare',
    'Leadership Intern',
    'leadership intern',
    'Emerging Leader',
    'Administration',
    'Builds early leadership readiness through exposure to operations, communication, and structured stretch work.',
    '{"Curious learner","Adaptable contributor","Relationship oriented"}',
    '{"Professional communication","Project coordination","Problem solving"}',
    '{"Asks thoughtful questions and follows through","Connects daily work to larger organizational goals","Responds to feedback with visible improvement"}'
  ),
  (
    null,
    'Director of Operations',
    'director of operations',
    'Operations Leadership',
    'Operations',
    'Leads daily execution, process reliability, and team coordination while translating strategy into repeatable results.',
    '{"Process minded","Resourceful arranger","Outcome oriented"}',
    '{"Project management","Team leadership","Operational problem solving"}',
    '{"Creates clear operating rhythm for the team","Escalates barriers before they become chronic","Improves workflows with measurable follow-through"}'
  ),
  (
    null,
    'Human Resources Director',
    'human resources director',
    'People Leadership',
    'Human Resources',
    'Leads people systems, talent decisions, and culture practices that strengthen workforce performance and trust.',
    '{"Trusted advisor","Discerning listener","Balanced decision maker"}',
    '{"Talent management","Conflict resolution","Policy leadership"}',
    '{"Holds fairness and accountability together","Guides difficult people decisions with clarity","Builds credibility through steady follow-through"}'
  ),
  (
    null,
    'CFO',
    'cfo',
    'Executive Leadership',
    'Finance',
    'Leads financial discipline, planning, and risk management while helping the organization make confident strategic decisions.',
    '{"Analytical thinker","Judgment oriented","Composed under pressure"}',
    '{"Financial forecasting","Executive reporting","Risk assessment"}',
    '{"Frames decisions with financial clarity","Communicates tradeoffs in plain language","Protects long-term stability without slowing action unnecessarily"}'
  ),
  (
    null,
    'CEO',
    'ceo',
    'Executive Leadership',
    'Administration',
    'Provides enterprise direction, aligns leadership teams, and carries responsibility for long-term organizational performance.',
    '{"Vision oriented","Enterprise connector","Resilient decision maker"}',
    '{"Strategic leadership","Stakeholder communication","Culture building"}',
    '{"Sets direction that others can repeat clearly","Makes decisions that balance people, mission, and results","Develops the next generation of leaders intentionally"}'
  )
on conflict do nothing;
