import { z } from "zod";

export const MENTORING_PREPARATION_WORKSHEET_TYPE =
  "mentor_mentee_preparation" as const;

export const preparationCompetencySchema = z.object({
  whatMustDo: z.string().trim(),
  whyCritical: z.string().trim(),
  successLooksLike: z.string().trim(),
  failureLooksLike: z.string().trim(),
  priorityRank: z.string().trim(),
});

export const preparationWorksheetPayloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid(),
  status: z.enum(["draft", "completed"]).default("draft"),
  worksheetDate: z.string().trim().optional(),
  criticalCompetencies: z.array(preparationCompetencySchema).length(5),
  menteeLeastPrepared: z.string().trim(),
  menteeStrongestArea: z.string().trim(),
  strengthsHelp: z.string().trim(),
  strengthsDistractionPlan: z.string().trim(),
  sharedDevelopmentFocus: z.string().trim(),
  desiredImprovement: z.string().trim(),
  mentorSupportNeeded: z.string().trim(),
  communicationExpectations: z.string().trim(),
  initialDevelopmentFocus: z.array(z.string().trim()).length(2),
  mentorGuidanceNotes: z.string().trim(),
});

export type PreparationCompetencyInput = z.infer<
  typeof preparationCompetencySchema
>;
export type PreparationWorksheetPayload = z.infer<
  typeof preparationWorksheetPayloadSchema
>;

export type PreparationWorksheetRecord = PreparationWorksheetPayload & {
  id: string;
  updatedAt: string;
};

export function createEmptyPreparationCompetency(): PreparationCompetencyInput {
  return {
    whatMustDo: "",
    whyCritical: "",
    successLooksLike: "",
    failureLooksLike: "",
    priorityRank: "",
  };
}

export function createEmptyPreparationWorksheet(options: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  worksheetDate?: string | null;
}): PreparationWorksheetPayload {
  return {
    candidateId: options.candidateId,
    roleId: options.roleId,
    mentorProfileId: options.mentorProfileId,
    status: "draft",
    worksheetDate: options.worksheetDate ?? "",
    criticalCompetencies: Array.from({ length: 5 }, () =>
      createEmptyPreparationCompetency(),
    ),
    menteeLeastPrepared: "",
    menteeStrongestArea: "",
    strengthsHelp: "",
    strengthsDistractionPlan: "",
    sharedDevelopmentFocus: "",
    desiredImprovement: "",
    mentorSupportNeeded: "",
    communicationExpectations: "",
    initialDevelopmentFocus: ["", ""],
    mentorGuidanceNotes: "",
  };
}

export function normalizePreparationWorksheetRecord(
  worksheet: PreparationWorksheetRecord,
): PreparationWorksheetRecord {
  return {
    ...worksheet,
    criticalCompetencies: Array.from({ length: 5 }, (_, index) => ({
      ...createEmptyPreparationCompetency(),
      ...(worksheet.criticalCompetencies[index] ?? {}),
    })),
    initialDevelopmentFocus: Array.from({ length: 2 }, (_, index) =>
      worksheet.initialDevelopmentFocus[index] ?? "",
    ),
  };
}

export function isMissingPreparationWorksheetTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("mentoring_preparation_worksheets") &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist")),
  );
}
