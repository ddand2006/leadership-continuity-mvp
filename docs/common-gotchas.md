# Common Gotchas

Symptom → root cause → fix patterns discovered in this project. Agents: append a row after every
bug fix (see AGENTS.md § Autonomous Housekeeping). Check this table FIRST when diagnosing a bug -
the symptom may already be documented.

Keep entries terse: future sessions are the consumer and they have a limited attention budget.
Include a commit SHA and issue reference when known.

| Symptom | Root Cause | Fix | Date | Ref |
|---|---|---|---|---|
| Candidate preview loses its role context after opening a development link | Workspace links omitted the `viewAs=candidate` marker | Preserve the Candidate marker on links leaving the preview workspace | 2026-09-30 | `9350771` |
