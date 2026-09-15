export type CommerceRow = {
    id: string;
    [key: string]: unknown;
};
export type CommerceData = {
    platform_admin: boolean;
    organization_admin: boolean;
    coach: boolean;
    [key: string]: CommerceRow[] | boolean;
};
export const pricingModels = ['fixed_package', 'per_session', 'per_hour', 'monthly', 'engagement', 'organization_contract', 'custom'];
export const money = (value: unknown, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value ?? 0));
export function cents(value: unknown): number {
    const text = String(value);
    if (!/^\d+(\.\d{1,2})?$/.test(text))
        throw new Error('Invalid financial amount');
    const [whole, fraction = ''] = text.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(result) || result <= 0)
        throw new Error('Invalid financial amount');
    return result;
}
export function financialCsv(rows: CommerceRow[]) {
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const cell = (v: unknown) => { let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); if (/^[\s]*[=+@-]/.test(s))
        s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
    return '\uFEFF' + [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n');
}
export const exportTables: Record<string, string> = { payments: 'coaching_payments', invoices: 'coaching_invoices', compensation: 'coach_compensation_ledger', payouts: 'coach_payouts', revenue: 'coaching_platform_revenue', refunds: 'coaching_refunds' };
