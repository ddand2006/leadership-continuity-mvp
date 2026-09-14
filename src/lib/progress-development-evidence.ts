export type ProjectScoreEvidence = {
  competency_name: string;
  baseline_score: number | null;
  current_score: number | null;
  target_score: number | null;
};

export type ProjectProgressEvidence = {
  dateAssigned: string;
  completionDate: string | null;
  mentorReviewDate: string | null;
  mentorName: string | null;
  mentorImprovementObserved: string | null;
  mentorDevelopmentNeeded: string | null;
  nextRecommendedExperience: string | null;
  competencyScores: ProjectScoreEvidence[];
};

export function projectScore(value: number | null) {
  return value === null || !Number.isFinite(value) ? "Not recorded" : `${Number(value.toFixed(2))} / 5`;
}

export function projectScoreChange(baseline: number | null, current: number | null) {
  if (baseline === null || current === null || !Number.isFinite(baseline) || !Number.isFinite(current)) {
    return "Not enough scores";
  }
  const change = Math.round((current - baseline) * 100) / 100;
  return change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change} points`;
}

export function projectCompletionLabel(status: string, completionDate: string | null) {
  return status === "completed" ? completionDate ?? "Not recorded" : "Not completed";
}
