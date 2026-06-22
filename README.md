# Leadership Continuity System MVP

Standalone application for hospital succession planning, mentoring, strengths-based development, and leadership readiness reporting.

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
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
```

## Local Development

```bash
pnpm install
pnpm dev
```

## Database Setup

1. Create a new Supabase project for this app.
2. Apply the SQL in `supabase/migrations/202606220001_initial_schema.sql`.
3. Generate typed database types later once the remote project exists.

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
