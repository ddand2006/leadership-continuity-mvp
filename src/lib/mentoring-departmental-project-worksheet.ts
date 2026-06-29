import { z } from "zod";

export const departmentalProjectWorksheetPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid(),
  status: z.enum(["draft", "completed"]).default("draft"),
  projectTimeline: z.string().trim(),
  departmentNeed: z.string().trim(),
  projectTitle: z.string().trim(),
  projectObjective: z.string().trim(),
  projectImportance: z.string().trim(),
  responsibleOutcomes: z.string().trim(),
  collaborators: z.string().trim(),
  leadershipActionsRequired: z.array(z.string().trim()).default([]),
  leadershipActionsOther: z.string().trim(),
  competenciesDeveloped: z.string().trim(),
  mentorAnticipatedDifficulty: z.string().trim(),
  mentorStretchCompetencies: z.string().trim(),
  menteeAnticipatedDifficulty: z.string().trim(),
  challengeProcessWithMentor: z.string().trim(),
  coachingAreas: z.string().trim(),
  figuringThingsOutProcess: z.string().trim(),
  helpThreshold: z.string().trim(),
  successMeasures: z.string().trim(),
  postProjectLeaderWins: z.string().trim(),
  postProjectDoDifferently: z.string().trim(),
  postProjectFeedbackReceived: z.string().trim(),
  mentorEvaluationCompetenciesDeveloped: z.string().trim(),
  strengthsObserved: z.string().trim(),
  futureDevelopmentAreas: z.string().trim(),
  readinessSignal: z.enum(["", "developing", "progressing", "role_ready"]).default(""),
});

export type DepartmentalProjectWorksheetPayload = z.infer<
  typeof departmentalProjectWorksheetPayloadSchema
>;

export type DepartmentalProjectWorksheetRecord =
  DepartmentalProjectWorksheetPayload & {
    id: string;
    updatedAt: string;
  };

export function createEmptyDepartmentalProjectWorksheet(options: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
}): DepartmentalProjectWorksheetPayload {
  return {
    candidateId: options.candidateId,
    roleId: options.roleId,
    mentorProfileId: options.mentorProfileId,
    status: "draft",
    projectTimeline: "",
    departmentNeed: "",
    projectTitle: "",
    projectObjective: "",
    projectImportance: "",
    responsibleOutcomes: "",
    collaborators: "",
    leadershipActionsRequired: [],
    leadershipActionsOther: "",
    competenciesDeveloped: "",
    mentorAnticipatedDifficulty: "",
    mentorStretchCompetencies: "",
    menteeAnticipatedDifficulty: "",
    challengeProcessWithMentor: "",
    coachingAreas: "",
    figuringThingsOutProcess: "",
    helpThreshold: "",
    successMeasures: "",
    postProjectLeaderWins: "",
    postProjectDoDifferently: "",
    postProjectFeedbackReceived: "",
    mentorEvaluationCompetenciesDeveloped: "",
    strengthsObserved: "",
    futureDevelopmentAreas: "",
    readinessSignal: "",
  };
}

export function normalizeDepartmentalProjectWorksheetRecord(
  worksheet: DepartmentalProjectWorksheetRecord,
): DepartmentalProjectWorksheetRecord {
  return {
    ...worksheet,
    leadershipActionsRequired: Array.isArray(worksheet.leadershipActionsRequired)
      ? worksheet.leadershipActionsRequired.filter((item) => item.trim().length > 0)
      : [],
  };
}

export function isMissingDepartmentalProjectWorksheetTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("mentoring_departmental_project_worksheets") &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist")),
  );
}

