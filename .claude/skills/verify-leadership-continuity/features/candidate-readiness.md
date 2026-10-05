# Candidate readiness

## Sub-features

- Candidate list and role pipeline.
- Role-specific readiness percentage and award band.
- Candidate detail, competency evidence, and development plan entry points.

## How to get to it (user POV)

Open **Candidates**, select a candidate, then choose the role or readiness section.

## Driving it with `control-app`

```bash
bin/control-app.sh goto /candidates
bin/control-app.sh dump /candidates artifacts/verification/candidates-baseline.html
```

Use a real candidate ID from the local fixture for the detail route and capture both list and detail states.

## Gotchas

- Readiness is role-specific; do not compare a candidate’s score across roles without naming the role.
- The weighting policy is stored on the role and applied in `src/lib/fit-analysis.ts`.
- Candidate detail requires an authenticated candidate or authorized organization user.
