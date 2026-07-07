alter table public.organizations
add column if not exists leadership_continuity_enabled boolean not null default true,
add column if not exists leadership_continuity_tier text not null default 'organization',
add column if not exists leadership_help_enabled boolean not null default false,
add column if not exists leadership_help_tier text not null default 'none';

update public.organizations
set leadership_continuity_enabled = coalesce(leadership_continuity_enabled, true),
    leadership_continuity_tier = coalesce(
      nullif(leadership_continuity_tier, ''),
      subscription_tier,
      'organization'
    ),
    leadership_help_enabled = coalesce(leadership_help_enabled, false),
    leadership_help_tier = coalesce(nullif(leadership_help_tier, ''), 'none');
