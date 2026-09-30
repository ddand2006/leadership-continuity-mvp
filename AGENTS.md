<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project working guide

This project uses the Trellis-style organization described in `DESIGN.md` and `docs/`. Keep
stable project conventions here, put decisions in `docs/decision-log.md`, and add recurring
failure patterns to `docs/common-gotchas.md` after fixing them.

## Project

- **Name:** Leadership Continuity MVP
- **What it is:** A role-based leadership development platform connecting candidates, mentors,
  competencies, development plans, evidence, coaching, and succession workflows.
- **Stage:** MVP / active development
- **Owner context:** See `docs/about-me.md` for working preferences and technical background.

## Current source of truth

- **Architecture and product context:** `docs/leadership-continuity-architecture.md`
- **Current decisions:** `docs/decision-log.md`
- **Known bug patterns:** `docs/common-gotchas.md`
- **UI defaults:** `DESIGN.md`
- **Methodology:** `docs/methodology/`

## Stack and commands

- **Frontend/backend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- **Database/auth/storage:** Supabase
- **Hosting:** Hostinger deployment workflow; see `docs/hostinger-business-deploy.md`
- **Install:** `pnpm install`
- **Development:** `pnpm dev`
- **Typecheck:** `pnpm typecheck`
- **Lint:** `pnpm lint`
- **Build:** `pnpm build`

## Working rules

- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before changing Next.js
  APIs or conventions.
- Plan non-trivial changes before implementation, and verify user-facing changes in the running
  app when possible.
- Preserve unrelated working-tree changes. Do not commit or push them without explicit approval.
- Keep secrets out of git. Use local ignored environment files for credentials.
- For UI work, read `DESIGN.md` first and account for loading, empty, error, disabled, and
  overflow states.
- Prefer the smallest change that fits the existing components and data model.
