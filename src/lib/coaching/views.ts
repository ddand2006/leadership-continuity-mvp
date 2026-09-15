export type CoachingView = 'person' | 'coach' | 'company' | 'platform';
export type ViewAccess = { admin: boolean; platformAdmin: boolean; coach: unknown };
export const viewLabels: Record<CoachingView, string> = { person: 'Person Being Coached', coach: 'Coach', company: 'Company Administrator', platform: 'Platform Administration' };
export const viewHomes: Record<CoachingView, string> = { person: '/coaching/my', coach: '/coaching/coach', company: '/coaching/engagements', platform: '/admin/coaching' };
export function availableViews(access: ViewAccess): CoachingView[] {
 return [...(access.coach || access.platformAdmin ? ['coach' as const] : []), 'person', ...(access.admin ? ['company' as const] : []), ...(access.platformAdmin ? ['platform' as const] : [])];
}
export function currentView(access: ViewAccess, path: string[], saved?: string): CoachingView {
 const allowed = availableViews(access), section = path[0];
 const inferred: CoachingView | undefined = section === 'admin' ? 'platform' : ['coach','profile','sessions','log','opportunities','availability','earnings','quality','onboarding','conflicts','practice-report'].includes(section) || (section === 'clients' && !path[1]) ? 'coach' : ['engagements','analytics','programs','billing','roi','saved','renewals','executive-report','request'].includes(section) ? 'company' : section === 'my' ? 'person' : undefined;
 if (inferred && allowed.includes(inferred)) return inferred;
 if (allowed.includes(saved as CoachingView)) return saved as CoachingView;
 return access.platformAdmin ? 'platform' : access.coach ? 'coach' : access.admin ? 'company' : 'person';
}
export const viewLinks: Record<CoachingView, [string, string][]> = {
 person: [['my','My Coaching'],['marketplace','Find a Coach'],['requests','My Requests'],['notifications','Notifications'],['feedback','Feedback']],
 coach: [['coach','Dashboard'],['opportunities','Opportunities'],['clients','Clients'],['sessions','Sessions'],['availability','Availability'],['log','Coaching Log'],['quality','Quality'],['outcomes','Development Outcomes'],['earnings','Earnings'],['profile','Profile'],['onboarding','Marketplace Readiness'],['notifications','Notifications']],
 company: [['engagements','Engagements'],['marketplace','Find a Coach'],['requests','Requests'],['programs','Programs'],['analytics','Analytics'],['outcomes','Development Outcomes'],['billing','Billing'],['feedback','Feedback'],['notifications','Notifications']],
 platform: [['overview','Coaching Operations'],['marketplace','Marketplace Health'],['coach-applications','Coach Applications'],['coaches','Coach Administration'],['requests','Access Requests'],['development-rules','Development Rules'],['financials','Financials'],['packages','Packages']],
};
