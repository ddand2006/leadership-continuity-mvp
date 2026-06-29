"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createEmptyDepartmentalProjectWorksheet,
  normalizeDepartmentalProjectWorksheetRecord,
  type DepartmentalProjectWorksheetPayload,
  type DepartmentalProjectWorksheetRecord,
} from "@/lib/mentoring-departmental-project-worksheet";

const LEADERSHIP_ACTION_OPTIONS = [
  "Lead a team or group discussion",
  "Address a performance or behavior issue",
  "Make a decision with incomplete information",
  "Communicate change to staff",
  "Collaborate with another department",
] as const;

type WorksheetAssignmentOption = {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  candidateName: string;
  currentTitle: string | null;
  roleTitle: string;
  departmentName: string | null;
  mentorName: string;
  mentorPositionTitle: string | null;
  startDate: string | null;
  worksheet: DepartmentalProjectWorksheetRecord | null;
};

function getAssignmentKey(option: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
}) {
  return `${option.candidateId}:${option.roleId}:${option.mentorProfileId}`;
}

function hasUpdatedAt(
  worksheet:
    | DepartmentalProjectWorksheetPayload
    | DepartmentalProjectWorksheetRecord
    | null
    | undefined,
): worksheet is DepartmentalProjectWorksheetRecord {
  return Boolean(worksheet && "updatedAt" in worksheet);
}

function normalizeWorksheetRecord(
  option: WorksheetAssignmentOption,
  worksheet:
    | DepartmentalProjectWorksheetPayload
    | DepartmentalProjectWorksheetRecord
    | null,
) {
  if (worksheet && "updatedAt" in worksheet) {
    return normalizeDepartmentalProjectWorksheetRecord(worksheet);
  }

  return (
    worksheet ??
    createEmptyDepartmentalProjectWorksheet({
      candidateId: option.candidateId,
      roleId: option.roleId,
      mentorProfileId: option.mentorProfileId,
    })
  );
}

export function MentoringDepartmentalProjectWorksheetManager({
  assignments,
  initialSelectedAssignmentKey,
  storageReady,
}: {
  assignments: WorksheetAssignmentOption[];
  initialSelectedAssignmentKey?: string | null;
  storageReady: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState(
    assignments.some(
      (assignment) =>
        getAssignmentKey(assignment) === initialSelectedAssignmentKey,
    )
      ? (initialSelectedAssignmentKey ?? "")
      : (assignments[0] ? getAssignmentKey(assignments[0]) : ""),
  );
  const [worksheetsByAssignmentKey, setWorksheetsByAssignmentKey] = useState<
    Record<string, DepartmentalProjectWorksheetPayload | DepartmentalProjectWorksheetRecord>
  >(() =>
    Object.fromEntries(
      assignments
        .filter((assignment) => assignment.worksheet)
        .map((assignment) => [
          getAssignmentKey(assignment),
          assignment.worksheet as DepartmentalProjectWorksheetRecord,
        ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedAssignment = useMemo(
    () =>
      assignments.find(
        (assignment) => getAssignmentKey(assignment) === selectedAssignmentKey,
      ) ?? assignments[0] ?? null,
    [assignments, selectedAssignmentKey],
  );
  const formState = selectedAssignment
    ? normalizeWorksheetRecord(
        selectedAssignment,
        worksheetsByAssignmentKey[getAssignmentKey(selectedAssignment)] ??
          selectedAssignment.worksheet,
      )
    : null;
  const selectedStoredWorksheet = selectedAssignment
    ? worksheetsByAssignmentKey[getAssignmentKey(selectedAssignment)] ??
      selectedAssignment.worksheet
    : null;
  const lastSavedAt = hasUpdatedAt(selectedStoredWorksheet)
    ? selectedStoredWorksheet.updatedAt
    : null;

  function updateField(
    field: keyof Omit<
      DepartmentalProjectWorksheetPayload,
      "candidateId" | "roleId" | "mentorProfileId" | "leadershipActionsRequired"
    >,
    value: string,
  ) {
    if (!selectedAssignment) {
      return;
    }

    const assignmentKey = getAssignmentKey(selectedAssignment);

    setWorksheetsByAssignmentKey((current) => {
      const currentWorksheet = normalizeWorksheetRecord(
        selectedAssignment,
        current[assignmentKey] ?? selectedAssignment.worksheet,
      );

      return {
        ...current,
        [assignmentKey]: {
          ...currentWorksheet,
          [field]: value,
        },
      };
    });
  }

  function toggleLeadershipAction(action: (typeof LEADERSHIP_ACTION_OPTIONS)[number]) {
    if (!selectedAssignment) {
      return;
    }

    const assignmentKey = getAssignmentKey(selectedAssignment);

    setWorksheetsByAssignmentKey((current) => {
      const currentWorksheet = normalizeWorksheetRecord(
        selectedAssignment,
        current[assignmentKey] ?? selectedAssignment.worksheet,
      );

      const hasAction = currentWorksheet.leadershipActionsRequired.includes(action);

      return {
        ...current,
        [assignmentKey]: {
          ...currentWorksheet,
          leadershipActionsRequired: hasAction
            ? currentWorksheet.leadershipActionsRequired.filter(
                (item) => item !== action,
              )
            : [...currentWorksheet.leadershipActionsRequired, action],
        },
      };
    });
  }

  function handleSave(status: DepartmentalProjectWorksheetPayload["status"]) {
    if (!formState || !selectedAssignment || !storageReady) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(
        "/api/mentoring/departmental-project-worksheet",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formState,
            status,
          }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        worksheet?: { id: string; updatedAt: string };
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save this worksheet.");
        return;
      }

      const nextWorksheet: DepartmentalProjectWorksheetRecord = {
        ...formState,
        status,
        id: payload.worksheet?.id ?? `${selectedAssignmentKey}:draft`,
        updatedAt: payload.worksheet?.updatedAt ?? new Date().toISOString(),
      };

      setWorksheetsByAssignmentKey((current) => ({
        ...current,
        [selectedAssignmentKey]: nextWorksheet,
      }));
      setSuccess(payload.message ?? "Worksheet saved.");
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
        Departmental Project Worksheet
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Build a department leadership project
      </h2>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
        Use this worksheet to define a meaningful initiative inside the future
        department, clarify ownership, and document how the project will develop the
        candidate as a leader.
      </p>

      {!storageReady ? (
        <article className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
          Worksheet storage is not active yet. Run the latest Supabase migration for
          departmental project worksheets, then this form will save drafts normally.
        </article>
      ) : null}

      {assignments.length === 0 ? (
        <article className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
          Create a mentor assignment above first. Once a candidate is tied to a role
          and mentor, this departmental worksheet can be completed and saved for that
          track.
        </article>
      ) : null}

      {selectedAssignment && formState ? (
        <div className="mt-6 grid gap-6">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Candidate role track
            </span>
            <select
              value={selectedAssignmentKey}
              onChange={(event) => {
                setSelectedAssignmentKey(event.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            >
              {assignments.map((assignment) => (
                <option
                  key={getAssignmentKey(assignment)}
                  value={getAssignmentKey(assignment)}
                >
                  {assignment.candidateName} • {assignment.roleTitle} •{" "}
                  {assignment.mentorName}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-5">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Mentee
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedAssignment.candidateName}
              </p>
              <p className="mt-1 text-slate-600">
                {selectedAssignment.currentTitle ?? "Current title not entered"}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Target Role
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedAssignment.roleTitle}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Department
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedAssignment.departmentName ?? "Department not entered"}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Mentor
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedAssignment.mentorName}
              </p>
              <p className="mt-1 text-slate-600">
                {selectedAssignment.mentorPositionTitle ?? "Position not entered"}
              </p>
            </article>
            <label className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <span className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Project Timeline
              </span>
              <input
                value={formState.projectTimeline}
                onChange={(event) =>
                  updateField("projectTimeline", event.target.value)
                }
                placeholder="For example: 60 days"
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Step 1: Identify a department need
            </span>
            <textarea
              value={formState.departmentNeed}
              onChange={(event) => updateField("departmentNeed", event.target.value)}
              placeholder="What current challenge, gap, or opportunity exists within this department?"
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 2: Define the project
            </p>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Project title
                </span>
                <input
                  value={formState.projectTitle}
                  onChange={(event) => updateField("projectTitle", event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What is the objective of this project?
                </span>
                <textarea
                  value={formState.projectObjective}
                  onChange={(event) =>
                    updateField("projectObjective", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Why does this matter to the department and hospital?
                </span>
                <textarea
                  value={formState.projectImportance}
                  onChange={(event) =>
                    updateField("projectImportance", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 3: Scope and ownership
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What specific outcomes are you responsible for?
                </span>
                <textarea
                  value={formState.responsibleOutcomes}
                  onChange={(event) =>
                    updateField("responsibleOutcomes", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Who will you need to work with?
                </span>
                <textarea
                  value={formState.collaborators}
                  onChange={(event) => updateField("collaborators", event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 4: Leadership actions required
            </p>
            <div className="mt-4 grid gap-3">
              {LEADERSHIP_ACTION_OPTIONS.map((action) => (
                <label key={action} className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.leadershipActionsRequired.includes(action)}
                    onChange={() => toggleLeadershipAction(action)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                  />
                  <span>{action}</span>
                </label>
              ))}
              <label className="block">
                <span className="mb-2 mt-2 block text-sm font-semibold text-slate-700">
                  Other leadership action
                </span>
                <input
                  value={formState.leadershipActionsOther}
                  onChange={(event) =>
                    updateField("leadershipActionsOther", event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Which top competencies will this project develop?
                </span>
                <textarea
                  value={formState.competenciesDeveloped}
                  onChange={(event) =>
                    updateField("competenciesDeveloped", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 5: Anticipated challenges
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mentor: where do you expect this to be difficult?
                </span>
                <textarea
                  value={formState.mentorAnticipatedDifficulty}
                  onChange={(event) =>
                    updateField("mentorAnticipatedDifficulty", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Which competencies will this stretch?
                </span>
                <textarea
                  value={formState.mentorStretchCompetencies}
                  onChange={(event) =>
                    updateField("mentorStretchCompetencies", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mentee: where do you expect this to be difficult?
                </span>
                <textarea
                  value={formState.menteeAnticipatedDifficulty}
                  onChange={(event) =>
                    updateField("menteeAnticipatedDifficulty", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Outline a process with your mentor for handling challenges
                </span>
                <textarea
                  value={formState.challengeProcessWithMentor}
                  onChange={(event) =>
                    updateField("challengeProcessWithMentor", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Where do you anticipate more coaching and less coaching?
                </span>
                <textarea
                  value={formState.coachingAreas}
                  onChange={(event) => updateField("coachingAreas", event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What is the process for figuring things out?
                </span>
                <textarea
                  value={formState.figuringThingsOutProcess}
                  onChange={(event) =>
                    updateField("figuringThingsOutProcess", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  How long do you spend trying to figure it out versus asking for help?
                </span>
                <textarea
                  value={formState.helpThreshold}
                  onChange={(event) => updateField("helpThreshold", event.target.value)}
                  className="min-h-20 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Step 6: Success measures
            </span>
            <textarea
              value={formState.successMeasures}
              onChange={(event) => updateField("successMeasures", event.target.value)}
              placeholder="How will success be evaluated operationally, culturally, or through people outcomes?"
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 7: Post-project reflection
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What did you do well as a leader?
                </span>
                <textarea
                  value={formState.postProjectLeaderWins}
                  onChange={(event) =>
                    updateField("postProjectLeaderWins", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What would you do differently?
                </span>
                <textarea
                  value={formState.postProjectDoDifferently}
                  onChange={(event) =>
                    updateField("postProjectDoDifferently", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What feedback did you receive from others?
                </span>
                <textarea
                  value={formState.postProjectFeedbackReceived}
                  onChange={(event) =>
                    updateField("postProjectFeedbackReceived", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 8: Mentor evaluation
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Which competencies were developed?
                </span>
                <textarea
                  value={formState.mentorEvaluationCompetenciesDeveloped}
                  onChange={(event) =>
                    updateField(
                      "mentorEvaluationCompetenciesDeveloped",
                      event.target.value,
                    )
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Strengths observed
                </span>
                <textarea
                  value={formState.strengthsObserved}
                  onChange={(event) =>
                    updateField("strengthsObserved", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Future development areas
                </span>
                <textarea
                  value={formState.futureDevelopmentAreas}
                  onChange={(event) =>
                    updateField("futureDevelopmentAreas", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Readiness signal
                </span>
                <select
                  value={formState.readinessSignal}
                  onChange={(event) =>
                    updateField("readinessSignal", event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                >
                  <option value="">Select readiness signal</option>
                  <option value="developing">Developing</option>
                  <option value="progressing">Progressing</option>
                  <option value="role_ready">Role-Ready</option>
                </select>
              </label>
            </div>
          </article>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave("draft")}
              disabled={isPending || !storageReady}
              className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {isPending ? "Saving..." : "Save Worksheet Draft"}
            </button>
            <button
              type="button"
              onClick={() => handleSave("completed")}
              disabled={isPending || !storageReady}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isPending ? "Saving..." : "Save as Completed"}
            </button>
            {lastSavedAt ? (
              <p className="text-sm text-slate-500">
                Last saved {new Date(lastSavedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="text-sm text-teal-700">{success}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
