"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  formatLeadershipDevelopmentScore,
  formatLeadershipDevelopmentScoreDelta,
  isLeadershipDevelopmentMentorReviewComplete,
  normalizeLeadershipDevelopmentRecord,
  type LeadershipDevelopmentRecordPayload,
  type LeadershipDevelopmentRecordRecord,
} from "@/lib/leadership-development-record";
import {
  buildLeadershipDevelopmentRecordProjectDetails,
  buildLeadershipDevelopmentRecordFromProject,
  type MentoringSourceProject,
} from "@/lib/mentoring-source-project";
import {
  buildPendingMentoringTransferProject,
  clearPendingMentoringProjectTransfer,
  readPendingMentoringProjectTransfer,
} from "@/lib/pending-mentoring-project-transfer";

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

type LeadershipDevelopmentCompetencyOption = {
  competencyId: string;
  competencyName: string;
  candidateScore: number;
  targetScore: number;
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

function normalizeCompetencyName(value: string) {
  return value.trim().toLowerCase();
}

function buildCompetencyOptionMap(
  options: LeadershipDevelopmentCompetencyOption[],
) {
  return new Map(
    options.map((option) => [normalizeCompetencyName(option.competencyName), option]),
  );
}

function applyCompetencyScoreDefaults(
  competencies: LeadershipDevelopmentRecordPayload["competencies"],
  options: LeadershipDevelopmentCompetencyOption[],
) {
  if (options.length === 0) {
    return competencies;
  }

  const optionMap = buildCompetencyOptionMap(options);

  return competencies.map((competency) => {
    const matchedOption = optionMap.get(
      normalizeCompetencyName(competency.competencyName),
    );

    if (!matchedOption) {
      return competency;
    }

    return {
      ...competency,
      competencyName: matchedOption.competencyName,
      baselineScore:
        competency.baselineScore.trim().length > 0
          ? competency.baselineScore
          : formatLeadershipDevelopmentScore(matchedOption.candidateScore),
      targetScore:
        competency.targetScore.trim().length > 0
          ? competency.targetScore
          : formatLeadershipDevelopmentScore(matchedOption.targetScore),
    };
  });
}

function createPrefilledCompetencyFromOption(
  option: LeadershipDevelopmentCompetencyOption | null,
) {
  return option
    ? {
        ...createEmptyLeadershipDevelopmentCompetency(),
        competencyName: option.competencyName,
        baselineScore: formatLeadershipDevelopmentScore(option.candidateScore),
        targetScore: formatLeadershipDevelopmentScore(option.targetScore),
      }
    : createEmptyLeadershipDevelopmentCompetency();
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
  competencyOptions: LeadershipDevelopmentCompetencyOption[] = [],
) {
  const draft = createEmptyLeadershipDevelopmentRecord({
    candidateId: selectedAssignment.candidateId,
    roleId: selectedAssignment.roleId,
    mentorId: selectedAssignment.mentorProfileId,
    candidateName: selectedAssignment.candidateName,
    targetRole: selectedAssignment.roleTitle,
    primaryMentor: selectedAssignment.mentorName,
    dateAssigned:
      selectedAssignment.startDate ?? new Date().toISOString().slice(0, 10),
  });

  if (competencyOptions.length === 0) {
    return draft;
  }

  return {
    ...draft,
    competencies: competencyOptions.map((option) =>
      createPrefilledCompetencyFromOption(option),
    ),
  };
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

function withAssignmentCompetencyDefaults<
  T extends LeadershipDevelopmentRecordPayload | LeadershipDevelopmentRecordRecord,
>(
  record: T,
  competencyOptions: LeadershipDevelopmentCompetencyOption[],
) {
  return {
    ...record,
    competencies: applyCompetencyScoreDefaults(record.competencies, competencyOptions),
  } satisfies T;
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

  const normalizedSourceProjectAssignmentId =
    record.sourceProjectAssignmentId.trim().toLowerCase();
  const normalizedExperienceTitle = record.experienceTitle.trim().toLowerCase();

  return (
    sourceProjects.find(
      (project) =>
        (normalizedSourceProjectAssignmentId.length > 0 &&
          project.id.trim().toLowerCase() === normalizedSourceProjectAssignmentId) ||
        project.title.trim().toLowerCase() === normalizedExperienceTitle,
    ) ?? null
  );
}

function createRecordDeduplicationKey(record: LeadershipDevelopmentRecordRecord) {
  const sourceProjectKey = record.sourceProjectAssignmentId.trim();

  if (sourceProjectKey.length > 0) {
    return `project:${sourceProjectKey}`;
  }

  return `title:${record.experienceTitle.trim().toLowerCase()}`;
}

function dedupeLeadershipDevelopmentRecords(
  records: LeadershipDevelopmentRecordRecord[],
) {
  const seenKeys = new Set<string>();

  return records.filter((record) => {
    const recordKey = createRecordDeduplicationKey(record);

    if (seenKeys.has(recordKey)) {
      return false;
    }

    seenKeys.add(recordKey);
    return true;
  });
}

function normalizeProjectRecordComparisonValue(value: string) {
  return value.trim().toLowerCase();
}

function findRecordForProject(
  project: MentoringSourceProject,
  records: LeadershipDevelopmentRecordRecord[],
) {
  const normalizedProjectId = normalizeProjectRecordComparisonValue(project.id);
  const normalizedProjectTitle = normalizeProjectRecordComparisonValue(project.title);

  return (
    records.find((record) => {
      const normalizedRecordSourceProjectId = normalizeProjectRecordComparisonValue(
        record.sourceProjectAssignmentId,
      );
      const normalizedRecordTitle = normalizeProjectRecordComparisonValue(
        record.experienceTitle,
      );

      return (
        (normalizedRecordSourceProjectId.length > 0 &&
          normalizedRecordSourceProjectId === normalizedProjectId) ||
        normalizedRecordTitle === normalizedProjectTitle
      );
    }) ?? null
  );
}

function clearStickySelectionParamsFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  const hadProjectId = nextUrl.searchParams.has("projectId");
  const hadRecordId = nextUrl.searchParams.has("recordId");

  if (!hadProjectId && !hadRecordId) {
    return;
  }

  nextUrl.searchParams.delete("projectId");
  nextUrl.searchParams.delete("recordId");
  window.history.replaceState(window.history.state, "", nextUrl.toString());
}

function parseProjectDetailList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatProjectDetailList(items: string[]) {
  return items.join("\n");
}

function hasTransferredProjectDetails(
  record: LeadershipDevelopmentRecordPayload | LeadershipDevelopmentRecordRecord,
) {
  return (
    [
      record.projectSummary,
      record.projectPurpose,
      record.workingGoal,
      record.whyItFits,
      record.mentorFocus,
      record.firstStep,
    ].some((value) => value.trim().length > 0) ||
    [
      record.keyPartners,
      record.leadershipActionsRequired,
      record.anticipatedChallenges,
      record.successMeasures,
      record.mentorPreparation,
      record.menteePreparation,
      record.reflectionQuestions,
      record.successSignals,
    ].some((items) => items.length > 0)
  );
}

function ProjectDetailTextCard({
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4">
      <label className="block">
        <span className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={rows}
          className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
        />
      </label>
    </div>
  );
}

function ProjectDetailListCard({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4">
      <label className="block">
        <span className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </span>
        <textarea
          value={formatProjectDetailList(values)}
          onChange={(event) => onChange(parseProjectDetailList(event.target.value))}
          rows={5}
          className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
        />
        <p className="mt-2 text-xs text-slate-500">Enter one item per line.</p>
      </label>
    </div>
  );
}

export function LeadershipDevelopmentRecordManager({
  assignments,
  initialSelectedAssignmentKey,
  initialSelectedProjectId,
  initialSelectedRecordId,
}: {
  assignments: LeadershipDevelopmentAssignmentOption[];
  initialSelectedAssignmentKey?: string | null;
  initialSelectedProjectId?: string | null;
  initialSelectedRecordId?: string | null;
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
  const [pendingInitialRecordId, setPendingInitialRecordId] = useState(
    initialSelectedRecordId ?? "",
  );
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(
    Boolean(initialSelectedProjectId),
  );
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [recordsByAssignmentKey, setRecordsByAssignmentKey] = useState<
    Record<string, LeadershipDevelopmentRecordRecord[]>
  >({});
  const [competencyOptionsByAssignmentKey, setCompetencyOptionsByAssignmentKey] =
    useState<Record<string, LeadershipDevelopmentCompetencyOption[]>>({});
  const [sourceProjectsByAssignmentKey, setSourceProjectsByAssignmentKey] = useState<
    Record<string, MentoringSourceProject[]>
  >({});
  const [formState, setFormState] = useState<LeadershipDevelopmentRecordPayload | null>(
    null,
  );
  const [openSections, setOpenSections] = useState(createOpenSectionState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectionRevisionRef = useRef(0);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedRecordIdRef = useRef(selectedRecordId);
  const pendingInitialProjectIdRef = useRef(pendingInitialProjectId);
  const pendingInitialRecordIdRef = useRef(pendingInitialRecordId);

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
  const currentCompetencyOptions = selectedAssignment
    ? competencyOptionsByAssignmentKey[getAssignmentKey(selectedAssignment)] ?? []
    : [];
  const pendingTransferredProject = useMemo(() => {
    if (!selectedAssignment) {
      return null;
    }

    const pendingTransfer = readPendingMentoringProjectTransfer();

    if (!pendingTransfer) {
      return null;
    }

    if (
      pendingTransfer.candidateId !== selectedAssignment.candidateId ||
      pendingTransfer.roleId !== selectedAssignment.roleId ||
      (pendingTransfer.mentorProfileId &&
        pendingTransfer.mentorProfileId !== selectedAssignment.mentorProfileId)
    ) {
      return null;
    }

    return buildPendingMentoringTransferProject({
      roleTitle: selectedAssignment.roleTitle,
      startDate: selectedAssignment.startDate,
      transfer: pendingTransfer,
    });
  }, [selectedAssignment]);
  const visibleSourceProjects =
    pendingTransferredProject &&
    !currentSourceProjects.some(
      (project) =>
        project.id === pendingTransferredProject.id ||
        project.projectId === pendingTransferredProject.projectId,
    )
      ? [pendingTransferredProject, ...currentSourceProjects]
      : currentSourceProjects;
  const selectedRecord =
    currentRecords.find((record) => record.id === selectedRecordId) ?? null;
  const selectedSourceProject =
    visibleSourceProjects.find((project) => project.id === selectedProjectId) ?? null;
  const linkedSourceProject =
    selectedSourceProject ??
    findLinkedProjectForRecord(selectedRecord, visibleSourceProjects);
  const shouldShowTransferredProjectEditor = Boolean(
    linkedSourceProject || (formState && hasTransferredProjectDetails(formState)),
  );

  useEffect(() => {
    const nextAssignmentKey =
      initialSelectedAssignmentKey &&
      assignments.some(
        (assignment) => getAssignmentKey(assignment) === initialSelectedAssignmentKey,
      )
        ? initialSelectedAssignmentKey
        : null;

    if (nextAssignmentKey && nextAssignmentKey !== selectedAssignmentKey) {
      queueMicrotask(() => {
        setSelectedAssignmentKey(nextAssignmentKey);
      });
    }
  }, [assignments, initialSelectedAssignmentKey, selectedAssignmentKey]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    selectedRecordIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  useEffect(() => {
    pendingInitialProjectIdRef.current = pendingInitialProjectId;
  }, [pendingInitialProjectId]);

  useEffect(() => {
    pendingInitialRecordIdRef.current = pendingInitialRecordId;
  }, [pendingInitialRecordId]);

  function applySelectedRecord(
    nextSelectedAssignment: LeadershipDevelopmentAssignmentOption,
    records: LeadershipDevelopmentRecordRecord[],
    nextRecordId: string,
    competencyOptions: LeadershipDevelopmentCompetencyOption[] = [],
    options?: {
      userInitiated?: boolean;
    },
  ) {
    if (options?.userInitiated) {
      selectionRevisionRef.current += 1;
    }

    setSelectedProjectId("");
    setSelectedRecordId(nextRecordId);
    const nextRecord = nextRecordId
      ? withAssignmentCompetencyDefaults(
          normalizeLeadershipDevelopmentRecord(
            records.find((record) => record.id === nextRecordId) ?? records[0],
          ),
          competencyOptions,
        )
      : null;
    const matchingSourceProject = nextRecord
      ? findLinkedProjectForRecord(
          nextRecord,
          sourceProjectsByAssignmentKey[getAssignmentKey(nextSelectedAssignment)] ?? [],
        )
      : null;

    setFormState(
      nextRecord
        ? withAssignmentCompetencyDefaults(
            syncRecordWithAssignment(
              hasTransferredProjectDetails(nextRecord) || !matchingSourceProject
                ? nextRecord
                : {
                    ...nextRecord,
                    ...buildLeadershipDevelopmentRecordProjectDetails(
                      matchingSourceProject,
                    ),
                  },
              nextSelectedAssignment,
            ),
            competencyOptions,
          )
        : createDraftRecordForAssignment(nextSelectedAssignment, competencyOptions),
    );
  }

  function applySelectedProject(
    nextSelectedAssignment: LeadershipDevelopmentAssignmentOption,
    project: MentoringSourceProject,
    competencyOptions: LeadershipDevelopmentCompetencyOption[] = [],
    options?: {
      userInitiated?: boolean;
    },
  ) {
    if (options?.userInitiated) {
      selectionRevisionRef.current += 1;
    }

    const matchingRecord =
      findRecordForProject(
        project,
        recordsByAssignmentKey[getAssignmentKey(nextSelectedAssignment)] ?? [],
      ) ?? null;

    setSelectedRecordId(matchingRecord?.id ?? "");
    setSelectedProjectId(project.id);
    setProjectDetailsOpen(true);
    setFormState(
      withAssignmentCompetencyDefaults(
        buildLeadershipDevelopmentRecordFromProject({
          assignment: nextSelectedAssignment,
          project,
        }),
        competencyOptions,
      ),
    );
  }

  useEffect(() => {
    if (!selectedAssignment) {
      return;
    }

    const controller = new AbortController();
    const selectionRevisionAtLoad = selectionRevisionRef.current;

    async function loadRecords() {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const params = new URLSearchParams({
        candidateId: selectedAssignment.candidateId,
        roleId: selectedAssignment.roleId,
        mentorId: selectedAssignment.mentorProfileId,
      });

      const requestedProjectId = pendingInitialProjectIdRef.current;

      if (requestedProjectId) {
        params.set("projectId", requestedProjectId);
      }

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
          competencyAssessments?: LeadershipDevelopmentCompetencyOption[];
        };
        const assignmentKey = getAssignmentKey(selectedAssignment);

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
            [assignmentKey]: [],
          }));
          setCompetencyOptionsByAssignmentKey((current) => ({
            ...current,
            [assignmentKey]: [],
          }));
          setSelectedProjectId("");
          setSelectedRecordId("");
          setFormState(createDraftRecordForAssignment(selectedAssignment, []));
          setError(payload.error ?? "Unable to load leadership development records.");
          return;
        }

        setStorageReady(true);
        const records = dedupeLeadershipDevelopmentRecords(
          (payload.records ?? []).map((record) =>
            normalizeLeadershipDevelopmentRecord(record),
          ),
        );
        const sourceProjects = payload.projects ?? [];
        const competencyOptions = payload.competencyAssessments ?? [];

        setRecordsByAssignmentKey((current) => ({
          ...current,
          [assignmentKey]: records,
        }));
        setSourceProjectsByAssignmentKey((current) => ({
          ...current,
          [assignmentKey]: sourceProjects,
        }));
        setCompetencyOptionsByAssignmentKey((current) => ({
          ...current,
          [assignmentKey]: competencyOptions,
        }));

        const applyLoadedRecord = (nextRecordId: string) => {
          setSelectedProjectId("");
          setSelectedRecordId(nextRecordId);
          const nextRecord = nextRecordId
            ? withAssignmentCompetencyDefaults(
                normalizeLeadershipDevelopmentRecord(
                  records.find((record) => record.id === nextRecordId) ?? records[0],
                ),
                competencyOptions,
              )
            : null;
          const matchingSourceProject = nextRecord
            ? findLinkedProjectForRecord(nextRecord, sourceProjects)
            : null;

          setFormState(
            nextRecord
              ? withAssignmentCompetencyDefaults(
                  syncRecordWithAssignment(
                    hasTransferredProjectDetails(nextRecord) || !matchingSourceProject
                      ? nextRecord
                      : {
                          ...nextRecord,
                          ...buildLeadershipDevelopmentRecordProjectDetails(
                            matchingSourceProject,
                          ),
                        },
                    selectedAssignment,
                  ),
                  competencyOptions,
                )
              : createDraftRecordForAssignment(selectedAssignment, competencyOptions),
          );
        };

        const applyLoadedProject = (project: MentoringSourceProject) => {
          const matchingRecord = findRecordForProject(project, records) ?? null;

          setSelectedRecordId(matchingRecord?.id ?? "");
          setSelectedProjectId(project.id);
          setProjectDetailsOpen(true);
          setFormState(
            withAssignmentCompetencyDefaults(
              buildLeadershipDevelopmentRecordFromProject({
                assignment: selectedAssignment,
                project,
              }),
              competencyOptions,
            ),
          );
        };

        const persistedSelectedProject =
          selectedProjectIdRef.current &&
          sourceProjects.some((project) => project.id === selectedProjectIdRef.current)
            ? selectedProjectIdRef.current
            : "";
        const initialProjectForRoute =
          pendingInitialProjectIdRef.current &&
          sourceProjects.some(
            (project) => project.id === pendingInitialProjectIdRef.current,
          )
            ? pendingInitialProjectIdRef.current
            : "";
        const initialRecordForRoute =
          pendingInitialRecordIdRef.current &&
          records.some((record) => record.id === pendingInitialRecordIdRef.current)
            ? pendingInitialRecordIdRef.current
            : "";
        const nextRecordId =
          selectedRecordIdRef.current &&
          records.some((record) => record.id === selectedRecordIdRef.current)
            ? selectedRecordIdRef.current
            : "";
        const shouldPreserveUserSelection =
          selectionRevisionRef.current !== selectionRevisionAtLoad;

        if (shouldPreserveUserSelection) {
          return;
        }

        if (initialProjectForRoute) {
          const matchedProject =
            sourceProjects.find((project) => project.id === initialProjectForRoute) ??
            null;

          if (matchedProject) {
            applyLoadedProject(matchedProject);
            setPendingInitialProjectId("");
            setPendingInitialRecordId("");
            clearPendingMentoringProjectTransfer();
            clearStickySelectionParamsFromUrl();
            return;
          }
        }

        if (pendingTransferredProject) {
          const matchedTransferredProject =
            sourceProjects.find(
              (project) =>
                project.id === pendingTransferredProject.id ||
                project.projectId === pendingTransferredProject.projectId ||
                project.title === pendingTransferredProject.title,
            ) ?? pendingTransferredProject;

          applyLoadedProject(matchedTransferredProject);
          clearPendingMentoringProjectTransfer();
          clearStickySelectionParamsFromUrl();
          return;
        }

        if (initialRecordForRoute) {
          applyLoadedRecord(initialRecordForRoute);
          setPendingInitialRecordId("");
          return;
        }

        if (nextRecordId) {
          applyLoadedRecord(nextRecordId);
          return;
        }

        const nextProjectId = persistedSelectedProject;

        if (nextProjectId) {
          const matchedProject =
            sourceProjects.find((project) => project.id === nextProjectId) ?? null;

          if (matchedProject) {
            applyLoadedProject(matchedProject);
            if (initialProjectForRoute === nextProjectId) {
              setPendingInitialProjectId("");
            }
            return;
          }
        }

        applyLoadedRecord(records[0]?.id ?? "");
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
  }, [
    pendingTransferredProject,
    selectedAssignment,
  ]);

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

      const nextCompetencies = current.competencies.map((competency, competencyIndex) => {
        if (competencyIndex !== index) {
          return competency;
        }

        if (field !== "competencyName") {
          return { ...competency, [field]: value };
        }

        const matchedOption =
          buildCompetencyOptionMap(currentCompetencyOptions).get(
            normalizeCompetencyName(value),
          ) ?? null;

        return matchedOption
          ? {
              ...competency,
              competencyName: matchedOption.competencyName,
              baselineScore: formatLeadershipDevelopmentScore(
                matchedOption.candidateScore,
              ),
              targetScore: formatLeadershipDevelopmentScore(matchedOption.targetScore),
            }
          : { ...competency, competencyName: value };
      });

      return {
        ...current,
        competencies: nextCompetencies,
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
              createPrefilledCompetencyFromOption(
                currentCompetencyOptions.find((option) => {
                  const usedCompetencyNames = new Set(
                    current.competencies.map((competency) =>
                      normalizeCompetencyName(competency.competencyName),
                    ),
                  );

                  return !usedCompetencyNames.has(
                    normalizeCompetencyName(option.competencyName),
                  );
                }) ?? null,
              ),
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

    selectionRevisionRef.current += 1;
    setPendingInitialProjectId("");
    setSelectedProjectId("");
    setSelectedRecordId("");
    setProjectDetailsOpen(false);
    setError(null);
    setSuccess(null);
    setOpenSections(createOpenSectionState());
    setFormState(
      createDraftRecordForAssignment(selectedAssignment, currentCompetencyOptions),
    );
  }

  function handleSave(nextStatus: LeadershipDevelopmentRecordPayload["status"]) {
    if (!formState || !selectedAssignment || !storageReady) {
      return;
    }

    setError(null);
    setSuccess(null);

    const payload: LeadershipDevelopmentRecordPayload = {
      ...formState,
      sourceProjectAssignmentId:
        selectedProjectId || linkedSourceProject?.id || formState.sourceProjectAssignmentId,
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
        const nextRecords = dedupeLeadershipDevelopmentRecords(
          existingRecords.some((record) => record.id === nextRecord.id)
            ? existingRecords.map((record) =>
                record.id === nextRecord.id ? nextRecord : record,
              )
            : [nextRecord, ...existingRecords],
        );

        return {
          ...current,
          [assignmentKey]: nextRecords,
        };
      });
      if (payload.sourceProjectAssignmentId) {
        setSelectedProjectId(payload.sourceProjectAssignmentId);
        setSelectedRecordId("");
      } else {
        setSelectedProjectId("");
        setSelectedRecordId(nextRecord.id);
      }
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

                selectionRevisionRef.current += 1;
                setSelectedAssignmentKey(nextAssignmentKey);
                setPendingInitialProjectId("");
                setSelectedProjectId("");
                setSelectedRecordId("");
                setProjectDetailsOpen(false);
                setOpenSections(createOpenSectionState());
                setError(null);
                setSuccess(null);

                if (nextAssignment) {
                  setFormState(
                    createDraftRecordForAssignment(
                      nextAssignment,
                      competencyOptionsByAssignmentKey[getAssignmentKey(nextAssignment)] ??
                        [],
                    ),
                  );
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
                        applySelectedProject(
                          selectedAssignment,
                          nextProject,
                          currentCompetencyOptions,
                          {
                            userInitiated: true,
                          },
                        );
                        clearStickySelectionParamsFromUrl();
                      }

                      return;
                    }

                    const nextRecordId = nextValue.startsWith("record:")
                      ? nextValue.slice("record:".length)
                      : nextValue;
                    applySelectedRecord(
                      selectedAssignment,
                      currentRecords,
                      nextRecordId,
                      currentCompetencyOptions,
                      {
                        userInitiated: true,
                      },
                    );
                    clearStickySelectionParamsFromUrl();
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                >
                  <option value="">Create a new development record</option>
                  {currentRecords.map((record) => (
                    <option key={record.id} value={`record:${record.id}`}>
                      Review saved record: {createRecordLabel(record)}
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

            {shouldShowTransferredProjectEditor && formState ? (
              <article className="rounded-2xl border border-teal-200 bg-teal-50/60 px-5 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                      {linkedSourceProject ? "Source Project" : "Transferred Project Details"}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">
                      {linkedSourceProject?.title || formState.experienceTitle || "Project Details"}
                    </h3>
                    {linkedSourceProject ? (
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {linkedSourceProject.projectType}
                        {linkedSourceProject.durationDays
                          ? ` • ${linkedSourceProject.durationDays} days`
                          : ""}
                        {linkedSourceProject.focusCompetency
                          ? ` • Focus competency: ${linkedSourceProject.focusCompetency}`
                          : ""}
                      </p>
                    ) : null}
                    {selectedProjectId ? (
                      <p className="mt-2 text-sm leading-7 text-teal-900">
                        This draft is being built from the selected project. You can refine
                        these transferred cards before saving the formal leadership
                        development record.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-7 text-teal-900">
                        These transferred project details are editable and will save with
                        the leadership development record.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      selectionRevisionRef.current += 1;
                      setProjectDetailsOpen((current) => !current);
                    }}
                    className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
                  >
                    {projectDetailsOpen ? "Hide Project Details" : "Show Project Details"}
                  </button>
                </div>

                {projectDetailsOpen ? (
                  <div className="mt-4 grid gap-3">
                    <ProjectDetailTextCard
                      label="Project Summary"
                      value={formState.projectSummary}
                      onChange={(value) => updateRecord("projectSummary", value)}
                      maxLength={3000}
                      rows={5}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <ProjectDetailTextCard
                        label="Purpose"
                        value={formState.projectPurpose}
                        onChange={(value) => updateRecord("projectPurpose", value)}
                        maxLength={1500}
                      />
                      <ProjectDetailTextCard
                        label="Working Goal"
                        value={formState.workingGoal}
                        onChange={(value) => updateRecord("workingGoal", value)}
                        maxLength={1500}
                      />
                    </div>

                    <ProjectDetailTextCard
                      label="Why It Fits"
                      value={formState.whyItFits}
                      onChange={(value) => updateRecord("whyItFits", value)}
                      maxLength={2000}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <ProjectDetailTextCard
                        label="Mentor Focus"
                        value={formState.mentorFocus}
                        onChange={(value) => updateRecord("mentorFocus", value)}
                        maxLength={2000}
                      />
                      <ProjectDetailTextCard
                        label="First Step"
                        value={formState.firstStep}
                        onChange={(value) => updateRecord("firstStep", value)}
                        maxLength={1500}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <ProjectDetailListCard
                        label="Key Partners"
                        values={formState.keyPartners}
                        onChange={(value) => updateRecord("keyPartners", value)}
                      />
                      <ProjectDetailListCard
                        label="Leadership Actions Required"
                        values={formState.leadershipActionsRequired}
                        onChange={(value) =>
                          updateRecord("leadershipActionsRequired", value)
                        }
                      />
                      <ProjectDetailListCard
                        label="Anticipated Challenges"
                        values={formState.anticipatedChallenges}
                        onChange={(value) => updateRecord("anticipatedChallenges", value)}
                      />
                      <ProjectDetailListCard
                        label="Success Measures"
                        values={formState.successMeasures}
                        onChange={(value) => updateRecord("successMeasures", value)}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <ProjectDetailListCard
                        label="Mentor Preparation"
                        values={formState.mentorPreparation}
                        onChange={(value) => updateRecord("mentorPreparation", value)}
                      />
                      <ProjectDetailListCard
                        label="Mentee Preparation"
                        values={formState.menteePreparation}
                        onChange={(value) => updateRecord("menteePreparation", value)}
                      />
                      <ProjectDetailListCard
                        label="Reflection Prompts"
                        values={formState.reflectionQuestions}
                        onChange={(value) => updateRecord("reflectionQuestions", value)}
                      />
                      <ProjectDetailListCard
                        label="Success Signals"
                        values={formState.successSignals}
                        onChange={(value) => updateRecord("successSignals", value)}
                      />
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
                        What strengths will assist in this project?
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
                          Candidate score and role goal auto-fill from the candidate
                          workspace when available. Current score may stay blank until a
                          review is completed.
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
                      const competencyHasMatchingOption = currentCompetencyOptions.some(
                        (option) =>
                          normalizeCompetencyName(option.competencyName) ===
                          normalizeCompetencyName(competency.competencyName),
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
                              {currentCompetencyOptions.length > 0 ? (
                                <select
                                  value={competency.competencyName}
                                  onChange={(event) =>
                                    updateCompetency(
                                      index,
                                      "competencyName",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                                >
                                  <option value="">Select competency</option>
                                  {competency.competencyName &&
                                  !competencyHasMatchingOption ? (
                                    <option value={competency.competencyName}>
                                      {competency.competencyName}
                                    </option>
                                  ) : null}
                                  {currentCompetencyOptions.map((option) => (
                                    <option
                                      key={option.competencyId}
                                      value={option.competencyName}
                                    >
                                      {option.competencyName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={competency.competencyName}
                                  onChange={(event) =>
                                    updateCompetency(
                                      index,
                                      "competencyName",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                                />
                              )}
                            </label>
                            {[
                              {
                                label: "Candidate Score",
                                field: "baselineScore" as const,
                                placeholder: "Auto-filled",
                              },
                              {
                                label: "Role Goal",
                                field: "targetScore" as const,
                                placeholder: "Auto-filled",
                              },
                              {
                                label: "Current Score",
                                field: "currentScore" as const,
                                placeholder: "Blank",
                              },
                            ].map((item) => (
                              <label key={`${item.field}-${index}`} className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">
                                  {item.label}
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  max="5"
                                  step="0.01"
                                  value={competency[item.field]}
                                  onChange={(event) =>
                                    updateCompetency(index, item.field, event.target.value)
                                  }
                                  placeholder={item.placeholder}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                                />
                              </label>
                            ))}
                            <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                                Improvement
                              </p>
                              <p className="mt-2 font-semibold text-slate-900">
                                {formatLeadershipDevelopmentScoreDelta(improvement)}
                              </p>
                            </article>
                            <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                                Gap Remaining
                              </p>
                              <p className="mt-2 font-semibold text-slate-900">
                                {formatLeadershipDevelopmentScoreDelta(gapRemaining)}
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
                              ? "Candidate score, role goal, and current score quantify progress over time."
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
