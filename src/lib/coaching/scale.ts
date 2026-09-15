export type ScaleRow = Record<string, unknown> & {
    id?: string;
};
export type ScaleData = Record<string, unknown>;
export const scaleRows = (d: ScaleData, key: string): ScaleRow[] => Array.isArray(d[key]) ? d[key] as ScaleRow[] : [];
export function metricLabel(value: unknown) { return value == null ? 'Not available' : typeof value === 'number' ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) : String(value); }
export function supplyStatus(capacity: number | null, demand: number, thresholds = { healthy: 2, watch: 1, critical: 0.5 }) { if (!demand)
    return 'No open demand'; if (capacity == null)
    return 'Capacity incomplete'; const ratio = capacity / demand; return ratio < thresholds.critical ? 'Critical shortage' : ratio < thresholds.watch ? 'Shortage' : ratio < thresholds.healthy ? 'Watch' : 'Healthy'; }
export const analyticsFilters = (input: Record<string, string>) => Object.fromEntries(['from', 'to', 'organization', 'coach', 'specialty', 'industry', 'leadership_level', 'package'].filter(k => input[k]).map(k => [k, input[k]]));
