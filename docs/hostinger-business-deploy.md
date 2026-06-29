# Hostinger Business Deployment

Target domain: `leadercontinuity.com`

This app is a server-rendered Next.js application. It is **not** a static export, so it needs a Hostinger deployment path that supports a running Node.js app.

## What to confirm in Hostinger

In hPanel, confirm that your Business hosting plan for `leadercontinuity.com` has the Node.js / web app deployment flow enabled.

If it does, use that route.

If it does not, this app should be moved to a Hostinger VPS or another Node-capable host instead of shared static hosting.

## Runtime

- Node.js: `20.9+`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Start command: `pnpm start`

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
```

Notes:

- The app accepts either the newer Supabase publishable/secret pair or the legacy anon/service-role pair.
- `APP_URL` must match the final production domain because auth callbacks use it.
- Do not paste local-only values into the repo. Set them only in Hostinger and Supabase.

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

## Post-deploy smoke test

After the first deploy, verify:

- the About page loads on `https://leadercontinuity.com`
- auth redirects return to the production domain
- Supabase sessions persist after login
- role pages load
- candidate pages load
- mentoring pages load
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
