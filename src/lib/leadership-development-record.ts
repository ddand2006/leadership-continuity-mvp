import { z } from "zod";

export const LEADERSHIP_DEVELOPMENT_GROWTH_AREAS = [
  "Executive Communication",
  "Systems Thinking",
  "Delegation",
  "Accountability",
  "Financial Acumen",
  "Conflict Management",
  "Change Leadership",
  "Collaboration",
  "Other",
] as const;

export const LEADERSHIP_DEVELOPMENT_STATUSES = [
  "assigned",
  "in_progress",
  "ready_for_review",
  "completed",
] as const;

export const LEADERSHIP_DEVELOPMENT_READINESS_SIGNALS = [
  "developing",
  "progressing",
  "near_role_ready",
  "role_ready",
] as const;

const scoreInputSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^[1-5]$/.test(value), {
    message: "Scores must be whole numbers from 1 to 5.",
  });

const leadershipDevelopmentTextListSchema = z
  .array(z.string().trim().min(1).max(300))
  .default([]);

export const leadershipDevelopmentCompetencySchema = z.object({
  competencyName: z.string().trim(),
  baselineScore: scoreInputSchema,
  targetScore: scoreInputSchema,
  currentScore: scoreInputSchema,
});

export const leadershipDevelopmentLeaderSchema = z.object({
  leaderName: z.string().trim(),
  department: z.string().trim(),
  purpose: z.string().trim(),
  meetingCompleted: z.boolean(),
});

export const leadershipDevelopmentFeedbackSchema = z.object({
  reviewerName: z.string().trim(),
  reviewerRole: z.string().trim(),
  reviewDate: z.string().trim(),
  growthScore: scoreInputSchema,
  communicationScore: scoreInputSchema,
  collaborationScore: scoreInputSchema,
  feedbackApplicationScore: scoreInputSchema,
  readinessScore: scoreInputSchema,
  evidenceComments: z.string().trim().max(1000),
});

export const leadershipDevelopmentRecordPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  sourceProjectAssignmentId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .default(""),
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorId: z.string().uuid(),
  candidateName: z.string().trim().min(1),
  targetRole: z.string().trim().min(1),
  primaryMentor: z.string().trim().min(1),
  dateAssigned: z.string().trim().min(1),
  status: z.enum(LEADERSHIP_DEVELOPMENT_STATUSES),
  growthAreas: z.array(z.enum(LEADERSHIP_DEVELOPMENT_GROWTH_AREAS)).min(1),
  assignmentReason: z.string().trim().max(1000),
  experienceTitle: z.string().trim().min(1),
  menteeTask: z.string().trim().max(1500),
  projectSummary: z.string().trim().max(3000),
  projectPurpose: z.string().trim().max(1500),
  workingGoal: z.string().trim().max(1500),
  whyItFits: z.string().trim().max(2000),
  mentorFocus: z.string().trim().max(2000),
  firstStep: z.string().trim().max(1500),
  keyPartners: leadershipDevelopmentTextListSchema,
  leadershipActionsRequired: leadershipDevelopmentTextListSchema,
  anticipatedChallenges: leadershipDevelopmentTextListSchema,
  successMeasures: leadershipDevelopmentTextListSchema,
  mentorPreparation: leadershipDevelopmentTextListSchema,
  menteePreparation: leadershipDevelopmentTextListSchema,
  reflectionQuestions: leadershipDevelopmentTextListSchema,
  successSignals: leadershipDevelopmentTextListSchema,
  leaderEngagements: z.array(leadershipDevelopmentLeaderSchema),
  competencies: z.array(leadershipDevelopmentCompetencySchema),
  reviewerFeedback: z.array(leadershipDevelopmentFeedbackSchema),
  mentorImprovementObserved: z.string().trim().max(1000),
  mentorDevelopmentNeeded: z.string().trim().max(1000),
  readinessSignal: z
    .union([z.enum(LEADERSHIP_DEVELOPMENT_READINESS_SIGNALS), z.literal("")])
    .default(""),
  nextRecommendedExperience: z.string().trim().max(1000),
  mentorReviewDate: z.string().trim(),
});

export type LeadershipDevelopmentCompetencyInput = z.infer<
  typeof leadershipDevelopmentCompetencySchema
>;
export type LeadershipDevelopmentLeaderInput = z.infer<
  typeof leadershipDevelopmentLeaderSchema
>;
export type LeadershipDevelopmentFeedbackInput = z.infer<
  typeof leadershipDevelopmentFeedbackSchema
>;
export type LeadershipDevelopmentRecordPayload = z.infer<
  typeof leadershipDevelopmentRecordPayloadSchema
>;

export type LeadershipDevelopmentRecordRecord =
  LeadershipDevelopmentRecordPayload & {
    id: string;
    updatedAt: string;
    averageFeedbackScore: number | null;
  };

export function createEmptyLeadershipDevelopmentCompetency(): LeadershipDevelopmentCompetencyInput {
  return {
    competencyName: "",
    baselineScore: "",
    targetScore: "",
    currentScore: "",
  };
}

export function createEmptyLeadershipDevelopmentLeader(): LeadershipDevelopmentLeaderInput {
  return {
    leaderName: "",
    department: "",
    purpose: "",
    meetingCompleted: false,
  };
}

export function createEmptyLeadershipDevelopmentFeedback(): LeadershipDevelopmentFeedbackInput {
  return {
    reviewerName: "",
    reviewerRole: "",
    reviewDate: "",
    growthScore: "",
    communicationScore: "",
    collaborationScore: "",
    feedbackApplicationScore: "",
    readinessScore: "",
    evidenceComments: "",
  };
}

export function createEmptyLeadershipDevelopmentRecord(options: {
  candidateId: string;
  roleId: string;
  mentorId: string;
  candidateName: string;
  targetRole: string;
  primaryMentor: string;
  dateAssigned?: string | null;
}): LeadershipDevelopmentRecordPayload {
  return {
    sourceProjectAssignmentId: "",
    candidateId: options.candidateId,
    roleId: options.roleId,
    mentorId: options.mentorId,
    candidateName: options.candidateName,
    targetRole: options.targetRole,
    primaryMentor: options.primaryMentor,
    dateAssigned: options.dateAssigned || new Date().toISOString().slice(0, 10),
    status: "assigned",
    growthAreas: [],
    assignmentReason: "",
    experienceTitle: "",
    menteeTask: "",
    projectSummary: "",
    projectPurpose: "",
    workingGoal: "",
    whyItFits: "",
    mentorFocus: "",
    firstStep: "",
    keyPartners: [],
    leadershipActionsRequired: [],
    anticipatedChallenges: [],
    successMeasures: [],
    mentorPreparation: [],
    menteePreparation: [],
    reflectionQuestions: [],
    successSignals: [],
    leaderEngagements: [createEmptyLeadershipDevelopmentLeader()],
    competencies: [createEmptyLeadershipDevelopmentCompetency()],
    reviewerFeedback: [createEmptyLeadershipDevelopmentFeedback()],
    mentorImprovementObserved: "",
    mentorDevelopmentNeeded: "",
    readinessSignal: "",
    nextRecommendedExperience: "",
    mentorReviewDate: "",
  };
}

export function normalizeLeadershipDevelopmentRecord<T extends LeadershipDevelopmentRecordPayload | LeadershipDevelopmentRecordRecord>(
  record: T,
): T {
  const normalized = {
    ...record,
    keyPartners: record.keyPartners ?? [],
    leadershipActionsRequired: record.leadershipActionsRequired ?? [],
    anticipatedChallenges: record.anticipatedChallenges ?? [],
    successMeasures: record.successMeasures ?? [],
    mentorPreparation: record.mentorPreparation ?? [],
    menteePreparation: record.menteePreparation ?? [],
    reflectionQuestions: record.reflectionQuestions ?? [],
    successSignals: record.successSignals ?? [],
    leaderEngagements:
      record.leaderEngagements.length > 0
        ? record.leaderEngagements.map((item) => ({
            ...createEmptyLeadershipDevelopmentLeader(),
            ...item,
          }))
        : [createEmptyLeadershipDevelopmentLeader()],
    competencies:
      record.competencies.length > 0
        ? record.competencies.map((item) => ({
            ...createEmptyLeadershipDevelopmentCompetency(),
            ...item,
          }))
        : [createEmptyLeadershipDevelopmentCompetency()],
    reviewerFeedback:
      record.reviewerFeedback.length > 0
        ? record.reviewerFeedback.map((item) => ({
            ...createEmptyLeadershipDevelopmentFeedback(),
            ...item,
          }))
        : [createEmptyLeadershipDevelopmentFeedback()],
  };

  return normalized as T;
}

export function parseLeadershipDevelopmentScore(value: string) {
  return value.trim().length > 0 ? Number(value) : null;
}

export function calculateLeadershipDevelopmentImprovement(
  baselineScore: string,
  currentScore: string,
) {
  const baseline = parseLeadershipDevelopmentScore(baselineScore);
  const current = parseLeadershipDevelopmentScore(currentScore);

  if (baseline === null || current === null) {
    return null;
  }

  return current - baseline;
}

export function calculateLeadershipDevelopmentGapRemaining(
  targetScore: string,
  currentScore: string,
) {
  const target = parseLeadershipDevelopmentScore(targetScore);
  const current = parseLeadershipDevelopmentScore(currentScore);

  if (target === null || current === null) {
    return null;
  }

  return target - current;
}

export function isFilledLeadershipDevelopmentLeader(
  leader: LeadershipDevelopmentLeaderInput,
) {
  return [leader.leaderName, leader.department, leader.purpose].some(
    (value) => value.trim().length > 0,
  );
}

export function isFilledLeadershipDevelopmentCompetency(
  competency: LeadershipDevelopmentCompetencyInput,
) {
  return [
    competency.competencyName,
    competency.baselineScore,
    competency.targetScore,
    competency.currentScore,
  ].some((value) => value.trim().length > 0);
}

export function isFilledLeadershipDevelopmentFeedback(
  feedback: LeadershipDevelopmentFeedbackInput,
) {
  return [
    feedback.reviewerName,
    feedback.reviewerRole,
    feedback.reviewDate,
    feedback.growthScore,
    feedback.communicationScore,
    feedback.collaborationScore,
    feedback.feedbackApplicationScore,
    feedback.readinessScore,
    feedback.evidenceComments,
  ].some((value) => value.trim().length > 0);
}

export function isLeadershipDevelopmentMentorReviewComplete(
  record: LeadershipDevelopmentRecordPayload,
) {
  return (
    record.mentorImprovementObserved.trim().length > 0 &&
    record.mentorDevelopmentNeeded.trim().length > 0 &&
    record.readinessSignal.trim().length > 0 &&
    record.nextRecommendedExperience.trim().length > 0 &&
    record.mentorReviewDate.trim().length > 0
  );
}

function getFeedbackRowAverage(feedback: LeadershipDevelopmentFeedbackInput) {
  const values = [
    feedback.growthScore,
    feedback.communicationScore,
    feedback.collaborationScore,
    feedback.feedbackApplicationScore,
    feedback.readinessScore,
  ]
    .map(parseLeadershipDevelopmentScore)
    .filter((value): value is number => value !== null);

  if (values.length !== 5) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeLeadershipDevelopmentAverageFeedbackScore(
  feedbackItems: LeadershipDevelopmentFeedbackInput[],
) {
  const completedFeedbackAverages = feedbackItems
    .map(getFeedbackRowAverage)
    .filter((value): value is number => value !== null);

  if (completedFeedbackAverages.length === 0) {
    return null;
  }

  const average =
    completedFeedbackAverages.reduce((sum, value) => sum + value, 0) /
    completedFeedbackAverages.length;

  return Number(average.toFixed(2));
}

export function isMissingLeadershipDevelopmentRecordTableError(error: {
  message: string;
} | null) {
  if (!error) {
    return false;
  }

  const mentionsDevelopmentRecordTable = [
    "development_records",
    "development_record_competencies",
    "development_record_leaders",
    "development_record_feedback",
  ].some((tableName) => error.message.includes(tableName));

  return Boolean(
    mentionsDevelopmentRecordTable &&
      (error.message.includes("schema cache") ||
        error.message.includes("does not exist")),
  );
}
