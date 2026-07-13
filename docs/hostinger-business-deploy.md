# Hostinger Business Deployment

Target domain: `leadercontinuity.com`

This app is a server-rendered Next.js application. It is **not** a static export, so it needs a Hostinger deployment path that supports a running Node.js app.

## What to confirm in Hostinger

In hPanel, confirm that your Business hosting plan for `leadercontinuity.com` has the Node.js / web app deployment flow enabled.

If it does, use that route.

If it does not, this app should be moved to a Hostinger VPS or another Node-capable host instead of shared static hosting.

## Runtime

- Node.js: `20.9+`
- pnpm: `10.33.0` via the `packageManager` field in `package.json`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Start command: `pnpm start`

If Hostinger falls back to a newer Corepack-managed `pnpm` release and the install step crashes before the app builds, confirm the project is deploying with the pinned `packageManager` value from `package.json` instead of Hostinger's default.

## npm fallback for Hostinger

If Hostinger still fails during the `pnpm` install step with a Corepack or dynamic-import error, switch the Hostinger package manager to `npm` and use:

- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`

This repository includes a committed `package-lock.json` specifically for that fallback path.

## Required environment variables

Set these in the Hostinger app environment for production:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
APP_URL=https://leadercontinuity.com
OPENAI_MODEL=gpt-5.5
LCS_PAYWALL_ENABLED=true
LEADERSHIP_HELP_PREVIEW_MODE=true
LEADERSHIP_HELP_PREVIEW_EMAILS=
LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS=
```

Notes:

- The app accepts either the newer Supabase publishable/secret pair or the legacy anon/service-role pair.
- `APP_URL` must match the final production domain because auth callbacks use it.
- `LCS_PAYWALL_ENABLED=true` is required if you want Personal Development and Leadership Continuity to respect product access instead of defaulting open.
- `LEADERSHIP_HELP_PREVIEW_MODE=true` is the recommended safe-launch setting for Personal Development right now.
- Use `LEADERSHIP_HELP_PREVIEW_EMAILS` to allow selected preview admins by email. Use `LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS` only if you want to allow a full pilot organization.
- Do not paste local-only values into the repo. Set them only in Hostinger and Supabase.

## Safe Launch Recommendation

Recommended first production launch for Personal Development:

- keep `LCS_PAYWALL_ENABLED=true`
- keep `LEADERSHIP_HELP_PREVIEW_MODE=true`
- allow only selected preview admins through `LEADERSHIP_HELP_PREVIEW_EMAILS`
- set `leadership_help_enabled=true` only for the pilot organization records you want active

This gives you:

- normal shared login through Supabase Auth
- separate product gating for Personal Development
- preview-only visibility for selected admins
- manual control over which organizations can open the module

This does **not** yet give you:

- a separate standalone login system for Personal Development
- self-serve billing checkout
- automatic subscription provisioning after payment

## Manual Product Activation

Billing checkout is still manual in this MVP.

To activate Personal Development for a pilot organization before self-serve billing exists:

1. Sign in as a `system_admin`.
2. Open the Administration workspace.
3. Update the target organization so these fields are set:
   - `subscription_status=active` or `trialing`
   - `leadership_help_enabled=true`
   - `leadership_help_tier` to the tier label you want to show
4. Leave `leadership_continuity_enabled` set according to whether that organization should also have the main product.

Those updates are handled through the organization admin API in `src/app/api/admin/organizations/route.ts`.

## Supabase production setup

In Supabase Auth settings, update:

- Site URL:
  - `https://leadercontinuity.com`

- Redirect URLs:
  - `https://leadercontinuity.com/auth/callback`
  - `https://www.leadercontinuity.com/auth/callback`
  - `https://leadercontinuity.com`
  - `https://www.leadercontinuity.com`

If you plan to force either `www` or apex only, keep the one you actually use and redirect the other at the DNS or Hostinger level.

## Domain and SSL

Make sure `leadercontinuity.com` is attached to the deployed Node.js app and SSL is enabled before testing login or email confirmation.

## GitHub-based deployment flow

Recommended deployment sequence:

1. Push the latest code to GitHub.
2. In Hostinger hPanel, create or open the Node.js / web app for `leadercontinuity.com`.
3. Connect the GitHub repository:
   - `ddand2006/leadership-continuity-mvp`
4. Set the branch you want to deploy.
5. Set the runtime and commands:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm build`
   - Start: `pnpm start`
6. Add the production environment variables.
7. Trigger the first deployment.
8. Attach the domain and enable SSL.
9. Test:
   - home page
   - sign in
   - sign up email confirmation
   - dashboard
   - roles
   - candidates
   - mentoring
   - Personal Development as an allowlisted preview admin
   - Personal Development denied for a normal non-preview user

## Post-deploy smoke test

After the first deploy, verify:

- the About page loads on `https://leadercontinuity.com`
- auth redirects return to the production domain
- Supabase sessions persist after login
- role pages load
- candidate pages load
- mentoring pages load
- Personal Development opens only for preview admins in enabled pilot organizations
- non-preview users do not see the Personal Development nav item and are blocked from direct URLs
- OpenAI-backed actions work with the production key

## Known app behavior relevant to deployment

- The app uses dynamic server rendering and API routes.
- The app relies on Supabase server-side auth helpers.
- The app relies on OpenAI for several generation workflows.
- The app builds successfully in production mode.

## If Hostinger Business does not expose Node.js app hosting

Do **not** try to force this into plain static hosting.

Use one of these instead:

- Hostinger VPS
- another Node-capable app host

This is the right fallback because the app needs a live Node server for App Router routes, auth callbacks, and API endpoints.
