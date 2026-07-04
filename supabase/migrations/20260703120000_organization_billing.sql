alter table public.organizations
add column if not exists subscription_status text not null default 'trialing',
add column if not exists subscription_tier text not null default 'organization',
add column if not exists trial_ends_at timestamptz,
add column if not exists billing_contact_email text;

update public.organizations
set trial_ends_at = coalesce(trial_ends_at, created_at + interval '14 days');

alter table public.organizations
add constraint organizations_subscription_status_check
check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));
