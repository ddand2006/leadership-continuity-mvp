# Role composite

## Sub-features

- Create or edit a role.
- Define competencies and choose equal or role-weighted readiness scoring.
- Generate or review the role composite.

## How to get to it (user POV)

Sign in as an organization administrator, open **Roles**, choose **Add new role** or an existing role, and open the role workflow.

## Driving it with `control-app`

```bash
bin/control-app.sh goto /roles
bin/control-app.sh dump /roles artifacts/verification/roles-baseline.html
```

In the browser, use the visible role editor controls and capture the saved role state afterward.

## Gotchas

- The route requires an administrator and paid workspace; see `src/app/roles/page.tsx`.
- The role readiness setting is persisted by `src/app/api/roles/route.ts`.
- AI generation consumes configured OpenAI credits; keep it out of smoke runs.
