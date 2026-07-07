create table if not exists public.coaching_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  challenge_area text not null check (
    challenge_area in (
      'team_conflict',
      'retention',
      'delegation',
      'communication',
      'burnout',
      'accountability',
      'culture_change',
      'change_management',
      'physician_alignment',
      'strategic_priorities',
      'performance',
      'other'
    )
  ),
  challenge_title text not null,
  challenge_summary text not null,
  organizational_context text,
  desired_outcome text,
  urgency text not null check (urgency in ('low', 'medium', 'high')),
  support_path text not null check (
    support_path in ('ai_guidance', 'coach_request', 'both')
  ),
  status text not null default 'new' check (
    status in (
      'new',
      'ai_guidance_ready',
      'coach_requested',
      'in_review',
      'coach_matched',
      'closed'
    )
  ),
  ai_guidance jsonb not null default '{}'::jsonb,
  ai_generated_at timestamptz,
  assigned_coach_name text,
  internal_notes text,
  last_reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists coaching_requests_org_created_idx
  on public.coaching_requests (organization_id, created_at desc);

create index if not exists coaching_requests_requester_idx
  on public.coaching_requests (requester_profile_id, created_at desc);

create index if not exists coaching_requests_status_idx
  on public.coaching_requests (status, created_at desc);

create trigger set_updated_at_coaching_requests
before update on public.coaching_requests
for each row execute function public.set_updated_at();

alter table public.coaching_requests enable row level security;

drop policy if exists "coaching_requests_select" on public.coaching_requests;
create policy "coaching_requests_select"
  on public.coaching_requests
  for select
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and (
      requester_profile_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
    )
  );

drop policy if exists "coaching_requests_insert" on public.coaching_requests;
create policy "coaching_requests_insert"
  on public.coaching_requests
  for insert
  to authenticated
  with check (
    organization_id = public.current_profile_organization_id()
    and requester_profile_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
  );

drop policy if exists "coaching_requests_update" on public.coaching_requests;
create policy "coaching_requests_update"
  on public.coaching_requests
  for update
  to authenticated
  using (
    organization_id = public.current_profile_organization_id()
    and (
      requester_profile_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
    )
  )
  with check (
    organization_id = public.current_profile_organization_id()
    and (
      requester_profile_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
      or public.current_app_role() in ('system_admin', 'hospital_admin', 'mentor')
    )
  );
