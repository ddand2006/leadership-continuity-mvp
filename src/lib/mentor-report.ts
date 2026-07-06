import { z } from "zod";
import type { CompetencyAssessment } from "@/lib/fit-analysis";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

export const mentorReportSchema = z.object({
  executive_summary: z.string(),
  strongest_role_matches: z.array(
    z.object({
      competency: z.string(),
      why_it_fits: z.string(),
    }),
  ),
  development_priorities: z.array(
    z.object({
      competency: z.string(),
      why_it_matters: z.string(),
      evidence: z.string(),
    }),
  ),
  strengths_to_leverage: z.array(
    z.object({
      competency: z.string(),
      strength: z.string(),
      application: z.string(),
    }),
  ),
  possible_blind_spots: z.array(
    z.object({
      strength_or_pattern: z.string(),
      risk: z.string(),
      coaching_focus: z.string(),
    }),
  ),
  recommended_projects: z.array(
    z.object({
      title: z.string(),
      why_it_fits: z.string(),
      success_signals: z.array(z.string()),
    }),
  ),
  mentor_coaching_questions: z.array(
    z.object({
      focus_area: z.string(),
      questions: z.array(z.string()),
    }),
  ),
  thirty_sixty_ninety_day_plan: z.object({
    thirty_days: z.array(z.string()),
    sixty_days: z.array(z.string()),
    ninety_days: z.array(z.string()),
  }),
  evidence_to_watch: z.array(z.string()),
});

export type MentorReport = z.infer<typeof mentorReportSchema>;

type DevelopmentPriorityEvidenceAssessment = Pick<
  CompetencyAssessment,
  | "averageScore"
  | "targetScore"
  | "interviewScore"
  | "strengthsScore"
  | "weightedGap"
  | "concernNotes"
  | "evidenceNotes"
>;

export function buildDevelopmentPriorityEvidenceSummary(
  assessment: DevelopmentPriorityEvidenceAssessment,
) {
  const scoreParts = [
    `Average score ${assessment.averageScore.toFixed(2)} vs target ${assessment.targetScore.toFixed(2)}.`,
  ];

  if (assessment.interviewScore !== null) {
    scoreParts.push(
      `Interview average ${assessment.interviewScore.toFixed(2)}.`,
    );
  }

  if (assessment.strengthsScore !== null) {
    scoreParts.push(
      `Strengths fit ${assessment.strengthsScore.toFixed(2)}.`,
    );
  }

  scoreParts.push(`Weighted gap ${assessment.weightedGap.toFixed(2)}.`);

  if (assessment.concernNotes.length > 0) {
    scoreParts.push(
      `Current concern notes: ${sanitizeAppTextList(assessment.concernNotes).join("; ")}.`,
    );
  } else if (assessment.evidenceNotes.length > 0) {
    scoreParts.push(
      `Recent evidence notes: ${sanitizeAppTextList(assessment.evidenceNotes).join("; ")}.`,
    );
  } else {
    scoreParts.push("No qualitative notes are stored yet.");
  }

  return sanitizeAppText(scoreParts.join(" "));
}

export function normalizeDevelopmentPriorities(
  developmentPriorities: MentorReport["development_priorities"],
  assessments: CompetencyAssessment[],
): MentorReport["development_priorities"] {
  const assessmentMap = new Map(
    assessments.map((assessment) => [assessment.competencyName, assessment]),
  );

  return developmentPriorities.map((priority) => {
    const assessment = assessmentMap.get(priority.competency);

    if (!assessment) {
      return priority;
    }

    return {
      ...priority,
      evidence: buildDevelopmentPriorityEvidenceSummary(assessment),
    };
  });
}

export function buildRoleMatchesWeakestToStrongest(
  assessments: CompetencyAssessment[],
): MentorReport["strongest_role_matches"] {
  return [...assessments]
    .sort(
      (left, right) =>
        left.averageScore - right.averageScore ||
        right.weightedGap - left.weightedGap ||
        left.competencyName.localeCompare(right.competencyName),
    )
    .map((assessment) => {
      const evidence =
        assessment.supportingStrengths.length > 0
          ? `Supporting strengths: ${sanitizeAppTextList(assessment.supportingStrengths).join(", ")}.`
          : assessment.strengthsScore !== null
            ? `Strengths fit score ${assessment.strengthsScore.toFixed(2)}.`
            : "No strengths evidence is attached yet.";

      const interviewContext =
        assessment.interviewScore !== null
          ? `Interview score ${assessment.interviewScore.toFixed(2)}.`
          : "No interview score is entered yet.";

      return {
        competency: sanitizeAppText(assessment.competencyName),
        why_it_fits: sanitizeAppText(
          `${assessment.status}. Average ${assessment.averageScore.toFixed(2)} against target ${assessment.targetScore.toFixed(2)}. ${interviewContext} ${evidence}`.trim(),
        ),
      };
    });
}

export function buildMentorReportNarrative(report: MentorReport) {
  return [
    "Executive Summary",
    report.executive_summary,
    "",
    "Development Priorities",
    ...report.development_priorities.map(
      (priority) => `- ${priority.competency}: ${priority.why_it_matters}`,
    ),
    "",
    "Recommended Development Plans",
    ...report.recommended_projects.map(
      (project) => `- ${project.title}: ${project.why_it_fits}`,
    ),
    "",
    "30/60/90 Plan",
    `30 days: ${report.thirty_sixty_ninety_day_plan.thirty_days.join("; ")}`,
    `60 days: ${report.thirty_sixty_ninety_day_plan.sixty_days.join("; ")}`,
    `90 days: ${report.thirty_sixty_ninety_day_plan.ninety_days.join("; ")}`,
  ].join("\n");
}
