import { z } from "zod";

export const crossDepartmentConversationSchema = z.object({
  departmentName: z.string().trim(),
  leaderName: z.string().trim(),
  topPriorities: z.string().trim(),
  pressuresChallenges: z.string().trim(),
  roleImpact: z.string().trim(),
  breakdowns: z.string().trim(),
  strongCollaboration: z.string().trim(),
});

export const crossDepartmentalProjectWorksheetPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid(),
  status: z.enum(["draft", "completed"]).default("draft"),
  worksheetDate: z.string().trim().optional(),
  departmentConversations: z.array(crossDepartmentConversationSchema).length(5),
  crossDepartmentChallenge: z.string().trim(),
  projectTitle: z.string().trim(),
  projectObjective: z.string().trim(),
  projectPartners: z.string().trim(),
  projectTimeline: z.string().trim(),
  projectLearningGoal: z.string().trim(),
  sharedThemes: z.string().trim(),
  alignmentRisks: z.string().trim(),
  biggestSurprise: z.string().trim(),
  leadershipShift: z.string().trim(),
  criticalBehaviors: z.string().trim(),
  hospitalInsights: z.string().trim(),
  actionCommitments: z.array(z.string().trim()).length(3),
  mentorObservedQualities: z.array(z.string().trim()).default([]),
  mentorComments: z.string().trim(),
});

export type CrossDepartmentConversationInput = z.infer<
  typeof crossDepartmentConversationSchema
>;
export type CrossDepartmentalProjectWorksheetPayload = z.infer<
  typeof crossDepartmentalProjectWorksheetPayloadSchema
>;

export type CrossDepartmentalProjectWorksheetRecord =
  CrossDepartmentalProjectWorksheetPayload & {
    id: string;
    updatedAt: string;
  };

export function createEmptyCrossDepartmentConversation(): CrossDepartmentConversationInput {
  return {
    departmentName: "",
    leaderName: "",
    topPriorities: "",
    pressuresChallenges: "",
    roleImpact: "",
    breakdowns: "",
    strongCollaboration: "",
  };
}

export function createEmptyCrossDepartmentalProjectWorksheet(options: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  worksheetDate?: string | null;
}): CrossDepartmentalProjectWorksheetPayload {
  return {
    candidateId: options.candidateId,
    roleId: options.roleId,
    mentorProfileId: options.mentorProfileId,
    status: "draft",
    worksheetDate: options.worksheetDate ?? "",
    departmentConversations: Array.from({ length: 5 }, () =>
      createEmptyCrossDepartmentConversation(),
    ),
    crossDepartmentChallenge: "",
    projectTitle: "",
    projectObjective: "",
    projectPartners: "",
    projectTimeline: "",
    projectLearningGoal: "",
    sharedThemes: "",
    alignmentRisks: "",
    biggestSurprise: "",
    leadershipShift: "",
    criticalBehaviors: "",
    hospitalInsights: "",
    actionCommitments: ["", "", ""],
    mentorObservedQualities: [],
    mentorComments: "",
  };
}

export function normalizeCrossDepartmentalProjectWorksheetRecord(
  worksheet: CrossDepartmentalProjectWorksheetRecord,
): CrossDepartmentalProjectWorksheetRecord {
  return {
    ...worksheet,
    departmentConversations: Array.from({ length: 5 }, (_, index) => ({
      ...createEmptyCrossDepartmentConversation(),
      ...(worksheet.departmentConversations[index] ?? {}),
    })),
    actionCommitments: Array.from({ length: 3 }, (_, index) =>
      worksheet.actionCommitments[index] ?? "",
    ),
    mentorObservedQualities: Array.isArray(worksheet.mentorObservedQualities)
      ? worksheet.mentorObservedQualities.filter((item) => item.trim().length > 0)
      : [],
  };
}

export function isMissingCrossDepartmentalProjectWorksheetTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("mentoring_cross_departmental_project_worksheets") &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist")),
  );
}
