type DevelopmentScoreRecord = {
  role_id: string | null;
  updated_at: string | null;
  development_record_competencies: Array<{competency_name: string; current_score: number | null}>;
};

/** Latest recorded non-null score per competency, scoped to the selected role. */
export function latestDevelopmentScores(records: DevelopmentScoreRecord[], roleId: string | null) {
  const scores = new Map<string, number>();
  if (!roleId) return scores;
  const ordered = records.filter(record => record.role_id === roleId)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  for (const record of ordered) {
    for (const competency of record.development_record_competencies ?? []) {
      const name = competency.competency_name.trim().toLowerCase();
      const score = competency.current_score;
      if (name && score !== null && Number.isFinite(score) && !scores.has(name)) scores.set(name, score);
    }
  }
  return scores;
}
