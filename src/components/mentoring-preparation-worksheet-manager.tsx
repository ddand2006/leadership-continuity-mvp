"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createEmptyPreparationWorksheet,
  normalizePreparationWorksheetRecord,
  type PreparationWorksheetPayload,
  type PreparationWorksheetRecord,
} from "@/lib/mentoring-preparation-worksheet";

type WorksheetAssignmentOption = {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  candidateName: string;
  currentTitle: string | null;
  roleTitle: string;
  mentorName: string;
  mentorPositionTitle: string | null;
  startDate: string | null;
  worksheet: PreparationWorksheetRecord | null;
};

function getAssignmentKey(option: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
}) {
  return `${option.candidateId}:${option.roleId}:${option.mentorProfileId}`;
}

function hasUpdatedAt(
  worksheet: PreparationWorksheetPayload | PreparationWorksheetRecord | null | undefined,
): worksheet is PreparationWorksheetRecord {
  return Boolean(worksheet && "updatedAt" in worksheet);
}

function isCompetencyComplete(
  competency: PreparationWorksheetPayload["criticalCompetencies"][number],
) {
  return [
    competency.whatMustDo,
    competency.whyCritical,
    competency.successLooksLike,
    competency.failureLooksLike,
  ].every((value) => value.trim().length > 0);
}

function getFirstIncompleteCompetencyIndex(
  competencies: PreparationWorksheetPayload["criticalCompetencies"],
) {
  const index = competencies.findIndex((competency) => !isCompetencyComplete(competency));
  return index === -1 ? 0 : index;
}

function normalizeWorksheetRecord(
  option: WorksheetAssignmentOption,
  worksheet: PreparationWorksheetRecord | PreparationWorksheetPayload | null,
) {
  if (worksheet && "updatedAt" in worksheet) {
    return normalizePreparationWorksheetRecord(worksheet);
  }

  return (
    worksheet ??
    createEmptyPreparationWorksheet({
      candidateId: option.candidateId,
      roleId: option.roleId,
      mentorProfileId: option.mentorProfileId,
    })
  );
}

export function MentoringPreparationWorksheetManager({
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
  const [activeCompetencyIndex, setActiveCompetencyIndex] = useState(0);
  const [worksheetsByAssignmentKey, setWorksheetsByAssignmentKey] = useState<
    Record<string, PreparationWorksheetPayload | PreparationWorksheetRecord>
  >(() =>
    Object.fromEntries(
      assignments
        .filter((assignment) => assignment.worksheet)
        .map((assignment) => [
          getAssignmentKey(assignment),
          assignment.worksheet as PreparationWorksheetRecord,
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
  const completedCompetencyCount = formState
    ? formState.criticalCompetencies.filter((competency) =>
        isCompetencyComplete(competency),
      ).length
    : 0;
  const allCompetenciesComplete = completedCompetencyCount === 5;
  const activeCompetency = formState?.criticalCompetencies[activeCompetencyIndex] ?? null;

  function updateCompetency(
    index: number,
    field: keyof PreparationWorksheetPayload["criticalCompetencies"][number],
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
          criticalCompetencies: currentWorksheet.criticalCompetencies.map(
            (item, itemIndex) =>
              itemIndex === index ? { ...item, [field]: value } : item,
          ),
        },
      };
    });
  }

  function updateField(
    field: keyof Omit<
      PreparationWorksheetPayload,
      | "criticalCompetencies"
      | "initialDevelopmentFocus"
      | "candidateId"
      | "roleId"
      | "mentorProfileId"
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

  function updateInitialFocus(index: number, value: string) {
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
          initialDevelopmentFocus: currentWorksheet.initialDevelopmentFocus.map(
            (item, itemIndex) => (itemIndex === index ? value : item),
          ),
        },
      };
    });
  }

  function handleSave(status: PreparationWorksheetPayload["status"]) {
    if (!formState || !selectedAssignment || !storageReady) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/mentoring/preparation-worksheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formState,
          status,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        worksheet?: { id: string; updatedAt: string };
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save this worksheet.");
        return;
      }

      const nextWorksheet: PreparationWorksheetRecord = {
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

  function handleCompleteCompetencyEntry() {
    if (!formState || !activeCompetency || !isCompetencyComplete(activeCompetency)) {
      setError(
        "Complete all four competency prompts before adding this competency to the worksheet list.",
      );
      return;
    }

    setError(null);
    setSuccess(null);

    const nextIncompleteIndex = formState.criticalCompetencies.findIndex(
      (competency, index) =>
        index !== activeCompetencyIndex && !isCompetencyComplete(competency),
    );

    if (nextIncompleteIndex !== -1) {
      setActiveCompetencyIndex(nextIncompleteIndex);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Mentoring Worksheet
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Mentor &amp; mentee preparation worksheet
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
            Use this together with the candidate to define the most critical role
            competencies, surface development priorities, and document what support
            should shape the mentoring process. Saved responses can be revisited later
            and used as part of readiness conversations.
          </p>
        </div>
      </div>

      {!storageReady ? (
        <article className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
          Worksheet storage is not active yet. Run the latest Supabase migration for
          mentoring preparation worksheets, then this form will save drafts normally.
        </article>
      ) : null}

      {assignments.length === 0 ? (
        <article className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
          Create a mentor assignment above first. Once a candidate is tied to a role
          and mentor, this worksheet can be completed and saved for that track.
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
                const nextAssignment =
                  assignments.find(
                    (assignment) =>
                      getAssignmentKey(assignment) === event.target.value,
                  ) ?? null;

                setSelectedAssignmentKey(event.target.value);
                setActiveCompetencyIndex(
                  nextAssignment?.worksheet
                    ? getFirstIncompleteCompetencyIndex(
                        nextAssignment.worksheet.criticalCompetencies,
                      )
                    : 0,
                );
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

          <div className="grid gap-4 md:grid-cols-4">
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
                Role Being Developed
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedAssignment.roleTitle}
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
                Worksheet Date
              </span>
              <input
                type="date"
                value={formState.worksheetDate ?? ""}
                onChange={(event) => updateField("worksheetDate", event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
              />
            </label>
          </div>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">
              Step 1: Identify the most critical competencies
            </p>
            <p className="mt-2">
              Add one competency at a time. Once a competency is complete, it will
              appear below with an edit option. Think about outcomes, not tasks. These
              entries become the mentoring foundation for assessment, development
              planning, and readiness review.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {completedCompetencyCount} of 5 competencies completed
            </p>
          </article>

          {activeCompetency ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    Critical Competency Entry
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    Competency #{activeCompetencyIndex + 1}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Complete this entry, then add it to the worksheet list below.
                  </p>
                </div>
                {isCompetencyComplete(activeCompetency) ? (
                  <span className="rounded-full bg-teal-50 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-teal-700 uppercase">
                    Ready to add
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                    In progress
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What must they be able to do?
                  </span>
                  <textarea
                    value={activeCompetency.whatMustDo}
                    onChange={(event) =>
                      updateCompetency(
                        activeCompetencyIndex,
                        "whatMustDo",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Why is this critical to the role?
                  </span>
                  <textarea
                    value={activeCompetency.whyCritical}
                    onChange={(event) =>
                      updateCompetency(
                        activeCompetencyIndex,
                        "whyCritical",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What does success look like?
                  </span>
                  <textarea
                    value={activeCompetency.successLooksLike}
                    onChange={(event) =>
                      updateCompetency(
                        activeCompetencyIndex,
                        "successLooksLike",
                        event.target.value,
                      )
                    }
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What does failure look like?
                  </span>
                  <textarea
                    value={activeCompetency.failureLooksLike}
                    onChange={(event) =>
                      updateCompetency(
                        activeCompetencyIndex,
                        "failureLooksLike",
                        event.target.value,
                      )
                    }
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCompleteCompetencyEntry}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                >
                  {isCompetencyComplete(activeCompetency)
                    ? "Save Competency to List"
                    : "Complete This Competency"}
                </button>
                {formState.criticalCompetencies.some((competency, index) => {
                  return index !== activeCompetencyIndex && isCompetencyComplete(competency);
                }) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCompetencyIndex(
                        getFirstIncompleteCompetencyIndex(
                          formState.criticalCompetencies,
                        ),
                      )
                    }
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Jump to Next Open Competency
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          <div className="grid gap-4">
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Completed competencies
            </p>
            {formState.criticalCompetencies.some((competency) =>
              isCompetencyComplete(competency),
            ) ? (
              formState.criticalCompetencies.map((competency, index) =>
                isCompetencyComplete(competency) ? (
                  <article
                    key={`completed-competency-${index + 1}`}
                    className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Critical Competency #{index + 1}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {competency.whatMustDo}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {competency.whyCritical}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveCompetencyIndex(index)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Success
                        </p>
                        <p className="mt-2 leading-7">{competency.successLooksLike}</p>
                      </article>
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Failure
                        </p>
                        <p className="mt-2 leading-7">{competency.failureLooksLike}</p>
                      </article>
                    </div>
                  </article>
                ) : null,
              )
            ) : (
              <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                No competencies have been completed yet. Start with the first entry above.
              </article>
            )}
          </div>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">
              Step 2: Rank the completed competencies
            </p>
            <p className="mt-2">
              Once all five competencies are complete, assign a unique priority rank
              from 1 to 5.
            </p>
          </article>

          {allCompetenciesComplete ? (
            <div className="grid gap-4 md:grid-cols-2">
              {formState.criticalCompetencies.map((competency, index) => (
                <article
                  key={`ranking-${index + 1}`}
                  className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Competency #{index + 1}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {competency.whatMustDo}
                      </p>
                    </div>
                    <label className="block md:min-w-44">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Priority rank
                      </span>
                      <select
                        value={competency.priorityRank}
                        onChange={(event) =>
                          updateCompetency(index, "priorityRank", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        <option value="">Select</option>
                        {[1, 2, 3, 4, 5].map((rank) => (
                          <option key={rank} value={String(rank)}>
                            {rank}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              Finish all five competency entries first, then the ranking section will
              open here.
            </article>
          )}

          <article className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">
              Step 3: Mentee reflection &amp; development discussion
            </p>
            <p className="mt-2">
              Use these questions to create clarity, alignment, and honest
              discussion about where development should begin.
            </p>
          </article>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Which competencies do you feel least prepared to perform today? Why?
              </span>
              <textarea
                value={formState.menteeLeastPrepared}
                onChange={(event) =>
                  updateField("menteeLeastPrepared", event.target.value)
                }
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Where do you believe you are strongest? Why?
              </span>
              <textarea
                value={formState.menteeStrongestArea}
                onChange={(event) =>
                  updateField("menteeStrongestArea", event.target.value)
                }
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                How do your CliftonStrengths help you in this role?
              </span>
              <textarea
                value={formState.strengthsHelp}
                onChange={(event) => updateField("strengthsHelp", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                How might your strengths distract you from performing your best, and
                what will you do to fix that?
              </span>
              <textarea
                value={formState.strengthsDistractionPlan}
                onChange={(event) =>
                  updateField("strengthsDistractionPlan", event.target.value)
                }
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Where do we agree development should be focused first?
              </span>
              <textarea
                value={formState.sharedDevelopmentFocus}
                onChange={(event) =>
                  updateField("sharedDevelopmentFocus", event.target.value)
                }
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                What improvement in skill, knowledge, or behavior would we like to
                see occur?
              </span>
              <textarea
                value={formState.desiredImprovement}
                onChange={(event) =>
                  updateField("desiredImprovement", event.target.value)
                }
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              />
            </label>
          </div>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Psychological safety commitment
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What support do you need from your mentor to be successful?
                </span>
                <textarea
                  value={formState.mentorSupportNeeded}
                  onChange={(event) =>
                    updateField("mentorSupportNeeded", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What expectations should we set for open, honest communication?
                </span>
                <textarea
                  value={formState.communicationExpectations}
                  onChange={(event) =>
                    updateField("communicationExpectations", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Initial development focus
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {formState.initialDevelopmentFocus.map((item, index) => (
                <label key={`focus-${index + 1}`} className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Top area #{index + 1}
                  </span>
                  <input
                    value={item}
                    onChange={(event) =>
                      updateInitialFocus(index, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </article>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Mentor guidance notes
            </span>
            <textarea
              value={formState.mentorGuidanceNotes}
              onChange={(event) =>
                updateField("mentorGuidanceNotes", event.target.value)
              }
              placeholder="Capture the mentor's guiding theme for building this candidate's character, skill set, and confidence."
              className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </label>

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
