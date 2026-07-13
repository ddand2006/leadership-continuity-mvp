# Leadership Continuity System MVP

Standalone application for organization-wide succession planning, mentoring, strengths-based development, and leadership readiness reporting.

This codebase is intentionally separate from `jobbora-platform`. It has its own frontend, its own database design, and should live in its own GitHub repository and deployment pipeline.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + Row Level Security
- OpenAI API for structured JSON report generation

## Included Foundation

- standalone git repository scaffold
- project-specific landing page
- environment variable example
- Supabase browser/server client helpers
- initial SQL migration for the leadership continuity schema

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
LCS_PAYWALL_ENABLED=false
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=
LEADERSHIP_HELP_PREVIEW_MODE=false
LEADERSHIP_HELP_PREVIEW_EMAILS=
LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS=
```

You can use either the current publishable/secret keys or the legacy anon/service-role keys. The app will accept both so it can connect cleanly to newer Supabase projects.

To send role survey invitations through Resend, also add:

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL=surveys@your-subdomain.example.com
RESEND_FROM_NAME=Leadership Continuity System
```

Use a verified Resend sending subdomain rather than your main mailbox identity.

When `LEADERSHIP_HELP_PREVIEW_MODE=true`, Personal Development is hidden from everyone except `system_admin` plus any allowlisted preview admins. Use `LEADERSHIP_HELP_PREVIEW_EMAILS` for specific admin emails and `LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS` if you want to allow a full pilot organization.

When `LCS_PAYWALL_ENABLED=true`, Leadership Continuity and Personal Development both enforce organization product access from the subscription columns on `organizations`. Billing checkout is not wired yet, so product access is still activated manually through the administration flow or direct database updates.

## Local Development

```bash
pnpm install
pnpm dev
```

## Database Setup

1. Create a new Supabase project for this app.
2. Add your project URL and keys to `.env.local`.
3. Apply the SQL in `supabase/migrations/202606220001_initial_schema.sql`.
4. Generate typed database types later once the remote project exists.

## Auth Foundation Included

- Next.js 16 `proxy.ts` session refresh hook for Supabase SSR
- email/password sign-up and sign-in server actions
- auth callback route for Supabase email confirmations
- protected dashboard route that checks claims on the server

## Useful Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm db:push
```

## Recommended Next Build Steps

1. Add Supabase authentication and organization-aware access flows.
2. Build dashboard and CRUD pages for roles, candidates, strengths, scores, and projects.
3. Add AI API routes for interview-question generation and mentor-report generation.
4. Seed the strengths library, projects, demo organization, role, candidate, and interview data.
5. Add tests for scoring logic, strengths validation, and project matching.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
