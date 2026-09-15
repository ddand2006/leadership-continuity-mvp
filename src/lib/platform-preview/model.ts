export const previewRoles = ['candidate', 'mentor', 'coachee', 'coach', 'company-admin'] as const;
export type PreviewRole = typeof previewRoles[number];
export type PreviewPage = { id: string; label: string; description: string };
export const roleLabels: Record<PreviewRole, string> = {
  candidate: 'Candidate', mentor: 'Mentor', coachee: 'Person Being Coached', coach: 'Coach', 'company-admin': 'Company Administrator',
};
const page = (id: string, label: string, description: string): PreviewPage => ({id, label, description});
const home = page('home', 'Dashboard', 'Your priorities, upcoming conversations, and development progress.');
const development = page('development', 'Development Plan', 'Build experience, record evidence, and review progress.');
const mentoring = page('mentoring', 'Mentoring', 'Prepare for a focused conversation and agree on next steps.');
const notifications = page('notifications', 'Notifications', 'Updates and reminders relevant to this workspace.');
const personal = page('personal-development', 'Personal Development', 'Connect strengths, role expectations, and your growth plan.');
const coaching = page('coaching', 'My Coaching', 'Your coaching engagement, goals, sessions, and shared progress.');
export const rolePages: Record<PreviewRole, PreviewPage[]> = {
  candidate: [home, page('profile','My Profile','Your target role, development priorities, and support network.'), development, mentoring, page('projects','Projects','Apply learning through departmental and cross-departmental projects.'), personal, coaching],
  mentor: [home, page('candidates','My Candidates','Candidates assigned to you for mentoring.'), mentoring, development, page('projects','Projects','Guide practical learning and review project evidence.'), page('resources','Resources','Preparation worksheets and project guidance.'), notifications],
  coachee: [home, coaching, page('goals','Goals & Actions','Agreed coaching goals and the next actions you own.'), page('sessions','Sessions','Upcoming sessions and your preparation.'), page('requests','My Requests','Review a proposed coach and the engagement invitation.'), page('consent','Sharing & Consent','Choose which development information is shared.'), page('feedback','Feedback','Reflect on your coaching experience.'), notifications],
  coach: [home, page('opportunities','Opportunities','Review requests for coaching and express interest.'), page('clients','Clients','Your active coaching clients and agreed development focus.'), page('sessions','Sessions','Prepare for, schedule, and record coaching sessions.'), page('availability','Availability','Your time zone, meeting windows, and coaching capacity.'), page('goals','Goals & Actions','Support agreed goals and review client follow-through.'), page('notes','Notes','Keep private notes separate from client-shared summaries.'), page('log','Coaching Log','Review coaching hours and credential-related records.'), page('quality','Quality','Reflect on practice indicators and professional development.'), page('earnings','Earnings','Review your coaching compensation and payment status.'), page('profile','Coach Profile','Your public profile and marketplace readiness.'), notifications],
  'company-admin': [home, page('roles','Roles','Define role expectations and priority competencies.'), page('candidates','Candidates','Review leaders, target roles, and development progress.'), mentoring, page('reviews','360 Review','Coordinate feedback and follow review progress.'), page('administration','Administration','Manage your company’s users and assignments.'), personal, page('marketplace','Find a Coach','Explore coaches for your leaders’ development needs.'), page('requests','Coaching Requests','Request coaching and follow matching progress.'), page('engagements','Engagements','Track agreed objectives and organization-shared progress.'), page('programs','Programs','Coordinate coaching across a leadership program.'), page('analytics','Analytics & Outcomes','Review participation, goal progress, and reported outcomes.'), page('billing','Billing','Review company coaching commitments and invoices.'), notifications],
};
export const sampleCompanies = [
  {id:'cedar',name:'Cedar Valley Health — sample',shortName:'Cedar Valley Health',people:['Jordan Ellis','Sam Rivera'],mentor:'Morgan Lee',coach:'Avery Brooks',admin:'Taylor Reed',role:'Director of Operations'},
  {id:'harbor',name:'Harbor Community Services — sample',shortName:'Harbor Community Services',people:['Riley Chen','Alex Parker'],mentor:'Casey Morgan',coach:'Drew Bennett',admin:'Jamie Walker',role:'Regional Director'},
] as const;
export function isPreviewRole(value: string): value is PreviewRole {return previewRoles.includes(value as PreviewRole);}
export function canUsePlatformPreview(profile: {role?: string; deleted_at?: string | null} | null, email?: string | null) {
  return profile?.role === 'system_admin' && !profile.deleted_at && email?.trim().toLowerCase() === 'david@cycleofbusiness.com';
}
export function resolveSample(company?: string | null, person?: string | null) {
  return {company:sampleCompanies.find(c=>c.id===company)??sampleCompanies[0], person:person==='second'?1:0};
}
export function sampleIdentity(role: PreviewRole, company?: string | null, person?: string | null) {
 const sample=resolveSample(company,person), org=sample.company;
 const name=role==='mentor'?org.mentor:role==='coach'?org.coach:role==='company-admin'?org.admin:org.people[sample.person];
 return {...sample,name,leader:org.people[sample.person]};
}
export function safeReturnPath(value?: string | null) {
 if(!value || !/^\/(?!\/)[a-zA-Z0-9/_-]*(?:\?[a-zA-Z0-9%=&_+-]*)?$/.test(value))return '/platform-operations';
 if(['/view-as','/api','/auth','/_next'].some(prefix=>value.split('?')[0]===prefix||value.startsWith(prefix+'/')))return '/platform-operations';
 return value;
}
export function previewHref(role: PreviewRole, section='home', values?: {company?:string|null;person?:string|null;returnTo?:string|null}) {
 const sample=resolveSample(values?.company,values?.person);
 const pageId=rolePages[role].some(p=>p.id===section)?section:'home';
 const query=new URLSearchParams({company:sample.company.id,person:sample.person?'second':'first',returnTo:safeReturnPath(values?.returnTo)});
 return `/view-as/${role}/${pageId}?${query}`;
}
