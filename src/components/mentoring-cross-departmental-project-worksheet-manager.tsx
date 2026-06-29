"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createEmptyCrossDepartmentalProjectWorksheet,
  normalizeCrossDepartmentalProjectWorksheetRecord,
  type CrossDepartmentConversationInput,
  type CrossDepartmentalProjectWorksheetPayload,
  type CrossDepartmentalProjectWorksheetRecord,
} from "@/lib/mentoring-cross-departmental-project-worksheet";

const MENTOR_OBSERVED_QUALITY_OPTIONS = [
  "Curiosity",
  "Systems thinking",
  "Ability to listen and translate",
  "Understanding of organizational impact",
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
  worksheet: CrossDepartmentalProjectWorksheetRecord | null;
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
    | CrossDepartmentalProjectWorksheetPayload
    | CrossDepartmentalProjectWorksheetRecord
    | null
    | undefined,
): worksheet is CrossDepartmentalProjectWorksheetRecord {
  return Boolean(worksheet && "updatedAt" in worksheet);
}

function isConversationComplete(conversation: CrossDepartmentConversationInput) {
  return [
    conversation.departmentName,
    conversation.leaderName,
    conversation.topPriorities,
    conversation.pressuresChallenges,
    conversation.roleImpact,
    conversation.breakdowns,
    conversation.strongCollaboration,
  ].every((value) => value.trim().length > 0);
}

function getFirstIncompleteConversationIndex(
  conversations: CrossDepartmentalProjectWorksheetPayload["departmentConversations"],
) {
  const index = conversations.findIndex(
    (conversation) => !isConversationComplete(conversation),
  );
  return index === -1 ? 0 : index;
}

function normalizeWorksheetRecord(
  option: WorksheetAssignmentOption,
  worksheet:
    | CrossDepartmentalProjectWorksheetPayload
    | CrossDepartmentalProjectWorksheetRecord
    | null,
) {
  if (worksheet && "updatedAt" in worksheet) {
    return normalizeCrossDepartmentalProjectWorksheetRecord(worksheet);
  }

  return (
    worksheet ??
    createEmptyCrossDepartmentalProjectWorksheet({
      candidateId: option.candidateId,
      roleId: option.roleId,
      mentorProfileId: option.mentorProfileId,
    })
  );
}

export function MentoringCrossDepartmentalProjectWorksheetManager({
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
  const [activeConversationIndex, setActiveConversationIndex] = useState(0);
  const [worksheetsByAssignmentKey, setWorksheetsByAssignmentKey] = useState<
    Record<
      string,
      | CrossDepartmentalProjectWorksheetPayload
      | CrossDepartmentalProjectWorksheetRecord
    >
  >(() =>
    Object.fromEntries(
      assignments
        .filter((assignment) => assignment.worksheet)
        .map((assignment) => [
          getAssignmentKey(assignment),
          assignment.worksheet as CrossDepartmentalProjectWorksheetRecord,
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
  const completedConversationCount = formState
    ? formState.departmentConversations.filter((conversation) =>
        isConversationComplete(conversation),
      ).length
    : 0;
  const activeConversation =
    formState?.departmentConversations[activeConversationIndex] ?? null;

  function updateField(
    field: keyof Omit<
      CrossDepartmentalProjectWorksheetPayload,
      | "candidateId"
      | "roleId"
      | "mentorProfileId"
      | "departmentConversations"
      | "actionCommitments"
      | "mentorObservedQualities"
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

  function updateConversationField(
    index: number,
    field: keyof CrossDepartmentConversationInput,
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
          departmentConversations: currentWorksheet.departmentConversations.map(
            (conversation, conversationIndex) =>
              conversationIndex === index
                ? {
                    ...conversation,
                    [field]: value,
                  }
                : conversation,
          ),
        },
      };
    });
  }

  function updateActionCommitment(index: number, value: string) {
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
          actionCommitments: currentWorksheet.actionCommitments.map(
            (commitment, commitmentIndex) =>
              commitmentIndex === index ? value : commitment,
          ),
        },
      };
    });
  }

  function toggleObservedQuality(
    quality: (typeof MENTOR_OBSERVED_QUALITY_OPTIONS)[number],
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
      const hasQuality = currentWorksheet.mentorObservedQualities.includes(quality);

      return {
        ...current,
        [assignmentKey]: {
          ...currentWorksheet,
          mentorObservedQualities: hasQuality
            ? currentWorksheet.mentorObservedQualities.filter(
                (item) => item !== quality,
              )
            : [...currentWorksheet.mentorObservedQualities, quality],
        },
      };
    });
  }

  function handleSave(status: CrossDepartmentalProjectWorksheetPayload["status"]) {
    if (!formState || !selectedAssignment || !storageReady) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(
        "/api/mentoring/cross-departmental-project-worksheet",
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

      const nextWorksheet: CrossDepartmentalProjectWorksheetRecord = {
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

  function handleCompleteConversationEntry() {
    if (
      !formState ||
      !activeConversation ||
      !isConversationComplete(activeConversation)
    ) {
      setError(
        "Complete all department conversation prompts before adding this conversation to the worksheet list.",
      );
      return;
    }

    setError(null);
    setSuccess(null);

    const nextIncompleteIndex = formState.departmentConversations.findIndex(
      (conversation, index) =>
        index !== activeConversationIndex && !isConversationComplete(conversation),
    );

    if (nextIncompleteIndex !== -1) {
      setActiveConversationIndex(nextIncompleteIndex);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
        Cross-Departmental Project Worksheet
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Build systems-thinking through cross-functional work
      </h2>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
        Use this worksheet to help the mentee understand how the future role affects
        other departments, where friction happens, and what kind of shared project
        can build stronger collaboration across the hospital.
      </p>

      {!storageReady ? (
        <article className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
          Worksheet storage is not active yet. Run the latest Supabase migration for
          cross-departmental project worksheets, then this form will save drafts
          normally.
        </article>
      ) : null}

      {assignments.length === 0 ? (
        <article className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
          Create a mentor assignment first. This worksheet stays tied to the active
          candidate-role-mentor assignment so the same mentor carries through the
          full mentoring process.
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
                setActiveConversationIndex(
                  nextAssignment?.worksheet
                    ? getFirstIncompleteConversationIndex(
                        nextAssignment.worksheet.departmentConversations,
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
              Step 1: Identify 3 to 5 key departments and meet with their leaders
            </p>
            <p className="mt-2">
              Add one department conversation at a time. Once a conversation is
              complete, it will appear below with an edit option.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {completedConversationCount} of 5 department conversations completed
            </p>
          </article>

          {activeConversation ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    Department conversation entry
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    Conversation #{activeConversationIndex + 1}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Complete this conversation, then add it to the worksheet list below.
                  </p>
                </div>
                {isConversationComplete(activeConversation) ? (
                  <span className="rounded-full bg-teal-50 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-teal-700 uppercase">
                    Ready to add
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                    In progress
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Department
                  </span>
                  <input
                    value={activeConversation.departmentName}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "departmentName",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Leader name
                  </span>
                  <input
                    value={activeConversation.leaderName}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "leaderName",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What are this department&apos;s top 3 priorities?
                  </span>
                  <textarea
                    value={activeConversation.topPriorities}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "topPriorities",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What pressures or challenges do they face regularly?
                  </span>
                  <textarea
                    value={activeConversation.pressuresChallenges}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "pressuresChallenges",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    How does the future role impact this department?
                  </span>
                  <textarea
                    value={activeConversation.roleImpact}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "roleImpact",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Where do breakdowns typically occur?
                  </span>
                  <textarea
                    value={activeConversation.breakdowns}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "breakdowns",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    What does strong collaboration look like?
                  </span>
                  <textarea
                    value={activeConversation.strongCollaboration}
                    onChange={(event) =>
                      updateConversationField(
                        activeConversationIndex,
                        "strongCollaboration",
                        event.target.value,
                      )
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCompleteConversationEntry}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                >
                  {isConversationComplete(activeConversation)
                    ? "Save Conversation to List"
                    : "Complete This Conversation"}
                </button>
                {formState.departmentConversations.some((conversation, index) => {
                  return (
                    index !== activeConversationIndex &&
                    isConversationComplete(conversation)
                  );
                }) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveConversationIndex(
                        getFirstIncompleteConversationIndex(
                          formState.departmentConversations,
                        ),
                      )
                    }
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Jump to Next Open Conversation
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}

          <div className="grid gap-4">
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Completed department conversations
            </p>
            {formState.departmentConversations.some((conversation) =>
              isConversationComplete(conversation),
            ) ? (
              formState.departmentConversations.map((conversation, index) =>
                isConversationComplete(conversation) ? (
                  <article
                    key={`completed-conversation-${index + 1}`}
                    className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Department conversation #{index + 1}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {conversation.departmentName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Leader: {conversation.leaderName}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {conversation.topPriorities}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveConversationIndex(index)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Pressures and challenges
                        </p>
                        <p className="mt-2 leading-7">
                          {conversation.pressuresChallenges}
                        </p>
                      </article>
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Role impact
                        </p>
                        <p className="mt-2 leading-7">{conversation.roleImpact}</p>
                      </article>
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Breakdowns
                        </p>
                        <p className="mt-2 leading-7">{conversation.breakdowns}</p>
                      </article>
                      <article className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Strong collaboration
                        </p>
                        <p className="mt-2 leading-7">
                          {conversation.strongCollaboration}
                        </p>
                      </article>
                    </div>
                  </article>
                ) : null,
              )
            ) : (
              <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                No department conversations have been completed yet. Start with the
                first entry above.
              </article>
            )}
          </div>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 2: Turn one breakdown area into a shared learning project
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Which challenge or breakdown area will the group work on?
                </span>
                <textarea
                  value={formState.crossDepartmentChallenge}
                  onChange={(event) =>
                    updateField("crossDepartmentChallenge", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
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
                  Project timeline
                </span>
                <input
                  value={formState.projectTimeline}
                  onChange={(event) =>
                    updateField("projectTimeline", event.target.value)
                  }
                  placeholder="For example: 60 days"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What is the shared objective?
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
                  Which department leaders should participate?
                </span>
                <textarea
                  value={formState.projectPartners}
                  onChange={(event) =>
                    updateField("projectPartners", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What is the learning goal for the mentee?
                </span>
                <textarea
                  value={formState.projectLearningGoal}
                  onChange={(event) =>
                    updateField("projectLearningGoal", event.target.value)
                  }
                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 3: Patterns and insights
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What themes did you hear across departments?
                </span>
                <textarea
                  value={formState.sharedThemes}
                  onChange={(event) => updateField("sharedThemes", event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Where are the biggest risks in alignment?
                </span>
                <textarea
                  value={formState.alignmentRisks}
                  onChange={(event) =>
                    updateField("alignmentRisks", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What surprised you most?
                </span>
                <textarea
                  value={formState.biggestSurprise}
                  onChange={(event) =>
                    updateField("biggestSurprise", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 4: Leadership implications
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Based on this learning, what should you do differently as a leader?
                </span>
                <textarea
                  value={formState.leadershipShift}
                  onChange={(event) =>
                    updateField("leadershipShift", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What behaviors will be critical to success across departments?
                </span>
                <textarea
                  value={formState.criticalBehaviors}
                  onChange={(event) =>
                    updateField("criticalBehaviors", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  What insights could help the hospital moving forward?
                </span>
                <textarea
                  value={formState.hospitalInsights}
                  onChange={(event) =>
                    updateField("hospitalInsights", event.target.value)
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 5: Action commitments
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {formState.actionCommitments.map((commitment, index) => (
                <label key={`commitment-${index}`} className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Action commitment #{index + 1}
                  </span>
                  <textarea
                    value={commitment}
                    onChange={(event) =>
                      updateActionCommitment(index, event.target.value)
                    }
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">
              Step 6: Mentor debrief
            </p>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                {MENTOR_OBSERVED_QUALITY_OPTIONS.map((quality) => (
                  <label
                    key={quality}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={formState.mentorObservedQualities.includes(quality)}
                      onChange={() => toggleObservedQuality(quality)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                    />
                    <span>{quality}</span>
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mentor comments
                </span>
                <textarea
                  value={formState.mentorComments}
                  onChange={(event) => updateField("mentorComments", event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave("draft")}
              disabled={isPending || !storageReady}
              className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => handleSave("completed")}
              disabled={isPending || !storageReady}
              className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Mark Complete"}
            </button>
            {lastSavedAt ? (
              <span className="text-sm text-slate-500">
                Last saved {new Date(lastSavedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm font-medium text-rose-700">{error}</p>
          ) : null}
          {success ? (
            <p className="text-sm font-medium text-teal-700">{success}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
