import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";
import {
  createEmptyLeadershipDevelopmentCompetency,
  createEmptyLeadershipDevelopmentLeader,
  createEmptyLeadershipDevelopmentRecord,
  type LeadershipDevelopmentRecordPayload,
} from "@/lib/leadership-development-record";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const PROJECT_TYPE_LABELS = {
  departmental: "Departmental Project",
  cross_departmental: "Cross-Departmental Project",
} as const;

const DESCRIPTION_LABELS = {
  projectType: "Project type",
  purpose: "Purpose",
  workingGoal: "Working goal",
  whyItFits: "Why it fits",
  strengthsApplication: "How strengths can help",
  mentorFocus: "Mentor focus",
  firstStep: "First step",
  keyPartners: "Key partners",
  leadershipActionsRequired: "Leadership actions required",
  mentorPreparation: "Mentor preparation",
  menteePreparation: "Mentee preparation",
  anticipatedChallenges: "Anticipated challenges",
} as const;

const MENTOR_NOTE_LABELS = {
  roleTrack: "Role track",
  focusCompetency: "Focus competency",
} as const;

const GROWTH_AREA_PATTERNS: Array<{
  growthArea: LeadershipDevelopmentRecordPayload["growthAreas"][number];
  patterns: RegExp[];
}> = [
  {
    growthArea: "Executive Communication",
    patterns: [/communication/i, /present/i, /influence/i],
  },
  {
    growthArea: "Systems Thinking",
    patterns: [/systems?/i, /strategy/i, /enterprise/i],
  },
  {
    growthArea: "Delegation",
    patterns: [/delegat/i, /handoff/i, /ownership/i],
  },
  {
    growthArea: "Accountability",
    patterns: [/accountab/i, /standards?/i, /follow[- ]through/i],
  },
  {
    growthArea: "Financial Acumen",
    patterns: [/financial/i, /budget/i, /labor/i, /cost/i],
  },
  {
    growthArea: "Conflict Management",
    patterns: [/conflict/i, /difficult/i, /tension/i],
  },
  {
    growthArea: "Change Leadership",
    patterns: [/change/i, /transition/i, /adoption/i],
  },
  {
    growthArea: "Collaboration",
    patterns: [/collaboration/i, /relational/i, /cross[- ]functional/i, /partner/i],
  },
];

export type MentoringSourceProject = {
  id: string;
  projectId: string;
  title: string;
  projectType: string;
  purpose: string;
  description: string;
  workingGoal: string;
  whyItFits: string;
  strengthsApplication: string;
  mentorFocus: string;
  firstStep: string;
  keyPartners: string[];
  leadershipActionsRequired: string[];
  mentorPreparation: string[];
  menteePreparation: string[];
  anticipatedChallenges: string[];
  successMeasures: string[];
  reflectionQuestions: string[];
  successSignals: string[];
  competencyNames: string[];
  applicableRoles: string[];
  startDate: string | null;
  dueDate: string | null;
  status: string;
  mentorNotes: string;
  roleTrackTitle: string;
  focusCompetency: string;
  durationDays: number | null;
};

function splitBulletList(value: string) {
  return value
    .split("•")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLabeledLines(
  source: string | null | undefined,
  labels: Record<string, string>,
) {
  const values = new Map<string, string>();
  const unlabeledLines: string[] = [];
  const labelEntries = Object.entries(labels);

  for (const rawLine of (source ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const labelEntry = labelEntries.find(([, label]) =>
      line.toLowerCase().startsWith(`${label.toLowerCase()}:`),
    );

    if (!labelEntry) {
      unlabeledLines.push(line);
      continue;
    }

    const [key, label] = labelEntry;
    values.set(key, line.slice(label.length + 1).trim());
  }

  return {
    values,
    unlabeledText: unlabeledLines.join("\n\n"),
  };
}

function inferGrowthAreas(project: MentoringSourceProject) {
  const sourceText = [
    project.title,
    project.purpose,
    project.workingGoal,
    project.whyItFits,
    project.focusCompetency,
    ...project.competencyNames,
  ].join(" ");

  return GROWTH_AREA_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(sourceText)),
  ).map(({ growthArea }) => growthArea);
}

export function buildCandidateSpecificProjectDescription(
  idea: GeneratedCandidateMentoringIdea,
) {
  return [
    `${DESCRIPTION_LABELS.projectType}: ${PROJECT_TYPE_LABELS[idea.project_type]}`,
    `${DESCRIPTION_LABELS.purpose}: ${idea.purpose}`,
    idea.description,
    "",
    `${DESCRIPTION_LABELS.workingGoal}: ${idea.working_goal}`,
    `${DESCRIPTION_LABELS.whyItFits}: ${idea.why_it_fits}`,
    `${DESCRIPTION_LABELS.strengthsApplication}: ${idea.strengths_application}`,
    `${DESCRIPTION_LABELS.mentorFocus}: ${idea.mentor_focus}`,
    `${DESCRIPTION_LABELS.firstStep}: ${idea.first_step}`,
    `${DESCRIPTION_LABELS.keyPartners}: ${idea.key_partners.join(", ")}`,
    `${DESCRIPTION_LABELS.leadershipActionsRequired}: ${idea.leadership_actions_required.join(" • ")}`,
    `${DESCRIPTION_LABELS.mentorPreparation}: ${idea.mentor_preparation.join(" • ")}`,
    `${DESCRIPTION_LABELS.menteePreparation}: ${idea.mentee_preparation.join(" • ")}`,
    `${DESCRIPTION_LABELS.anticipatedChallenges}: ${idea.anticipated_challenges.join(" • ")}`,
  ].join("\n");
}

export function buildMentoringProjectAssignmentNotes(options: {
  roleTitle: string;
  competencyName: string;
}) {
  return [
    `${MENTOR_NOTE_LABELS.roleTrack}: ${options.roleTitle}`,
    `${MENTOR_NOTE_LABELS.focusCompetency}: ${options.competencyName}`,
  ].join("\n");
}

export function buildMentoringSourceProject(options: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  durationDays: number | null;
  competencyNames: string[] | null;
  applicableRoles: string[] | null;
  successMeasures: string[] | null;
  reflectionQuestions: string[] | null;
  successSignals: string[] | null;
  startDate: string | null;
  dueDate: string | null;
  status: string | null;
  mentorNotes: string | null;
}) {
  const descriptionParse = parseLabeledLines(options.description, DESCRIPTION_LABELS);
  const mentorNotesParse = parseLabeledLines(options.mentorNotes, MENTOR_NOTE_LABELS);

  return {
    id: options.id,
    projectId: options.projectId,
    title: options.title,
    projectType:
      descriptionParse.values.get("projectType") ?? "Candidate-Specific Project",
    purpose: descriptionParse.values.get("purpose") ?? "",
    description: descriptionParse.unlabeledText,
    workingGoal: descriptionParse.values.get("workingGoal") ?? "",
    whyItFits: descriptionParse.values.get("whyItFits") ?? "",
    strengthsApplication:
      descriptionParse.values.get("strengthsApplication") ?? "",
    mentorFocus: descriptionParse.values.get("mentorFocus") ?? "",
    firstStep: descriptionParse.values.get("firstStep") ?? "",
    keyPartners: splitCommaList(descriptionParse.values.get("keyPartners") ?? ""),
    leadershipActionsRequired: splitBulletList(
      descriptionParse.values.get("leadershipActionsRequired") ?? "",
    ),
    mentorPreparation: splitBulletList(
      descriptionParse.values.get("mentorPreparation") ?? "",
    ),
    menteePreparation: splitBulletList(
      descriptionParse.values.get("menteePreparation") ?? "",
    ),
    anticipatedChallenges: splitBulletList(
      descriptionParse.values.get("anticipatedChallenges") ?? "",
    ),
    successMeasures: (options.successMeasures ?? []).filter(Boolean),
    reflectionQuestions: (options.reflectionQuestions ?? []).filter(Boolean),
    successSignals: (options.successSignals ?? []).filter(Boolean),
    competencyNames: (options.competencyNames ?? []).filter(Boolean),
    applicableRoles: (options.applicableRoles ?? [])
      .map((roleTitle) => canonicalizeRoleTitle(roleTitle))
      .filter(Boolean),
    startDate: options.startDate,
    dueDate: options.dueDate,
    status: options.status ?? "assigned",
    mentorNotes: options.mentorNotes ?? "",
    roleTrackTitle:
      canonicalizeRoleTitle(mentorNotesParse.values.get("roleTrack")) ?? "",
    focusCompetency: mentorNotesParse.values.get("focusCompetency") ?? "",
    durationDays: options.durationDays,
  } satisfies MentoringSourceProject;
}

export function mentoringSourceProjectMatchesRoleTitle(
  project: MentoringSourceProject,
  roleTitle: string,
) {
  const canonicalRoleTitle = canonicalizeRoleTitle(roleTitle);

  return (
    project.roleTrackTitle === canonicalRoleTitle ||
    project.applicableRoles.includes(canonicalRoleTitle)
  );
}

export function buildLeadershipDevelopmentRecordFromProject(options: {
  assignment: {
    candidateId: string;
    roleId: string;
    mentorProfileId: string;
    candidateName: string;
    roleTitle: string;
    mentorName: string;
    startDate: string | null;
  };
  project: MentoringSourceProject;
}) {
  const draft = createEmptyLeadershipDevelopmentRecord({
    candidateId: options.assignment.candidateId,
    roleId: options.assignment.roleId,
    mentorId: options.assignment.mentorProfileId,
    candidateName: options.assignment.candidateName,
    targetRole: options.assignment.roleTitle,
    primaryMentor: options.assignment.mentorName,
    dateAssigned: options.project.startDate ?? options.assignment.startDate,
  });

  const competencyNames = Array.from(
    new Set(
      [
        options.project.focusCompetency,
        ...options.project.competencyNames,
      ].filter(Boolean),
    ),
  );
  const growthAreas = inferGrowthAreas(options.project);
  const menteeTask = [
    options.project.description,
    options.project.workingGoal
      ? `Working goal: ${options.project.workingGoal}`
      : "",
    options.project.firstStep ? `First step: ${options.project.firstStep}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    ...draft,
    sourceProjectAssignmentId: options.project.id,
    growthAreas,
    assignmentReason: options.project.whyItFits || options.project.purpose,
    experienceTitle: options.project.title,
    menteeTask,
    competencies:
      competencyNames.length > 0
        ? competencyNames.map((competencyName) => ({
            ...createEmptyLeadershipDevelopmentCompetency(),
            competencyName,
          }))
        : draft.competencies,
    leaderEngagements:
      options.project.keyPartners.length > 0
        ? options.project.keyPartners.slice(0, 4).map((partner) => ({
            ...createEmptyLeadershipDevelopmentLeader(),
            leaderName: partner,
            purpose: "Project partner / stakeholder",
          }))
        : draft.leaderEngagements,
  } satisfies LeadershipDevelopmentRecordPayload;
}
