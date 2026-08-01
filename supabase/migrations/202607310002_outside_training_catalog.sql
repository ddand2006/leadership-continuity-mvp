create table public.training_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  website_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id uuid not null references public.training_providers(id) on delete restrict,
  name text not null,
  description text not null,
  website_url text,
  delivery_formats jsonb not null default '[]'::jsonb,
  audience_levels jsonb not null default '[]'::jsonb,
  typical_duration text,
  cost_range text,
  industry_focus text,
  internal_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- Role competencies are organization- and role-specific. This mapping stores the
-- canonical competency name rather than creating a duplicate global competency table.
create table public.training_program_competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  training_program_id uuid not null references public.training_programs(id) on delete cascade,
  competency_name text not null,
  match_strength text not null check (match_strength in ('strong', 'moderate', 'supporting')),
  relationship_type text not null default 'primary' check (relationship_type in ('primary', 'secondary')),
  match_explanation text not null,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_program_id, competency_name)
);

create index training_programs_organization_active_idx
  on public.training_programs (organization_id, is_active);
create index training_program_competencies_name_idx
  on public.training_program_competencies (organization_id, competency_name);

create trigger set_updated_at_training_providers before update on public.training_providers
for each row execute function public.set_updated_at();
create trigger set_updated_at_training_programs before update on public.training_programs
for each row execute function public.set_updated_at();
create trigger set_updated_at_training_program_competencies before update on public.training_program_competencies
for each row execute function public.set_updated_at();

alter table public.training_providers enable row level security;
alter table public.training_programs enable row level security;
alter table public.training_program_competencies enable row level security;

create policy "organization members can manage training providers" on public.training_providers
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
create policy "organization members can manage training programs" on public.training_programs
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());
create policy "organization members can manage training program competencies" on public.training_program_competencies
for all using (organization_id = public.current_profile_organization_id())
with check (organization_id = public.current_profile_organization_id());

with provider_seed(name, website_url, description) as (
  values
    ('FranklinCovey', 'https://www.franklincovey.com/', 'Leadership, trust, and personal-effectiveness learning.'),
    ('The Ken Blanchard Companies', 'https://www.kenblanchard.com/', 'Manager development, coaching, and situational leadership.'),
    ('Crucial Learning', 'https://cruciallearning.com/', 'Communication, accountability, and high-stakes conversation learning.'),
    ('Leadership Challenge / Wiley', 'https://www.leadershipchallenge.com/', 'Evidence-based leadership development programs.')
)
insert into public.training_providers (organization_id, name, website_url, description)
select organization.id, seed.name, seed.website_url, seed.description
from public.organizations organization cross join provider_seed seed;

with program_seed(provider_name, name, description, website_url, delivery_formats, audience_levels, typical_duration, internal_notes) as (
  values
    ('FranklinCovey', 'The 7 Habits of Highly Effective People', 'A leadership and personal-effectiveness program centered on trust, execution, collaboration, and intentional habits.', 'https://www.franklincovey.com/the-7-habits/', '["In person","Virtual live","Cohort"]'::jsonb, '["Emerging leader","Frontline manager","Mid-level leader","Senior executive"]'::jsonb, 'Flexible multi-session program', 'Preliminary program information — not a formal endorsement.'),
    ('The Ken Blanchard Companies', 'Situational Leadership', 'A practical manager-development program for adapting leadership style, coaching people, and improving performance conversations.', 'https://www.kenblanchard.com/', '["In person","Virtual live","Cohort"]'::jsonb, '["Frontline manager","Mid-level leader"]'::jsonb, 'Half-day to multi-session program', 'Preliminary program information — not a formal endorsement.'),
    ('Crucial Learning', 'Crucial Conversations', 'A communication program for candid, respectful dialogue when the stakes are high and perspectives differ.', 'https://cruciallearning.com/', '["In person","Virtual live","Self-paced"]'::jsonb, '["Frontline manager","Mid-level leader","Senior executive","Mentor"]'::jsonb, 'One to two days', 'Preliminary program information — not a formal endorsement.'),
    ('Leadership Challenge / Wiley', 'The Leadership Challenge', 'An evidence-based leadership program that helps leaders model values, inspire a shared vision, challenge processes, and enable others.', 'https://www.leadershipchallenge.com/', '["In person","Virtual live","Cohort"]'::jsonb, '["Emerging leader","Frontline manager","Mid-level leader","Senior executive"]'::jsonb, 'Multi-session program', 'Preliminary program information — not a formal endorsement.'),
    ('FranklinCovey', 'The Speed of Trust', 'A trust-centered program that links credibility and behavior to collaboration, execution, and organizational culture.', 'https://www.franklincovey.com/the-speed-of-trust/', '["In person","Virtual live","Cohort"]'::jsonb, '["Frontline manager","Mid-level leader","Senior executive"]'::jsonb, 'One day or multi-session program', 'Preliminary program information — not a formal endorsement.')
)
insert into public.training_programs (organization_id, provider_id, name, description, website_url, delivery_formats, audience_levels, typical_duration, internal_notes)
select provider.organization_id, provider.id, seed.name, seed.description, seed.website_url, seed.delivery_formats, seed.audience_levels, seed.typical_duration, seed.internal_notes
from public.training_providers provider join program_seed seed on seed.provider_name = provider.name;

with mapping_seed(program_name, competency_name, match_strength, relationship_type, match_explanation) as (
  values
    ('The 7 Habits of Highly Effective People','Relational Leadership','strong','primary','Builds trust, collaboration, and relationship-centered leadership habits.'),
    ('The 7 Habits of Highly Effective People','Accountability','strong','primary','Reinforces personal responsibility and disciplined execution.'),
    ('The 7 Habits of Highly Effective People','Emotional Intelligence','moderate','secondary','Supports self-awareness and constructive work with others.'),
    ('The 7 Habits of Highly Effective People','People Development','moderate','secondary','Supports self-awareness and constructive work with others.'),
    ('Situational Leadership','People Development','strong','primary','Focuses on adapting coaching and direction to individual readiness.'),
    ('Situational Leadership','Coaching','strong','primary','Focuses on adapting coaching and direction to individual readiness.'),
    ('Situational Leadership','Relational Leadership','moderate','secondary','Strengthens manager conversations, expectations, and follow-through.'),
    ('Situational Leadership','Accountability','moderate','secondary','Strengthens manager conversations, expectations, and follow-through.'),
    ('Crucial Conversations','Communication','strong','primary','Develops direct communication, accountability, and skill in difficult conversations.'),
    ('Crucial Conversations','Conflict Management','strong','primary','Develops direct communication, accountability, and skill in difficult conversations.'),
    ('Crucial Conversations','Accountability','strong','primary','Develops direct communication, accountability, and skill in difficult conversations.'),
    ('Crucial Conversations','Relational Leadership','moderate','secondary','Supports trust and emotional regulation during high-stakes dialogue.'),
    ('Crucial Conversations','Emotional Intelligence','moderate','secondary','Supports trust and emotional regulation during high-stakes dialogue.'),
    ('The Leadership Challenge','Leadership','strong','primary','Addresses core leadership practices, enabling others, and relationship-based leadership.'),
    ('The Leadership Challenge','People Development','strong','primary','Addresses core leadership practices, enabling others, and relationship-based leadership.'),
    ('The Leadership Challenge','Relational Leadership','strong','primary','Addresses core leadership practices, enabling others, and relationship-based leadership.'),
    ('The Leadership Challenge','Strategic Thinking','moderate','secondary','Supports vision-setting, challenge, and follow-through.'),
    ('The Leadership Challenge','Accountability','moderate','secondary','Supports vision-setting, challenge, and follow-through.'),
    ('The Speed of Trust','Trust','strong','primary','Builds credible, trust-based relationships and a healthier organizational culture.'),
    ('The Speed of Trust','Relational Leadership','strong','primary','Builds credible, trust-based relationships and a healthier organizational culture.'),
    ('The Speed of Trust','Organizational Culture','strong','primary','Builds credible, trust-based relationships and a healthier organizational culture.'),
    ('The Speed of Trust','Communication','moderate','secondary','Connects clear communication and accountable behavior to trust.'),
    ('The Speed of Trust','Accountability','moderate','secondary','Connects clear communication and accountable behavior to trust.')
)
insert into public.training_program_competencies (organization_id, training_program_id, competency_name, match_strength, relationship_type, match_explanation)
select program.organization_id, program.id, seed.competency_name, seed.match_strength, seed.relationship_type, seed.match_explanation
from public.training_programs program join mapping_seed seed on seed.program_name = program.name;
