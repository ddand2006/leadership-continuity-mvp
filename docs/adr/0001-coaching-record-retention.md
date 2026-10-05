# ADR 0001: Governed retention for coaching records

## Status

Accepted

## Context

Coaching records have different privacy and ownership boundaries. Private coach notes must not automatically become company records, while shared plans, agreed actions, candidate reflections, and organization updates must remain available to authorized participants. Retention also depends on the applicable legal, contractual, and legal-hold requirements rather than one universal platform duration.

## Decision

The platform will model retention by record category and govern it through platform-administrator policy. The effective retention period is the longest applicable requirement from law, contract, or legal hold. Private coach notes remain separate from shared coaching records. Organizations receive an authorized termination export before records are disposed of. After the effective period, active records are deleted or anonymized according to the configured disposition and the documented backup schedule; anonymized aggregate metrics may remain.

Retention-policy changes, legal holds, exports, overrides, and disposition actions must be auditable without placing confidential narrative content in the audit trail.

## Consequences

- Retention cannot be implemented as a single hard-coded number.
- A record must carry enough category and visibility information to apply the policy safely.
- Deletion jobs must check legal holds before acting.
- Export and deletion workflows must enforce the same permissions as normal viewing.
- The organization’s legal or privacy representative must approve the configured policy before production use.
