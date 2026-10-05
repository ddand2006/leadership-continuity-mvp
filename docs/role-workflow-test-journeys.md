# Role Workflow Test Journeys

These journeys test whether the role model works across Candidate, Mentor, Administrator, and External Coach views.

## Journey 1: Build a role pipeline

**Actors:** Administrator, Mentor, Candidate

1. Administrator creates a role composite.
2. Administrator adds competencies, target scores, weights, and evidence rules.
3. Administrator approves the composite.
4. Administrator adds a candidate to the role pipeline.
5. Administrator assigns a mentor for that role.
6. Candidate sees the role composite and current readiness percentage.
7. Mentor sees the assigned candidate and role-specific development workspace.

**Verify:** Candidate and mentor can see the pipeline; neither can silently change the official composite.

## Journey 2: Mentor creates and assigns an AI-assisted project

**Actors:** Mentor, Candidate

1. Mentor starts a project from the role composite and candidate competency gaps.
2. AI drafts the project purpose, goals, evidence, and mentor questions.
3. Mentor edits the draft to fit organizational needs.
4. Mentor finalizes and assigns the project.
5. Candidate accepts the project, completes actions, and submits evidence.
6. Mentor reviews evidence and approves or requests changes.
7. Readiness recalculates for that role pipeline.

**Verify:** AI never assigns a project; mentor finalization is required.

## Journey 3: One candidate, multiple roles

**Actors:** Candidate, Mentor A, Mentor B, Administrator

1. Administrator adds the candidate to Role A and assigns Mentor A.
2. Administrator adds the same candidate to Role B and assigns Mentor B.
3. Candidate sees separate role readiness scores.
4. Mentor A sees Role A work and shared competency evidence.
5. Mentor B sees Role B work and shared competency evidence.
6. Neither mentor sees the other mentor's private notes without candidate permission.

**Verify:** A candidate may be Bronze for one role and Platinum for another.

## Journey 4: External coach sharing

**Actors:** Candidate, Mentor, Administrator, External Coach

1. Candidate requests an external coach.
2. Administrator approves the coach, budget, and engagement scope.
3. Candidate selects documents, projects, competency information, or readiness information to share.
4. Mentor approves or denies each role-specific request.
5. Coach sees only explicitly shared material in separate role sections.
6. Candidate revokes one shared item.
7. Coach immediately loses access to that item.

**Verify:** System hard restrictions prevent private mentor notes and confidential organizational information from being shared.

## Journey 5: Readiness change and history

**Actors:** Candidate, Mentor, Administrator

1. Candidate submits new evidence.
2. Mentor approves project evidence.
3. Administrator approves formal assessment evidence.
4. The role readiness percentage recalculates.
5. The Bronze/Silver/Gold/Platinum tier updates.
6. The prior readiness value remains visible in history.

**Verify:** Readiness can decrease when new evidence reveals a gap, without deleting prior history.

## Failure cases to test

- Candidate attempts to view another candidate's pipeline.
- Mentor attempts to edit the official composite without approval.
- Coach attempts to view an unshared project.
- Candidate attempts to share a private mentor note.
- Coach approval exists but administrator budget approval does not.
- Mentor approval is denied for one role but granted for another.
- A role has no competency evidence yet.
- A candidate has multiple mentors and overlapping competency evidence.
