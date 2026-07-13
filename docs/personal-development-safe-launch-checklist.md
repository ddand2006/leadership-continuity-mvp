# Personal Development Safe Launch Checklist

Target domain: `leadercontinuity.com`

This checklist is for the first production release of Personal Development in
preview-safe mode.

## Launch Mode

Use this launch posture:

- shared Supabase login
- product gating enabled
- preview-only visibility for Personal Development
- manual pilot-organization activation

## Production Environment Variables

Set these in the production app environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
APP_URL=https://leadercontinuity.com
LCS_PAYWALL_ENABLED=true
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=
LEADERSHIP_HELP_PREVIEW_MODE=true
LEADERSHIP_HELP_PREVIEW_EMAILS=admin1@example.com,admin2@example.com
LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS=
```

Recommended defaults:

- keep `LEADERSHIP_HELP_PREVIEW_MODE=true`
- prefer `LEADERSHIP_HELP_PREVIEW_EMAILS` over org-wide preview access
- leave `LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS` blank unless you intentionally want a full pilot organization to see the module

## Deployment Order

1. Deploy branch `next` from GitHub.
2. Confirm Node app settings in Hostinger:
   - install: `pnpm install --frozen-lockfile`
   - build: `pnpm build`
   - start: `pnpm start`
3. Add the production environment variables.
4. Apply the latest Supabase migrations.
5. Confirm Supabase Auth URLs point to `https://leadercontinuity.com`.
6. Enable SSL and attach the final production domain.

## Required Migration

Make sure this migration is applied in production:

- `supabase/migrations/20260709194500_personal_development_foundation.sql`

That migration creates the Personal Development profile, role, composite,
document, and strengths tables used by the new workspace.

## Pilot Organization Activation

Before preview admins can use Personal Development, update the pilot
organization in Administration so these fields are set:

- `subscription_status=active` or `trialing`
- `leadership_help_enabled=true`
- `leadership_help_tier=organization` or your preferred label

Optional:

- `leadership_continuity_enabled=true` if the same org should also retain access
  to the main Leadership Continuity product

## Preview Admin Activation

Add preview admins by email using:

- `LEADERSHIP_HELP_PREVIEW_EMAILS`

These users should already have valid accounts in the production system.

## Smoke Test

Test with two users:

1. Preview admin in an enabled pilot organization
2. Normal non-preview user

Expected results for the preview admin:

- can sign in successfully
- sees `Personal Development` in nav
- can open `/personal-development`
- can open `/personal-development/role`
- can upload strengths files
- can generate a personal composite if OpenAI is configured

Expected results for the non-preview user:

- can sign in successfully
- does not see `Personal Development` in nav
- is blocked from direct Personal Development URLs

## Known Limitations

Current production behavior:

- Personal Development does not have a separate standalone login system
- billing checkout is not self-serve yet
- product activation is still manual through org subscription fields

This is still safe for a preview launch because auth, product gating, and
preview-only visibility are already enforced in the app.
