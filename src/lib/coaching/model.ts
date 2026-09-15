export type Coach = {
    id: string;
    user_id?: string;
    display_name: string;
    headline: string;
    short_bio: string;
    full_bio: string;
    photo_url: string;
    city: string;
    country: string;
    coaching_philosophy: string;
    languages: string[];
    years_coaching: number;
    years_leadership_experience: number;
    icf_credential: string;
    credential_expired?: boolean;
    virtual_available: boolean;
    in_person_available: boolean;
    availability_status: string | null;
    approved_at: string;
    specialties: string[];
    industries: string[];
    leadership_levels: string[];
};
export type LogRow = {
    id: string;
    engagement_id: string;
    client_id: string;
    client_name: string;
    client_email: string | null;
    organization_id: string;
    organization: string;
    relationship_start: string;
    relationship_end: string | null;
    session_date: string;
    duration_minutes: number;
    compensation_category: string;
    coaching_category: string;
    consent_recorded: boolean;
    engagement_status: string;
};
export type Filters = Record<string, string | undefined>;
export function filterLog(rows: LogRow[], filters: Filters) {
    return rows.filter(r => (!filters.from || r.session_date >= filters.from!) && (!filters.to || r.session_date <= filters.to!) &&
        (!filters.client || r.client_id === filters.client) && (!filters.organization || r.organization_id === filters.organization) &&
        (!filters.engagement || r.engagement_id === filters.engagement) && (!filters.compensation || r.compensation_category === filters.compensation) &&
        (!filters.category || r.coaching_category === filters.category));
}
export function logMetrics(rows: LogRow[]) {
    const hours = (test: (row: LogRow) => boolean) => rows.filter(test).reduce((sum, r) => sum + Number(r.duration_minutes), 0) / 60;
    return { 'Total Coaching Hours': hours(() => true), 'Paid Hours': hours(r => r.compensation_category === 'paid'),
        'Pro Bono Hours': hours(r => r.compensation_category === 'pro_bono'), 'Individual Hours': hours(r => r.coaching_category === 'individual'),
        'Group Hours': hours(r => r.coaching_category === 'group'), 'Team Hours': hours(r => r.coaching_category === 'team'),
        'Number of Clients': new Set(rows.map(r => r.client_id)).size,
        'Active Clients': new Set(rows.filter(r => r.engagement_status === 'active').map(r => r.client_id)).size,
        'Completed Engagements': new Set(rows.filter(r => r.engagement_status === 'completed').map(r => r.engagement_id)).size };
}
export function logCsv(rows: LogRow[]) {
    const cell = (value: unknown) => {
        const text = String(value ?? '');
        return '"' + (/^[\s]*[=+@\-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
    };
    return '\ufeff' + [['Client Name', 'Client Email', 'Organization', 'Coaching Relationship Start', 'Coaching Relationship End', 'Session Date', 'Duration (minutes)', 'Paid / Pro Bono', 'Individual / Group / Team', 'Consent Recorded'],
        ...rows.map(r => [r.client_name, r.client_email, r.organization, r.relationship_start, r.relationship_end, r.session_date, r.duration_minutes, r.compensation_category, r.coaching_category, r.consent_recorded ? 'Yes' : 'No'])].map(r => r.map(cell).join(',')).join('\r\n');
}
export const consentTemplates = {
    coaching_record_retention: 'I consent to my coach maintaining my name, contact information, relationship dates and coaching hours for coaching administration.',
    credential_verification: 'I authorize use of my coaching records and contact information for professional credential verification.',
    development_data_access: 'I authorize my coach to view the selected portions of my Leader Continuity development profile for this engagement.',
    organization_reporting: 'I authorize sharing high-level goals and progress with my organization. Confidential conversations and private notes remain private.',
};
export const availabilityLabels: Record<string, string> = { available: 'Available for New Engagements', limited: 'Limited Availability', unavailable: 'Currently Unavailable' };
