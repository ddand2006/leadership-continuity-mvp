"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  LEADERSHIP_DEVELOPMENT_GROWTH_AREAS,
  LEADERSHIP_DEVELOPMENT_READINESS_SIGNALS,
  LEADERSHIP_DEVELOPMENT_STATUSES,
  calculateLeadershipDevelopmentGapRemaining,
  calculateLeadershipDevelopmentImprovement,
  createEmptyLeadershipDevelopmentCompetency,
  createEmptyLeadershipDevelopmentFeedback,
  createEmptyLeadershipDevelopmentLeader,
  createEmptyLeadershipDevelopmentRecord,
  isLeadershipDevelopmentMentorReviewComplete,
  normalizeLeadershipDevelopmentRecord,
  type LeadershipDevelopmentRecordPayload,
  type LeadershipDevelopmentRecordRecord,
} from "@/lib/leadership-development-record";
import {
  buildLeadershipDevelopmentRecordFromProject,
  type MentoringSourceProject,
} from "@/lib/mentoring-source-project";

type LeadershipDevelopmentAssignmentOption = {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  candidateName: string;
  currentTitle: string | null;
  roleTitle: string;
  mentorName: string;
  mentorPositionTitle: string | null;
  startDate: string | null;
};

type CollapsibleSectionId =
  | "candidate-information"
  | "development-focus"
  | "development-experience"
  | "competency-scoring"
  | "leader-feedback"
  | "mentor-review";

function getAssignmentKey(option: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
}) {
  return `${option.candidateId}:${option.roleId}:${option.mentorProfileId}`;
}

function createOpenSectionState() {
  return {
    "candidate-information": true,
    "development-focus": true,
    "development-experience": true,
    "competency-scoring": true,
    "leader-feedback": true,
    "mentor-review": true,
  } as Record<CollapsibleSectionId, boolean>;
}

function getStatusLabel(status: LeadershipDevelopmentRecordRecord["status"]) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "ready_for_review":
      return "Ready for Review";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

function getReadinessLabel(
  value: LeadershipDevelopmentRecordRecord["readinessSignal"],
) {
  switch (value) {
    case "developing":
      return "Developing";
    case "progressing":
      return "Progressing";
    case "near_role_ready":
      return "Near Role-Ready";
    case "role_ready":
      return "Role-Ready";
    default:
      return "Not yet signaled";
  }
}

function createRecordLabel(record: LeadershipDevelopmentRecordRecord) {
  return `${record.experienceTitle || "Untitled experience"} • ${getStatusLabel(record.status)}`;
}

function getDraftStatus(
  record: LeadershipDevelopmentRecordPayload,
): LeadershipDevelopmentRecordPayload["status"] {
  if (record.status === "completed") {
    return "in_progress";
  }

  return record.status;
}

function createDraftRecordForAssignment(
  selectedAssignment: LeadershipDevelopmentAssignmentOption,
) {
  return createEmptyLeadershipDevelopmentRecord({
    candidateId: selectedAssignment.candidateId,
    roleId: selectedAssignment.roleId,
    mentorId: selectedAssignment.mentorProfileId,
    candidateName: selectedAssignment.candidateName,
    targetRole: selectedAssignment.roleTitle,
    primaryMentor: selectedAssignment.mentorName,
    dateAssigned:
      selectedAssignment.startDate ?? new Date().toISOString().slice(0, 10),
  });
}

function syncRecordWithAssignment(
  record: LeadershipDevelopmentRecordPayload | LeadershipDevelopmentRecordRecord,
  assignment: LeadershipDevelopmentAssignmentOption,
) {
  return {
    ...record,
    candidateName: assignment.candidateName,
    targetRole: assignment.roleTitle,
    primaryMentor: assignment.mentorName,
  };
}

function createSelectorValue(options: {
  selectedRecordId: string;
  selectedProjectId: string;
}) {
  if (options.selectedRecordId) {
    return `record:${options.selectedRecordId}`;
  }

  if (options.selectedProjectId) {
    return `project:${options.selectedProjectId}`;
  }

  return "";
}

function findLinkedProjectForRecord(
  record: LeadershipDevelopmentRecordRecord | null,
  sourceProjects: MentoringSourceProject[],
) {
  if (!record) {
    return null;
  }

  const normalizedExperienceTitle = record.experienceTitle.trim().toLowerCase();

  return (
    sourceProjects.find(
      (project) => project.title.trim().toLowerCase() === normalizedExperienceTitle,
    ) ?? null
  );
}

export function LeadershipDevelopmentRecordManager({
  assignments,
  initialSelectedAssignmentKey,
  initialSelectedProjectId,
}: {
  assignments: LeadershipDevelopmentAssignmentOption[];
  initialSelectedAssignmentKey?: string | null;
  initialSelectedProjectId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState(
    assignments.some(
      (assignment) => getAssignmentKey(assignment) === initialSelectedAssignmentKey,
    )
      ? (initialSelectedAssignmentKey ?? "")
      : (assignments[0] ? getAssignmentKey(assignments[0]) : ""),
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [pendingInitialProjectId, setPendingInitialProjectId] = useState(
    initialSelectedProjectId ?? "",
  );
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(
    Boolean(initialSelectedProjectId),
  );
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [recordsByAssignmentKey, setRecordsByAssignmentKey] = useState<
    Record<string, LeadershipDevelopmentRecordRecord[]>
  >({});
  const [sourceProjectsByAssignmentKey, setSourceProjectsByAssignmentKey] = useState<
    Record<string, MentoringSourceProject[]>
  >({});
  const [formState, setFormState] = useState<LeadershipDevelopmentRecordPayload | null>(
    null,
  );
  const [openSections, setOpenSections] = useState(createOpenSectionState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedAssignment = useMemo(
    () =>
      assignments.find(
        (assignment) => getAssignmentKey(assignment) === selectedAssignmentKey,
      ) ?? assignments[0] ?? null,
    [assignments, selectedAssignmentKey],
  );
  const currentRecords = selectedAssignment
    ? recordsByAssignmentKey[getAssignmentKey(selectedAssignment)] ?? []
    : [];
  const currentSourceProjects = selectedAssignment
    ? sourceProjectsByAssignmentKey[getAssignmentKey(selectedAssignment)] ?? []
    : [];
  const selectedRecord =
    currentRecords.find((record) => record.id === selectedRecordId) ?? null;
  const selectedSourceProject =
    currentSourceProjects.find((project) => project.id === selectedProjectId) ?? null;
  const linkedSourceProject =
    selectedSourceProject ??
    findLinkedProjectForRecord(selectedRecord, currentSourceProjects);

  function applySelectedRecord(
    nextSelectedAssignment: LeadershipDevelopmentAssignmentOption,
    records: LeadershipDevelopmentRecordRecord[],
    nextRecordId: string,
  ) {
    setSelectedProjectId("");
    setSelectedRecordId(nextRecordId);
    setFormState(
      nextRecordId
        ? syncRecordWithAssignment(
            normalizeLeadershipDevelopmentRecord(
              records.find((record) => record.id === nextRecordId) ?? records[0],
            ),
            nextSelectedAssignment,
          )
        : createDraftRecordForAssignment(nextSelectedAssignment),
    );
  }

  function applySelectedProject(
    nextSelectedAssignment: LeadershipDevelopmentAssignmentOption,
    project: MentoringSourceProject,
  ) {
    setSelectedRecordId("");
    setSelectedProjectId(project.id);
    setProjectDetailsOpen(true);
    setFormState(
      buildLeadershipDevelopmentRecordFromProject({
        assignment: nextSelectedAssignment,
        project,
      }),
    );
  }

  useEffect(() => {
    if (!selectedAssignment) {
      return;
    }

    const controller = new AbortController();

    async function loadRecords() {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const params = new URLSearchParams({
        candidateId: selectedAssignment.candidateId,
        roleId: selectedAssignment.roleId,
        mentorId: selectedAssignment.mentorProfileId,
      });

      try {
        const response = await fetch(
          `/api/mentoring/leadership-development-record?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as {
          error?: string;
          records?: LeadershipDevelopmentRecordRecord[];
          projects?: MentoringSourceProject[];
        };

        if (!response.ok) {
          if (response.status === 503) {
            setStorageReady(false);
          }

          setRecordsByAssignmentKey((current) => ({
            ...current,
            [getAssignmentKey(selectedAssignment)]: [],
          }));
          setSourceProjectsByAssignmentKey((current) => ({
            ...current,
            [getAssignmentKey(selectedAssignment)]: [],
          }));
          applySelectedRecord(selectedAssignment, [], "");
          setError(payload.error ?? "Unable to load leadership development records.");
          return;
        }

        setStorageReady(true);
        const records = (payload.records ?? []).map((record) =>
          normalizeLeadershipDevelopmentRecord(record),
        );
        const sourceProjects = payload.projects ?? [];
        const assignmentKey = getAssignmentKey(selectedAssignment);

        setRecordsByAssignmentKey((current) => ({
          ...current,
          [assignmentKey]: records,
        }));
        setSourceProjectsByAssignmentKey((current) => ({
          ...current,
          [assignmentKey]: sourceProjects,
        }));

        const persistedSelectedProject =
          selectedProjectId &&
          sourceProjects.some((project) => project.id === selectedProjectId)
            ? selectedProjectId
            : "";
        const initialProjectForRoute =
          pendingInitialProjectId &&
          sourceProjects.some((project) => project.id === pendingInitialProjectId)
            ? pendingInitialProjectId
            : "";
        const nextRecordId =
          selectedRecordId && records.some((record) => record.id === selectedRecordId)
            ? selectedRecordId
            : "";

        if (nextRecordId) {
          applySelectedRecord(selectedAssignment, records, nextRecordId);
          return;
        }

        const nextProjectId = persistedSelectedProject || initialProjectForRoute;

        if (nextProjectId) {
          const matchedProject =
            sourceProjects.find((project) => project.id === nextProjectId) ?? null;

          if (matchedProject) {
            applySelectedProject(selectedAssignment, matchedProject);
            if (initialProjectForRoute === nextProjectId) {
              setPendingInitialProjectId("");
            }
            return;
          }
        }

        applySelectedRecord(selectedAssignment, records, records[0]?.id ?? "");
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") {
          return;
        }

        setError("Unable to load leadership development records.");
      } finally {
        setIsLoading(false);
      }
    }

    loadRecords();

    return () => controller.abort();
  }, [selectedAssignment, selectedRecordId]);

  function toggleSection(sectionId: CollapsibleSectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function updateRecord<K extends keyof LeadershipDevelopmentRecordPayload>(
    field: K,
    value: LeadershipDevelopmentRecordPayload[K],
  ) {
    setFormState((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateCompetency(
    index: number,
    field: keyof LeadershipDevelopmentRecordPayload["competencies"][number],
    value: string,
  ) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        competencies: current.competencies.map((competency, competencyIndex) =>
          competencyIndex === index ? { ...competency, [field]: value } : competency,
        ),
      };
    });
  }

  function updateLeader(
    index: number,
    field: keyof LeadershipDevelopmentRecordPayload["leaderEngagements"][number],
    value: string | boolean,
  ) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        leaderEngagements: current.leaderEngagements.map((leader, leaderIndex) =>
          leaderIndex === index ? { ...leader, [field]: value } : leader,
        ),
      };
    });
  }

  function updateFeedback(
    index: number,
    field: keyof LeadershipDevelopmentRecordPayload["reviewerFeedback"][number],
    value: string,
  ) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        reviewerFeedback: current.reviewerFeedback.map((feedback, feedbackIndex) =>
          feedbackIndex === index ? { ...feedback, [field]: value } : feedback,
        ),
      };
    });
  }

  function toggleGrowthArea(growthArea: (typeof LEADERSHIP_DEVELOPMENT_GROWTH_AREAS)[number]) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        growthAreas: current.growthAreas.includes(growthArea)
          ? current.growthAreas.filter((item) => item !== growthArea)
          : [...current.growthAreas, growthArea],
      };
    });
  }

  function addLeader() {
    setFormState((current) =>
      current
        ? {
            ...current,
            leaderEngagements: [
              ...current.leaderEngagements,
              createEmptyLeadershipDevelopmentLeader(),
            ],
          }
        : current,
    );
  }

  function removeLeader(index: number) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      const nextLeaders = current.leaderEngagements.filter(
        (_, leaderIndex) => leaderIndex !== index,
      );

      return {
        ...current,
        leaderEngagements:
          nextLeaders.length > 0
            ? nextLeaders
            : [createEmptyLeadershipDevelopmentLeader()],
      };
    });
  }

  function addCompetency() {
    setFormState((current) =>
      current
        ? {
            ...current,
            competencies: [
              ...current.competencies,
              createEmptyLeadershipDevelopmentCompetency(),
            ],
          }
        : current,
    );
  }

  function removeCompetency(index: number) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      const nextCompetencies = current.competencies.filter(
        (_, competencyIndex) => competencyIndex !== index,
      );

      return {
        ...current,
        competencies:
          nextCompetencies.length > 0
            ? nextCompetencies
            : [createEmptyLeadershipDevelopmentCompetency()],
      };
    });
  }

  function addReviewerFeedback() {
    setFormState((current) =>
      current
        ? {
            ...current,
            reviewerFeedback: [
              ...current.reviewerFeedback,
              createEmptyLeadershipDevelopmentFeedback(),
            ],
          }
        : current,
    );
  }

  function removeReviewerFeedback(index: number) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      const nextFeedback = current.reviewerFeedback.filter(
        (_, feedbackIndex) => feedbackIndex !== index,
      );

      return {
        ...current,
        reviewerFeedback:
          nextFeedback.length > 0
            ? nextFeedback
            : [createEmptyLeadershipDevelopmentFeedback()],
      };
    });
  }

  function handleCreateNewRecord() {
    if (!selectedAssignment) {
      return;
    }

    setPendingInitialProjectId("");
    setSelectedProjectId("");
    setSelectedRecordId("");
    setProjectDetailsOpen(false);
    setError(null);
    setSuccess(null);
    setOpenSections(createOpenSectionState());
    setFormState(createDraftRecordForAssignment(selectedAssignment));
  }

  function handleSave(nextStatus: LeadershipDevelopmentRecordPayload["status"]) {
    if (!formState || !selectedAssignment || !storageReady) {
      return;
    }

    setError(null);
    setSuccess(null);

    const payload: LeadershipDevelopmentRecordPayload = {
      ...formState,
      candidateName: selectedAssignment.candidateName,
      targetRole: selectedAssignment.roleTitle,
      primaryMentor: selectedAssignment.mentorName,
      status: nextStatus,
    };

    startTransition(async () => {
      const response = await fetch("/api/mentoring/leadership-development-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        record?: {
          id: string;
          updatedAt: string;
          averageFeedbackScore: number | null;
        };
      };

      if (!response.ok || !result.record) {
        setError(result.error ?? "Unable to save the leadership development record.");
        return;
      }

      const nextRecord = normalizeLeadershipDevelopmentRecord({
        ...payload,
        id: result.record.id,
        updatedAt: result.record.updatedAt,
        averageFeedbackScore: result.record.averageFeedbackScore,
      });

      const assignmentKey = getAssignmentKey(selectedAssignment);

      setRecordsByAssignmentKey((current) => {
        const existingRecords = current[assignmentKey] ?? [];
        const nextRecords = existingRecords.some((record) => record.id === nextRecord.id)
          ? existingRecords.map((record) =>
              record.id === nextRecord.id ? nextRecord : record,
            )
          : [nextRecord, ...existingRecords];

        return {
          ...current,
          [assignmentKey]: nextRecords,
        };
      });
      setSelectedRecordId(nextRecord.id);
      setFormState(nextRecord);
      setSuccess(result.message ?? "Leadership development record saved.");
    });
  }

  if (assignments.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Leadership Development Record
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Start with a mentoring assignment
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Create a mentor assignment first. Once a candidate is tied to a role and mentor,
          this living development record can be created for that role track.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Leadership Development Record
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            One living record for a real development experience
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
            Use this record to assign a stretch experience, define the competencies being
            developed, identify leaders the mentee should learn from, collect feedback,
            and close the loop with a mentor review.
          </p>
        </div>
      </div>

      {!storageReady ? (
        <article className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
          Leadership development record storage is not active yet. Run the latest Supabase
          migration, then this form will save drafts normally.
        </article>
      ) : null}

      <div className="mt-6 grid gap-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Candidate role track
            </span>
            <select
              value={selectedAssignmentKey}
              onChange={(event) => {
                const nextAssignmentKey = event.target.value;
                const nextAssignment =
                  assignments.find(
                    (assignment) => getAssignmentKey(assignment) === nextAssignmentKey,
                  ) ?? null;

                setSelectedAssignmentKey(nextAssignmentKey);
                setPendingInitialProjectId("");
                setSelectedProjectId("");
                setSelectedRecordId("");
                setProjectDetailsOpen(false);
                setOpenSections(createOpenSectionState());
                setError(null);
                setSuccess(null);

                if (nextAssignment) {
                  setFormState(createDraftRecordForAssignment(nextAssignment));
                }
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            >
              {assignments.map((assignment) => (
                <option
                  key={getAssignmentKey(assignment)}
                  value={getAssignmentKey(assignment)}
                >
                  {assignment.candidateName} • {assignment.roleTitle} • {assignment.mentorName}
                </option>
              ))}
            </select>
          </label>

          {selectedAssignment && formState ? (
            <button
              type="button"
              onClick={handleCreateNewRecord}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Start New Record
            </button>
          ) : null}
        </div>

        {selectedAssignment && formState ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Review Past Record, Create New Record, or Start from Selected Project
                </span>
                <select
                  value={createSelectorValue({
                    selectedRecordId,
                    selectedProjectId,
                  })}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    setPendingInitialProjectId("");
                    setError(null);
                    setSuccess(null);
                    setOpenSections(createOpenSectionState());

                    if (!nextValue) {
                      handleCreateNewRecord();
                      return;
                    }

                    if (nextValue.startsWith("project:")) {
                      const nextProjectId = nextValue.slice("project:".length);
                      const nextProject =
                        currentSourceProjects.find(
                          (project) => project.id === nextProjectId,
                        ) ?? null;

                      if (nextProject) {
                        applySelectedProject(selectedAssignment, nextProject);
                      }

                      return;
                    }

                    const nextRecordId = nextValue.startsWith("record:")
                      ? nextValue.slice("record:".length)
                      : nextValue;
                    applySelectedRecord(selectedAssignment, currentRecords, nextRecordId);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                >
                  <option value="">Create a new development record</option>
                  {currentSourceProjects.map((project) => (
                    <option key={project.id} value={`project:${project.id}`}>
                      Start from project: {project.title}
                    </option>
                  ))}
                  {currentRecords.map((record) => (
                    <option key={record.id} value={`record:${record.id}`}>
                      {createRecordLabel(record)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Source projects selected from the candidate workspace appear here so
                  you can turn them into a detailed development record without retyping
                  the project summary.
                </p>
              </label>
            </div>

            {linkedSourceProject ? (
              <article className="rounded-2xl border border-teal-200 bg-teal-50/60 px-5 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                      Source Project
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">
                      {linkedSourceProject.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {linkedSourceProject.projectType}
                      {linkedSourceProject.durationDays
                        ? ` • ${linkedSourceProject.durationDays} days`
                        : ""}
                      {linkedSourceProject.focusCompetency
                        ? ` • Focus competency: ${linkedSourceProject.focusCompetency}`
                        : ""}
                    </p>
                    {selectedProjectId ? (
                      <p className="mt-2 text-sm leading-7 text-teal-900">
                        This draft is being built from the selected project. Save it when
                        you are ready to turn it into a formal leadership development
                        record.
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setProjectDetailsOpen((current) => !current)}
                    className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
                  >
                    {projectDetailsOpen ? "Hide Project Details" : "Show Project Details"}
                  </button>
                </div>

                {projectDetailsOpen ? (
                  <div className="mt-4 grid gap-3">
                    {linkedSourceProject.description ? (
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Project Summary
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {linkedSourceProject.description}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      {linkedSourceProject.purpose ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Purpose
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.purpose}
                          </p>
                        </div>
                      ) : null}
                      {linkedSourceProject.workingGoal ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Working Goal
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.workingGoal}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {linkedSourceProject.whyItFits ? (
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Why It Fits
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {linkedSourceProject.whyItFits}
                        </p>
                      </div>
                    ) : null}

                    {linkedSourceProject.mentorFocus || linkedSourceProject.firstStep ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {linkedSourceProject.mentorFocus ? (
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                              Mentor Focus
                            </p>
                            <p className="mt-2 text-sm leading-7 text-slate-700">
                              {linkedSourceProject.mentorFocus}
                            </p>
                          </div>
                        ) : null}
                        {linkedSourceProject.firstStep ? (
                          <div className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                              First Step
                            </p>
                            <p className="mt-2 text-sm leading-7 text-slate-700">
                              {linkedSourceProject.firstStep}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      {linkedSourceProject.keyPartners.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Key Partners
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.keyPartners.map((partner) => (
                              <li key={partner}>• {partner}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.leadershipActionsRequired.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Leadership Actions Required
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.leadershipActionsRequired.map((action) => (
                              <li key={action}>• {action}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.anticipatedChallenges.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Anticipated Challenges
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.anticipatedChallenges.map((challenge) => (
                              <li key={challenge}>• {challenge}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.successMeasures.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Success Measures
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.successMeasures.map((measure) => (
                              <li key={measure}>• {measure}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {linkedSourceProject.mentorPreparation.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Mentor Preparation
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.mentorPreparation.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.menteePreparation.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Mentee Preparation
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.menteePreparation.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.reflectionQuestions.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Reflection Prompts
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.reflectionQuestions.map((question) => (
                              <li key={question}>• {question}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {linkedSourceProject.successSignals.length > 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-4">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Success Signals
                          </p>
                          <ul className="mt-2 space-y-1 text-sm leading-7 text-slate-700">
                            {linkedSourceProject.successSignals.map((signal) => (
                              <li key={signal}>• {signal}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            ) : null}

            {isLoading ? (
              <p className="text-sm text-slate-600">Loading leadership development records...</p>
            ) : null}

            {[
              {
                id: "candidate-information" as const,
                title: "1. Candidate Information",
                body: (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Candidate Name
                      </span>
                      <input
                        value={formState.candidateName}
                        readOnly
                        className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Target Role
                      </span>
                      <input
                        value={formState.targetRole}
                        readOnly
                        className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Primary Mentor
                      </span>
                      <input
                        value={formState.primaryMentor}
                        readOnly
                        className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Date Assigned
                      </span>
                      <input
                        type="date"
                        value={formState.dateAssigned}
                        onChange={(event) => updateRecord("dateAssigned", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Development Record Status
                      </span>
                      <select
                        value={formState.status}
                        onChange={(event) =>
                          updateRecord(
                            "status",
                            event.target.value as LeadershipDevelopmentRecordPayload["status"],
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        {LEADERSHIP_DEVELOPMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {getStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ),
              },
              {
                id: "development-experience" as const,
                title: "2. Develop the Experience",
                body: (
                  <div className="grid gap-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Experience / Project Title
                      </span>
                      <input
                        value={formState.experienceTitle}
                        onChange={(event) => updateRecord("experienceTitle", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        What will the mentee be asked to do?
                      </span>
                      <textarea
                        value={formState.menteeTask}
                        onChange={(event) => updateRecord("menteeTask", event.target.value)}
                        maxLength={1500}
                        className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {formState.menteeTask.length} / 1500 characters
                      </p>
                    </label>
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-700">Leader Engagement</p>
                        <button
                          type="button"
                          onClick={addLeader}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Add Leader
                        </button>
                      </div>
                      {formState.leaderEngagements.map((leader, index) => (
                        <article
                          key={`leader-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_auto_auto] xl:items-end">
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Leader Name
                              </span>
                              <input
                                value={leader.leaderName}
                                onChange={(event) =>
                                  updateLeader(index, "leaderName", event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Department
                              </span>
                              <input
                                value={leader.department}
                                onChange={(event) =>
                                  updateLeader(index, "department", event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Purpose
                              </span>
                              <input
                                value={leader.purpose}
                                onChange={(event) =>
                                  updateLeader(index, "purpose", event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                              />
                            </label>
                            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={leader.meetingCompleted}
                                onChange={(event) =>
                                  updateLeader(index, "meetingCompleted", event.target.checked)
                                }
                              />
                              Meeting Completed
                            </label>
                            <button
                              type="button"
                              onClick={() => removeLeader(index)}
                              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                id: "development-focus" as const,
                title: "3. Development Focus",
                body: (
                  <div className="grid gap-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Growth Areas</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {LEADERSHIP_DEVELOPMENT_GROWTH_AREAS.map((growthArea) => {
                          const isActive = formState.growthAreas.includes(growthArea);

                          return (
                            <button
                              key={growthArea}
                              type="button"
                              onClick={() => toggleGrowthArea(growthArea)}
                              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                                isActive
                                  ? "border-teal-900 bg-teal-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {growthArea}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Why was this development experience assigned?
                      </span>
                      <textarea
                        value={formState.assignmentReason}
                        onChange={(event) => updateRecord("assignmentReason", event.target.value)}
                        maxLength={1000}
                        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {formState.assignmentReason.length} / 1000 characters
                      </p>
                    </label>
                  </div>
                ),
              },
              {
                id: "competency-scoring" as const,
                title: "4. Competency Scoring",
                body: (
                  <div className="grid gap-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Competencies being developed
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Scores use the 1–5 development scale. Current score may stay blank until a review is completed.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addCompetency}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Add Competency
                      </button>
                    </div>
                    {formState.competencies.map((competency, index) => {
                      const improvement = calculateLeadershipDevelopmentImprovement(
                        competency.baselineScore,
                        competency.currentScore,
                      );
                      const gapRemaining = calculateLeadershipDevelopmentGapRemaining(
                        competency.targetScore,
                        competency.currentScore,
                      );

                      return (
                        <article
                          key={`competency-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="grid gap-4 xl:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))_auto] xl:items-end">
                            <label className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                Competency Name
                              </span>
                              <input
                                value={competency.competencyName}
                                onChange={(event) =>
                                  updateCompetency(index, "competencyName", event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                              />
                            </label>
                            {[
                              { label: "Baseline", field: "baselineScore" as const, allowBlank: false },
                              { label: "Target", field: "targetScore" as const, allowBlank: false },
                              { label: "Current", field: "currentScore" as const, allowBlank: true },
                            ].map((item) => (
                              <label key={`${item.field}-${index}`} className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">
                                  {item.label} Score
                                </span>
                                <select
                                  value={competency[item.field]}
                                  onChange={(event) =>
                                    updateCompetency(index, item.field, event.target.value)
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                                >
                                  <option value="">{item.allowBlank ? "Blank" : "Select"}</option>
                                  {[1, 2, 3, 4, 5].map((score) => (
                                    <option key={score} value={String(score)}>
                                      {score}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                            <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                                Improvement
                              </p>
                              <p className="mt-2 font-semibold text-slate-900">
                                {improvement === null ? "Pending" : improvement}
                              </p>
                            </article>
                            <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                                Gap Remaining
                              </p>
                              <p className="mt-2 font-semibold text-slate-900">
                                {gapRemaining === null ? "Pending" : gapRemaining}
                              </p>
                            </article>
                            <button
                              type="button"
                              onClick={() => removeCompetency(index)}
                              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ),
              },
              {
                id: "leader-feedback" as const,
                title: "5. Leader Feedback",
                body: (
                  <div className="grid gap-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Reviewer feedback history
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Each submission is stored separately and contributes to the candidate’s progress history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addReviewerFeedback}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Add Reviewer Feedback
                      </button>
                    </div>
                    {formState.reviewerFeedback.map((feedback, index) => (
                      <article
                        key={`feedback-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Reviewer Name
                            </span>
                            <input
                              value={feedback.reviewerName}
                              onChange={(event) =>
                                updateFeedback(index, "reviewerName", event.target.value)
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Reviewer Role
                            </span>
                            <input
                              value={feedback.reviewerRole}
                              onChange={(event) =>
                                updateFeedback(index, "reviewerRole", event.target.value)
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Review Date
                            </span>
                            <input
                              type="date"
                              value={feedback.reviewDate}
                              onChange={(event) =>
                                updateFeedback(index, "reviewDate", event.target.value)
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                            />
                          </label>
                          {[
                            ["growthScore", "Demonstrated growth"],
                            ["communicationScore", "Communicated effectively"],
                            ["collaborationScore", "Worked well with others"],
                            ["feedbackApplicationScore", "Applied feedback"],
                            ["readinessScore", "Readiness for responsibility"],
                          ].map(([field, label]) => (
                            <label key={`${field}-${index}`} className="block">
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                {label}
                              </span>
                              <select
                                value={feedback[field as keyof typeof feedback]}
                                onChange={(event) =>
                                  updateFeedback(
                                    index,
                                    field as keyof LeadershipDevelopmentRecordPayload["reviewerFeedback"][number],
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                              >
                                <option value="">Select</option>
                                {[1, 2, 3, 4, 5].map((score) => (
                                  <option key={score} value={String(score)}>
                                    {score}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <label className="block md:col-span-2 xl:col-span-3">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Brief comments / evidence
                            </span>
                            <textarea
                              value={feedback.evidenceComments}
                              onChange={(event) =>
                                updateFeedback(index, "evidenceComments", event.target.value)
                              }
                              maxLength={1000}
                              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                            />
                          </label>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeReviewerFeedback(index)}
                            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Remove Feedback
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ),
              },
              {
                id: "mentor-review" as const,
                title: "6. Mentor Review",
                body: (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        What improvement was observed?
                      </span>
                      <textarea
                        value={formState.mentorImprovementObserved}
                        onChange={(event) =>
                          updateRecord("mentorImprovementObserved", event.target.value)
                        }
                        maxLength={1000}
                        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        What still needs development?
                      </span>
                      <textarea
                        value={formState.mentorDevelopmentNeeded}
                        onChange={(event) =>
                          updateRecord("mentorDevelopmentNeeded", event.target.value)
                        }
                        maxLength={1000}
                        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Readiness Signal
                      </span>
                      <select
                        value={formState.readinessSignal}
                        onChange={(event) =>
                          updateRecord(
                            "readinessSignal",
                            event.target.value as LeadershipDevelopmentRecordPayload["readinessSignal"],
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        <option value="">Select</option>
                        {LEADERSHIP_DEVELOPMENT_READINESS_SIGNALS.map((signal) => (
                          <option key={signal} value={signal}>
                            {getReadinessLabel(signal)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Mentor Review Date
                      </span>
                      <input
                        type="date"
                        value={formState.mentorReviewDate}
                        onChange={(event) => updateRecord("mentorReviewDate", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Next Recommended Development Experience
                      </span>
                      <textarea
                        value={formState.nextRecommendedExperience}
                        onChange={(event) =>
                          updateRecord("nextRecommendedExperience", event.target.value)
                        }
                        maxLength={1000}
                        className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      />
                    </label>
                  </div>
                ),
              },
            ].map((section) => (
              <article key={section.id} className="rounded-[1.5rem] border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                >
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{section.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {section.id === "candidate-information"
                        ? "Set the track, date, and current status."
                        : section.id === "development-focus"
                          ? "Capture why this experience matters and where growth should happen."
                          : section.id === "development-experience"
                            ? "Define the actual work and the leaders involved."
                            : section.id === "competency-scoring"
                              ? "Baseline, target, and current scores quantify progress over time."
                              : section.id === "leader-feedback"
                                ? "Store reviewer observations separately while keeping one living record."
                                : "Close the experience with an honest mentor review and next step."}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {openSections[section.id] ? "Collapse" : "Expand"}
                  </span>
                </button>
                {openSections[section.id] ? (
                  <div className="border-t border-slate-200 px-5 py-5">{section.body}</div>
                ) : null}
              </article>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(getDraftStatus(formState))}
                disabled={isPending || !storageReady}
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {isPending ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("ready_for_review")}
                disabled={isPending || !storageReady}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isPending ? "Saving..." : "Submit Feedback"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("completed")}
                disabled={
                  isPending ||
                  !storageReady ||
                  !isLeadershipDevelopmentMentorReviewComplete(formState)
                }
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isPending ? "Saving..." : "Complete Mentor Review"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("completed")}
                disabled={
                  isPending ||
                  !storageReady ||
                  !isLeadershipDevelopmentMentorReviewComplete(formState)
                }
                className="rounded-full border border-teal-200 bg-teal-50 px-5 py-3 text-sm font-semibold text-teal-950 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:bg-teal-100 disabled:text-teal-700/60"
              >
                {isPending ? "Saving..." : "Mark Completed"}
              </button>
              {selectedRecord ? (
                <p className="text-sm text-slate-500">
                  Last saved {new Date(selectedRecord.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="text-sm text-teal-700">{success}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
