# Mentoring and sharing

## Sub-features

- Mentoring workspace and role tracks.
- Mentor assignments and development records.
- Candidate-controlled sharing with role-specific mentor approval.

## How to get to it (user POV)

Open **Mentoring**, choose a role track, then open the relevant workspace. Review sharing from the candidate or mentoring context.

## Driving it with `control-app`

```bash
bin/control-app.sh goto /mentoring
bin/control-app.sh dump /mentoring artifacts/verification/mentoring-baseline.html
```

Run multi-account sharing checks only after the read-only baseline; verify the result from the receiving account.

## Gotchas

- Mentor access is role-specific; one candidate may have multiple mentors.
- Coach access is not implied by mentor access and must remain explicitly shared.
- Private mentor notes and other employees’ confidential information must never appear in coach evidence.
