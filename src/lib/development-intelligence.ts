/** Development Intelligence Engine. Explanatory rules only; never changes readiness. */
export type DevelopmentRow = {
    id: string;
    [key: string]: unknown;
};
export type DevelopmentData = {
    candidate?: DevelopmentRow;
    admin?: boolean;
    self?: boolean;
    mentor?: boolean;
    participant?: boolean;
    coaching_active?: boolean;
    sources?: DevelopmentRow[];
    needs?: DevelopmentRow[];
    evidence?: DevelopmentRow[];
    recommendations?: DevelopmentRow[];
    plans?: DevelopmentRow[];
    focus?: DevelopmentRow[];
    goals?: DevelopmentRow[];
    reviews?: DevelopmentRow[];
    readiness_history?: DevelopmentRow[];
    outcomes?: DevelopmentRow[];
    engagements?: DevelopmentRow[];
    candidates?: DevelopmentRow[];
    owners?: DevelopmentRow[];
    rules?: DevelopmentRow[];
    coaches?: DevelopmentRow[];
    experience?: DevelopmentRow[];
    configuration: Record<string, unknown>;
    current_readiness?: Record<string, unknown> | null;
    evidence_confidence?: string;
    system_recommendation?: string;
};
export const text = (row: DevelopmentRow, key: string) => String(row[key] ?? '');
export function competencyRows(sources: DevelopmentRow[]) {
    return sources.filter(s => s.data_type === 'competencies').map(c => {
        const assessed = sources.filter(s => s.competency_id === c.id && s.current_level != null && (s.data_type !== 'development_plan' || s.occurred_at)).sort((a, b) => String(b.occurred_at ?? '').localeCompare(String(a.occurred_at ?? '')) || Number(b.data_type === 'assessment') - Number(a.data_type === 'assessment'))[0];
        const current = assessed ? Number(assessed.current_level) : null;
        const target = c.target_level == null ? null : Number(c.target_level);
        const gap = current == null || target == null ? null : Math.max(0, target - current);
        return { ...c, current, target, gap, status: current == null ? 'Not assessed' : gap === 0 ? 'Competency demonstrated' : 'Development gap', source: assessed };
    });
}
export const methods = ['coaching', 'mentoring', 'project', 'training', 'experience', 'assessment', 'self_development'];
export function recommendedMethods(rec: DevelopmentRow) { const d = rec.recommendation_data as Record<string, unknown>; const weights = (d?.weights ?? {}) as Record<string, number>; return Object.entries(weights).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k); }
