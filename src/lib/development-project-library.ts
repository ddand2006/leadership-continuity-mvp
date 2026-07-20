import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";
import type { LeadershipDevelopmentRecordPayload } from "@/lib/leadership-development-record";

export const DEFAULT_PROJECT_DURATION_DAYS = 45;

function uniqueList(items: string[] | null | undefined) {
  return Array.from(
    new Set((items ?? []).map((item) => item.trim()).filter(Boolean)),
  );
}

export function inferProjectDifficulty(durationDays: number) {
  if (durationDays <= 30) {
    return "foundational";
  }

  if (durationDays <= 75) {
    return "intermediate";
  }

  return "advanced";
}

export function buildDevelopmentProjectFieldsFromIdea(options: {
  idea: GeneratedCandidateMentoringIdea;
  roleTitle: string;
  competencyName: string;
  industryName?: string | null;
}) {
  return {
    title: options.idea.title,
    description: options.idea.description,
    difficulty: inferProjectDifficulty(options.idea.duration_days),
    duration_days: options.idea.duration_days,
    industry: options.industryName?.trim() || null,
    applicable_roles: uniqueList([options.roleTitle]),
    competencies_developed: uniqueList([options.competencyName]),
    strengths_leveraged: [],
    expected_outcomes: uniqueList(options.idea.success_measures),
    mentor_questions: uniqueList(options.idea.reflection_questions),
    evidence_of_success: uniqueList(options.idea.success_signals),
    purpose: options.idea.purpose.trim(),
    working_goal: options.idea.working_goal.trim(),
    why_it_fits: options.idea.why_it_fits.trim(),
    strengths_application: options.idea.strengths_application.trim(),
    mentor_focus: options.idea.mentor_focus.trim(),
    first_step: options.idea.first_step.trim(),
    key_partners: uniqueList(options.idea.key_partners),
    leadership_actions_required: uniqueList(
      options.idea.leadership_actions_required,
    ),
    mentor_preparation: uniqueList(options.idea.mentor_preparation),
    mentee_preparation: uniqueList(options.idea.mentee_preparation),
    anticipated_challenges: uniqueList(options.idea.anticipated_challenges),
  };
}

export function buildDevelopmentProjectFieldsFromLeadershipRecord(options: {
  record: LeadershipDevelopmentRecordPayload;
  roleTitle: string;
  competencyNames: string[];
  industryName?: string | null;
  durationDays?: number | null;
  strengthsLeveraged?: string[] | null;
  existingRoles?: string[] | null;
}) {
  const durationDays =
    options.durationDays && options.durationDays > 0
      ? options.durationDays
      : DEFAULT_PROJECT_DURATION_DAYS;

  return {
    title: options.record.experienceTitle.trim(),
    description:
      options.record.projectSummary.trim() ||
      options.record.menteeTask.trim() ||
      options.record.assignmentReason.trim(),
    difficulty: inferProjectDifficulty(durationDays),
    duration_days: durationDays,
    industry: options.industryName?.trim() || null,
    applicable_roles: uniqueList([
      ...(options.existingRoles ?? []),
      options.roleTitle,
    ]),
    competencies_developed: uniqueList(options.competencyNames),
    strengths_leveraged: uniqueList(options.strengthsLeveraged ?? []),
    expected_outcomes: uniqueList(options.record.successMeasures),
    mentor_questions: uniqueList(options.record.reflectionQuestions),
    evidence_of_success: uniqueList(options.record.successSignals),
    purpose: options.record.projectPurpose.trim() || null,
    working_goal: options.record.workingGoal.trim() || null,
    why_it_fits: options.record.whyItFits.trim() || null,
    strengths_application: null,
    mentor_focus: options.record.mentorFocus.trim() || null,
    first_step: options.record.firstStep.trim() || null,
    key_partners: uniqueList(options.record.keyPartners),
    leadership_actions_required: uniqueList(
      options.record.leadershipActionsRequired,
    ),
    mentor_preparation: uniqueList(options.record.mentorPreparation),
    mentee_preparation: uniqueList(options.record.menteePreparation),
    anticipated_challenges: uniqueList(options.record.anticipatedChallenges),
  };
}
