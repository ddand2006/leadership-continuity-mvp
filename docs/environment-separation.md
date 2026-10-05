# Local and production environment separation

The local app and the live app must use different environment values. The code already reads `.env.local` when running `pnpm dev`; Hostinger supplies a separate production environment during deployment.

## Local development

Keep local Supabase values in the untracked file `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
SUPABASE_SERVICE_ROLE_KEY=<local service-role key or compatible local secret>
SUPABASE_JWT_SECRET=<local legacy JWT secret when required>
APP_URL=http://localhost:3000
```

Never use these local values in Hostinger.

## Production

Set these in Hostinger's Node.js application environment, not in the repository:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<production-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable or anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service-role key>
SUPABASE_SECRET_KEY=<production secret key when applicable>
APP_URL=https://leadercontinuity.com
```

After changing Hostinger variables, restart or redeploy the application. Client-side `NEXT_PUBLIC_*` values are embedded during the build, so a restart alone may not be enough if the platform builds before starting.

## Switching safely

1. For local work, edit only `.env.local` and run `pnpm dev`.
2. For live work, edit only Hostinger environment variables and redeploy.
3. Never copy `.env.local` into Git or Hostinger.
4. If production shows `Failed to fetch`, first check that its Supabase URL does not contain `127.0.0.1` or `localhost`.
