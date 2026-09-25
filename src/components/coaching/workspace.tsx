import {CoachingNavigation} from './navigation';
import {ScaleWorkspace,isScalePath} from '@/components/coaching-scale/workspace';
import {DevelopmentBody} from '@/components/development-intelligence/workspace';
import {DevelopmentOutcomes,DevelopmentConfiguration} from '@/components/development-intelligence/organization';
import {Commerce,isCommercePath,CommercialSummary} from './commerce';
import Link from 'next/link';
import {Workflow,isWorkflowPath,EngagementWorkflow} from './workflow';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import {cookies} from 'next/headers';
import {currentView, viewHomes} from '@/lib/coaching/views';
import type { ReactNode } from 'react';
import { coachingContext, rpc } from '@/lib/coaching/server';
import { availabilityLabels, consentTemplates, filterLog, logMetrics, type Coach, type LogRow, type Filters } from '@/lib/coaching/model';
import { CoachingForm, UnlockCoaching, ExportLog } from './form';
import { CoachOnboarding } from './coach-onboarding';
import { CoachReviewForm } from './coach-review-form';
import { Panel, Field, Select, Metrics } from './ui';
type Context = Awaited<ReturnType<typeof coachingContext>>;
type RecordRow = {
    id: string;
    title: string;
    status: string;
    progress: string;
    [key: string]: string;
};
const visibility = ['coach_private', 'coach_client', 'organization_shared'];
async function records(ctx: Context, table: string, column?: string, value?: string): Promise<RecordRow[]> {
    const rows: RecordRow[] = [];
    for (let offset = 0; ; offset += 500) {
        let query = ctx.db.from(table).select('*').order('id').range(offset, offset + 499);
        if (column && value) query = query.eq(column, value);
        const result = await query;
        if (result.error) throw new Error(result.error.message);
        rows.push(...result.data as RecordRow[]);
        if (result.data.length < 500) return rows;
    }
}
const options = (rows: RecordRow[], label = 'name') => rows.map(r => ({ value: r.id, label: r[label] }));
export async function CoachingWorkspace({ path, filters }: {
    path: string[];
    filters: Filters;
}) {
    const ctx = await coachingContext();
    if (!path.length) redirect(viewHomes[currentView(ctx,path,(await cookies()).get('coaching-view')?.value)]);
    const section = path[0] ?? 'overview';
    let content: ReactNode;
    if(isScalePath(path)) content=await ScaleWorkspace({path,filters:Object.fromEntries(Object.entries(filters).filter((entry):entry is [string,string]=>entry[1]!==undefined))});
    else if(section==='outcomes') content=await DevelopmentOutcomes();
    else if(section==='admin'&&path[1]==='development-rules') content=await DevelopmentConfiguration();
    else if(section==='clients'&&path[2]==='development') content=await DevelopmentBody({engagement:path[1]});
    else if (isCommercePath(path)) content=await Commerce({ctx,path,filters});
    else if (isWorkflowPath(path)) content=await Workflow({ctx,path,filters});
    else if (section === 'marketplace')
        content = await Marketplace({ ctx, id: path[1], filters });
    else if (section === 'clients' && path[1])
        content = await ClientDetail({ ctx, id: path[1], tab: filters.tab ?? 'Overview', filters });
    else if (section === 'log')
        content = await CoachingLog({ ctx, filters });
    else if (section === 'profile')
        content = ctx.coach ? await ProfileEditor({ ctx, profile: ctx.coach }) : <Panel>No coach profile is assigned to this account. Contact your platform administrator.</Panel>;
    else if (section === 'onboarding')
        content = ctx.coach ? <CoachOnboarding summary={await rpc(ctx.db, 'coach_portal_summary')} /> : <Panel>No coach profile is assigned to this account. Contact your platform administrator.</Panel>;
    else if (section === 'admin' && ctx.platformAdmin)
        content = await Administration({ ctx, section: path[1] });
    else if (['overview', 'engagements', 'coach', 'clients', 'my', 'sessions'].includes(section))
        content = await Overview({ ctx, section });
    else
        notFound();
    return <main className="app-page"><div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:px-10"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Leader Continuity</p><h1 className="mt-2 text-3xl font-semibold text-teal-950">Leadership Coaching</h1><p className="mt-2 text-slate-600">Connect leadership development, professional coaching, and shared progress.</p></header><CoachingNavigation access={ctx} path={path}/>{content}</div></main>;
}
async function Marketplace({ ctx, id, filters }: {
    ctx: Context;
    id?: string;
    filters: Filters;
}) {
    let coaches = await rpc<Coach[]>(ctx.db, 'coaching_marketplace');
    const extras = coaches as (Coach & {our_coach?:boolean;preferred?:boolean;similar_roles?:string[];similar_needs?:string[];recently_available?:boolean})[];
    coaches=extras.filter(c=>(filters.network!=='ours'||c.our_coach)&&(!filters.similar_role||c.similar_roles?.some(r=>r.toLowerCase().includes((filters.similar_role??'').toLowerCase())))&&(!filters.similar_need||c.similar_needs?.some(r=>r.toLowerCase().includes((filters.similar_need??'').toLowerCase())))&&(filters.recent!=='true'||c.recently_available));

    const pricing=await rpc<{mode:string;packages:{id:string;name:string;price:number|null;pricing_model:string}[]}>(ctx.db,'coaching_commerce_read',{section:'marketplace'});
    const commercialPricing=ctx.active&&ctx.admin&&pricing.mode!=='hidden'?<Panel title="Coaching packages">{pricing.mode==='request_quote'||!pricing.packages.length?<p>Pricing available with engagement request.</p>:pricing.mode==='starting_price'?<p>Coaching packages starting at {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.min(...pricing.packages.filter(p=>p.price!==null).map(p=>Number(p.price))))}. Final scope and price are confirmed in your quote.</p>:pricing.packages.map(p=><p key={p.id}>{p.name}: {p.price===null?'Request a quote':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.price)} · {p.pricing_model.replaceAll('_',' ')}</p>)}</Panel>:null;
    const selected = id ? coaches.find(c => c.id === id) : null;
    if (id && !selected)
        notFound();
    const locked = <Panel title="Professional Coaching is available as an add-on to Leader Continuity"><p className="mb-4">Add professional coaching to your Leader Continuity program to view coach availability, request engagements, and connect coaching directly to leadership development plans.</p>{ctx.admin ? <UnlockCoaching /> : <p>Ask your organization administrator to unlock Coaching.</p>}</Panel>;
    if (selected) {
        const windows=(ctx.active&&!ctx.coach)||ctx.coach?.id===selected.id?await rpc<{day_of_week:number;start_time:string;end_time:string;timezone:string}[]>(ctx.db,'coaching_availability_summary',{cid:selected.id}):[];

        return <><Link href="/coaching/marketplace" className="underline">Back to marketplace</Link><CoachCard coach={selected} detail/>{commercialPricing}{windows.length>0&&<Panel title="General availability windows">{windows.map((w,i)=><p key={i}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][w.day_of_week]} · {w.start_time}–{w.end_time} · {w.timezone}</p>)}<p className="mt-3 text-sm">Exact open slots are checked in the engagement scheduling workflow.</p></Panel>}{!ctx.active ? locked : <Panel title="Request This Coach">{ctx.admin&&selected.availability_status!=='unavailable'?<Link className="underline font-semibold" href="/coaching/request">Find a Coach — start a request</Link>:<p>Your organization administrator can start a coaching request.</p>}</Panel>}</>;
    }
    const unique = (key: 'specialties' | 'industries' | 'leadership_levels') => [...new Set(coaches.flatMap(c => c[key]))].sort();
    const visible = coaches.filter(c => (!filters.q || [c.display_name, c.headline, c.short_bio, ...c.specialties, ...c.industries].join(' ').toLowerCase().includes(filters.q.toLowerCase())) && (!filters.specialty || c.specialties.includes(filters.specialty)) && (!filters.industry || c.industries.includes(filters.industry)) && (!filters.level || c.leadership_levels.includes(filters.level)) && (!filters.credential || c.icf_credential === filters.credential) && (!filters.format || (filters.format === 'virtual' ? c.virtual_available : c.in_person_available)) && (!ctx.active || !filters.availability || c.availability_status === filters.availability));
    await ctx.db.rpc('coaching_scale_observe',{dimensions:Object.fromEntries(['specialty','industry','level','credential','format'].filter(k=>filters[k]).map(k=>[k,filters[k]])),result_count:visible.length});
    visible.sort((a, b) => filters.sort === 'name' ? a.display_name.localeCompare(b.display_name) : filters.sort === 'experience' ? b.years_coaching - a.years_coaching : filters.sort === 'credential' ? ['none', 'other', 'acc', 'pcc', 'mcc'].indexOf(b.icf_credential) - ['none', 'other', 'acc', 'pcc', 'mcc'].indexOf(a.icf_credential) : Number((b as Coach & {preferred?:boolean}).preferred??false)-Number((a as Coach & {preferred?:boolean}).preferred??false)||Date.parse(b.approved_at) - Date.parse(a.approved_at));
    return <>{commercialPricing}<Panel title="Leadership Coaching Marketplace"><p>Connect your leaders with experienced professional coaches who can support executive development, succession readiness, leadership transitions, and targeted development priorities.</p><form className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field name="q" label="Search coaches" value={filters.q}/><Select name="network" options={[{value:"all",label:"All marketplace coaches"},{value:"ours",label:"Our coach network"}]} value={filters.network}/><Field name="similar_role" label="Experience with similar role" value={filters.similar_role}/><Field name="similar_need" label="Experience with development need" value={filters.similar_need}/><Select name="recent" options={[{value:"false",label:"Any availability update"},{value:"true",label:"Recently available"}]} value={filters.recent}/><Select name="specialty" options={unique('specialties')} empty="All specialties" value={filters.specialty}/><Select name="industry" options={unique('industries')} empty="All industries" value={filters.industry}/><Select name="level" label="Leadership level" options={unique('leadership_levels')} empty="All levels" value={filters.level}/><Select name="credential" options={['acc', 'pcc', 'mcc', 'none', 'other']} empty="All credentials" value={filters.credential}/><Select name="format" options={['virtual', 'in_person']} empty="All formats" value={filters.format}/>{ctx.active && <Select name="availability" options={Object.entries(availabilityLabels).map(([value, label]) => ({ value, label }))} empty="All availability" value={filters.availability}/>}<Select name="sort" options={['recommended', 'name', 'experience', 'credential']} value={filters.sort}/><button className="rounded-full border p-2">Apply filters</button><Link href="/coaching/marketplace" className="p-2 underline">Clear filters</Link></form></Panel>{!ctx.active && locked}<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(c => <CoachCard key={c.id} coach={c}/>)}</div>{!visible.length && <Panel title="No coaches match your current filters.">Try expanding your specialties, credential level, or industry filters.</Panel>}</>;
}
function CoachCard({ coach: c, detail = false }: {
    coach: Coach;
    detail?: boolean;
}) {
    return <Panel><div className="flex items-start gap-3">{c.photo_url && /^https:\/\//.test(c.photo_url) ? <Image unoptimized width={64} height={64} alt={c.display_name} src={c.photo_url} className="h-16 w-16 rounded-full object-cover"/> : <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xl text-teal-900">{c.display_name.slice(0, 1)}</div>}<div><h2 className="text-xl font-semibold">{c.display_name}</h2><p>{c.headline}</p><p className="text-sm text-teal-800">{c.icf_credential==='none'?'Credential verification pending':c.icf_credential.toUpperCase()}{c.credential_expired ? ' · Credential Expired' : ''}</p></div></div><p className="my-4">{detail ? c.full_bio || c.short_bio : c.short_bio}</p><p className="text-sm">{c.years_coaching ?? 0} years coaching · {c.years_leadership_experience ?? 0} years leadership</p><p className="my-3 text-sm">{c.specialties.slice(0, detail ? 99 : 3).join(' · ')}</p><p className="text-sm">{c.industries.join(' · ')}</p><p className="mt-2 text-sm">{c.leadership_levels.join(' · ')}</p><p className="mt-3 text-sm">{[c.virtual_available ? 'Virtual' : null, c.in_person_available ? 'In person' : null].filter(Boolean).join(' / ')}</p><p className="mt-3 font-medium text-teal-800">{c.availability_status ? availabilityLabels[c.availability_status] : 'Availability details available with Coaching.'}</p>{detail ? <><p className="mt-4">{[c.city, c.country].filter(Boolean).join(', ')}</p><p>{c.coaching_philosophy}</p><p>{c.languages.join(', ')}</p></> : <Link className="mt-5 inline-block font-semibold underline" href={`/coaching/marketplace/${c.id}`}>View Profile</Link>}</Panel>;
}
async function Overview({ ctx, section }: {
    ctx: Context;
    section: string;
}) {
    let engagements = await records(ctx, 'coaching_engagements');
    if (section === 'my')
        engagements = engagements.filter(e => e.coachee_user_id === ctx.user.id);
    if (['coach', 'clients', 'sessions'].includes(section))
        engagements = engagements.filter(e => e.coach_id === ctx.coach?.id);
    const quarterStart = new Date(Date.UTC(new Date().getUTCFullYear(), Math.floor(new Date().getUTCMonth() / 3) * 3, 1)).toISOString().slice(0, 10);
    const detailed = await Promise.all(engagements.map(async (e) => ({ ...e, directory: await rpc<RecordRow>(ctx.db, 'coaching_directory', { eid: e.id }), hours: Number(await rpc<number>(ctx.db, 'coaching_hours', { eid: e.id })), quarterHours: Number(await rpc<number>(ctx.db, 'coaching_hours', { eid: e.id, date_from: quarterStart })) })));
    const requests = ctx.admin ? await records(ctx, 'coach_requests') : [];
    const members = ctx.admin ? await records(ctx, 'profiles') : [];
    const sessions = ctx.coach ? await records(ctx, 'coaching_sessions', 'coach_id', ctx.coach.id) : [];
    const log = ctx.coach ? await rpc<LogRow[]>(ctx.db, 'coaching_credential_log') : [];
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const actions = ctx.coach ? await records(ctx, 'coaching_actions') : [];
    const consents = ctx.coach ? await records(ctx, 'coaching_consents') : [];
    const coachView = ['coach', 'clients', 'sessions'].includes(section);
    return <>{!ctx.active && ctx.admin && ['overview','engagements'].includes(section) && <Panel title="Professional Coaching is available as an extension of Leader Continuity."><p className="mb-4">Browse the marketplace to explore available coaches, then activate Coaching when your organization is ready to begin.</p><UnlockCoaching /></Panel>}<Metrics values={coachView ? { 'Active Clients': new Set(engagements.filter(e => e.status === 'active').map(e => e.coachee_user_id)).size, 'Sessions This Week': sessions.filter(s => s.session_date >= today && s.session_date < weekEnd && s.status === 'scheduled').length, 'Hours This Month': log.filter(r => r.session_date.startsWith(today.slice(0, 7))).reduce((n, r) => n + Number(r.duration_minutes) / 60, 0), 'Hours This Year': log.filter(r => r.session_date.startsWith(today.slice(0, 4))).reduce((n, r) => n + Number(r.duration_minutes) / 60, 0), 'Paid Hours': logMetrics(log)['Paid Hours'], 'Pro Bono Hours': logMetrics(log)['Pro Bono Hours'] } : { 'Active Coaching Engagements': engagements.filter(e => e.status === 'active').length, 'Coaches': new Set(engagements.map(e => e.coach_id)).size, 'Hours This Quarter': detailed.reduce((n, e) => n + e.quarterHours, 0), 'Completed Engagements': engagements.filter(e => e.status === 'completed').length }}/>
  {coachView && <Panel title={section === 'sessions' ? 'Sessions' : "Today's Sessions"}>{sessions.filter(s => section === 'sessions' || s.session_date === today).map(s => <p key={s.id} className="mb-2"><Link className="underline" href={`/coaching/clients/${s.engagement_id}?tab=Sessions`}>{s.session_date} · {detailed.find(e => e.id === s.engagement_id)?.directory.client} · {s.status}</Link></p>)}{!sessions.length && <p>No sessions logged yet. Open a client to schedule or log a session.</p>}</Panel>}
  {coachView && <Panel title="Action Needed"><p>{sessions.filter(s => s.status === 'scheduled' && s.session_date < today).length} incomplete session logs</p><p>{actions.filter(a => !['completed', 'cancelled'].includes(a.status) && a.due_date && a.due_date < today).length} overdue client actions</p><p>{engagements.filter(e => !consents.some(c => c.engagement_id === e.id && c.consent_type === 'coaching_record_retention' && String(c.consent_given) === 'true' && String(c.revoked) !== 'true')).length} clients missing record-retention consent</p></Panel>}
  <Panel title={section === 'my' ? 'My Coaching' : 'Coaching Engagements'}>{!detailed.length ? <p>You do not have any coaching engagements. <Link className="underline" href="/coaching/marketplace">Explore the Coaching Marketplace</Link>.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Leader', 'Coach', 'Purpose', 'Hours', 'Progress', 'Status', ''].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{detailed.map(e => <tr key={e.id} className="border-t"><td className="p-3">{e.directory.client}<small className="block">{e.directory.organization}</small></td><td className="p-3">{e.directory.coach}</td><td className="p-3">{e.title}</td><td className="p-3">{e.hours.toFixed(2)}</td><td className="p-3">{e.progress}</td><td className="p-3">{e.status}</td><td className="p-3"><Link className="underline" href={`/coaching/clients/${e.id}`}>Open engagement</Link></td></tr>)}</tbody></table></div>}</Panel>
  {ctx.admin && ['overview','engagements'].includes(section) && requests.length > 0 && <Panel title="Coach Requests"><div className="grid gap-5 md:grid-cols-2">{requests.map(r => <Panel key={r.id} title={r.request_reason || 'Coaching request'}><p className="mb-3">{r.status} · {r.development_focus}</p>{r.status !== 'converted_to_engagement' && Number(r.workflow_version)===1 && ctx.active && <CoachingForm operation="create_engagement" hidden={{ id: r.id }} button="Create Engagement"><Field name="title" label="Engagement title (organization-shared)" required/><Select name="coachee_user_id" label="Leader" options={members.filter(p => p.organization_id === r.organization_id).map(p => ({ value: p.auth_user_id, label: p.full_name }))} value={r.requested_for_user_id}/><Select name="engagement_type" options={['executive_coaching', 'leadership_development', 'succession_readiness', 'executive_transition', 'performance_coaching', 'career_coaching', 'onboarding_coaching', 'custom']}/><Select name="funding_type" options={['organization_paid', 'individual_paid', 'platform_sponsored', 'pro_bono', 'other']}/></CoachingForm>}</Panel>)}</div></Panel>}</>;
}
async function ClientDetail({ ctx, id, tab, filters }: {
    ctx: Context;
    id: string;
    tab: string;
    filters: Filters;
}) {
    const e = (await records(ctx, 'coaching_engagements', 'id', id))[0];
    if (!e)
        notFound();
    const directory = await rpc<RecordRow>(ctx.db, 'coaching_directory', { eid: id });
    const coach = e.coach_id === ctx.coach?.id;
    const client = e.coachee_user_id === ctx.user.id;
    const participant = coach || client;
    const hidden = { engagement_id: id };
    const sections = participant ? ['Overview', 'Development', 'Goals', 'Actions', 'Sessions', 'Schedule', 'Notes', 'Consent', 'Closeout'] : ['Overview', 'Goals', 'Actions', 'Notes', 'Closeout'];
    if(ctx.platformAdmin) sections.push('Commercial');
    if (!sections.includes(tab))
        notFound();
    const progress=await rpc<Record<string,number>>(ctx.db,'coaching_engagement_progress',{eid:id});
    let body: ReactNode;
    if(tab==='Commercial') body=await CommercialSummary({ctx,id});
    else if (tab==='Schedule'||tab==='Closeout') body=await EngagementWorkflow({ctx,id,tab,filters});
    else if (tab === 'Consent') {
        const consents = await records(ctx, 'coaching_consents', 'engagement_id', id);
        body = <Panel title="Consent & Privacy"><p className="mb-5">{Number(e.consent_policy_version)===2?'This engagement requires the four listed consents before activation. Each can be revoked separately.':'Record retention is required to activate coaching. Other permissions are optional and can be revoked separately.'} Organization administrators can see participation metadata and coaching-hour totals; private notes remain restricted.</p><div className="grid gap-5 md:grid-cols-2">{Object.entries(consentTemplates).map(([kind, text]) => {
                const latest = consents.filter(c => c.consent_type === kind).sort((a, b) => b.consent_date.localeCompare(a.consent_date))[0];
                const given = latest && String(latest.consent_given) === 'true' && String(latest.revoked) !== 'true';
                return <Panel key={kind} title={kind.replaceAll('_', ' ')}><p className="mb-3">{text}</p><p className="mb-3 font-semibold">{given ? 'Granted' : 'Not granted'}</p>{client && <CoachingForm operation="consent" hidden={{ ...hidden, consent_type: kind, consent_given: given ? 'false' : 'true' }} button={given ? 'Revoke consent' : 'Give consent'}/>}</Panel>;
            })}</div></Panel>;
    }
    else if (tab === 'Development') {
        const shared = await rpc<RecordRow[]>(ctx.db, 'coaching_development', { eid: id });
        const available = client ? await rpc<RecordRow[]>(ctx.db, 'coaching_development', { eid: id, available: true }) : shared;
        const permissions = await records(ctx, 'coaching_data_permissions', 'engagement_id', id);
        body = <Panel title="Authorized Development Information"><p className="mb-4">Only specifically selected competencies and development-plan records are shared. Revoking consent stops this access immediately.</p>{!available.length && <p>No development records are available. The engagement must link to the leader’s existing candidate record.</p>}<div className="grid gap-4">{available.map(d => { const permission = permissions.find(p => p.data_id === d.id && !p.revoked_at); return <Panel key={d.id} title={d.title}><p className="mb-3">{d.description}</p>{client && <CoachingForm operation="data_permission" hidden={{ ...hidden, ...(permission ? { id: permission.id, revoke: 'true' } : { data_id: d.id, data_type: d.data_type }) }} button={permission ? 'Revoke access' : 'Share with coach'}/>}</Panel>; })}</div></Panel>;
    }
    else if (tab === 'Sessions') {
        const sessions = await records(ctx, 'coaching_sessions', 'engagement_id', id);
        const sessionFields = (s?: RecordRow) => <><Field name="session_date" type="date" value={s?.session_date ?? new Date().toISOString().slice(0, 10)} required/><Select name="status" options={['scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled']} value={s?.status}/><Field name="scheduled_start_at" label="Scheduled start (include UTC offset)" value={s?.scheduled_start_at}/><Field name="scheduled_end_at" label="Scheduled end (include UTC offset)" value={s?.scheduled_end_at}/><Field name="actual_start_at" label="Actual start (e.g. 2026-09-15T09:00:00-06:00)" value={s?.actual_start_at}/><Field name="actual_end_at" label="Actual end (include UTC offset)" value={s?.actual_end_at}/><Select name="coaching_category" options={['individual', 'group', 'team']} value={s?.coaching_category}/><Select name="compensation_category" options={['paid', 'pro_bono']} value={s?.compensation_category}/><Select name="session_format" options={['video', 'phone', 'in_person', 'other']} value={s?.session_format}/></>;
        body = <><Panel title="Sessions"><div className="grid gap-4 md:grid-cols-2">{sessions.map(s => <Panel key={s.id} title={`${s.session_date} · ${s.status}`}><p className="mb-3">{s.duration_minutes ?? 0} minutes · {s.coaching_category} · {s.compensation_category}</p>{client && String(s.coachee_confirmed) !== 'true' && <CoachingForm operation="confirm_session" hidden={{ ...hidden, id: s.id }} button="Confirm session"/>}{coach && <details><summary className="cursor-pointer underline">Update session log</summary><CoachingForm operation="session" hidden={{ ...hidden, id: s.id }}>{sessionFields(s)}</CoachingForm></details>}</Panel>)}</div>{!sessions.length && <p>No sessions yet.</p>}</Panel>{coach && <Panel title="Log Session"><CoachingForm operation="session" hidden={hidden} button="Save session">{sessionFields()}</CoachingForm></Panel>}</>;
    }
    else if (['Notes', 'Goals', 'Actions'].includes(tab)) {
        const table = tab === 'Notes' ? 'coaching_notes' : tab === 'Goals' ? 'coaching_goals' : 'coaching_actions';
        const rows = await records(ctx, table, 'engagement_id', id);
        const development = coach && tab === 'Goals' ? await rpc<RecordRow[]>(ctx.db, 'coaching_development', { eid: id }) : [];
        const goals = coach && tab === 'Actions' ? await records(ctx, 'coaching_goals', 'engagement_id', id) : [];
        body = <><Panel title={tab}><div className="grid gap-4 md:grid-cols-2">{rows.map(r => <Panel key={r.id} title={r.title}><p className="mb-2 text-xs uppercase text-teal-800">{r.visibility.replaceAll('_', ' ')} {r.status && `· ${r.status}`}</p><p className="whitespace-pre-wrap">{r.content ?? r.description}</p>{r.due_date && <p className="mt-2">Due: {r.due_date}</p>}{r.target_text && <p>Target: {r.target_text}</p>}{tab === 'Actions' && client && r.status !== 'completed' && <CoachingForm operation="complete_action" hidden={{ ...hidden, id: r.id }} button="Complete action"/>}{tab === 'Goals' && coach && <CoachingForm operation="goal" hidden={{ ...hidden, id: r.id, title: r.title, description: r.description ?? '', visibility: r.visibility, baseline_text: r.baseline_text ?? '', target_text: r.target_text ?? '', competency_id: r.competency_id ?? '', development_plan_item_id: r.development_plan_item_id ?? '' }}><Select name="status" options={['planned', 'active', 'achieved', 'paused', 'discontinued']} value={r.status}/></CoachingForm>}</Panel>)}</div>{!rows.length && <p>No {tab.toLowerCase()} are shared with you yet.</p>}</Panel>{(coach || (client && tab === 'Notes')) && <Panel title={tab === 'Notes' ? (coach ? 'Add coaching note' : 'Add reflection') : `Add ${tab === 'Goals' ? 'goal' : 'action'}`}><CoachingForm operation={tab === 'Notes' ? 'note' : tab === 'Goals' ? 'goal' : 'action'} hidden={hidden}><Field name="title" required/><Field name={tab === 'Notes' ? 'content' : 'description'} type="textarea" required/><Select name="visibility" options={coach ? visibility : ['coach_client', 'organization_shared']} value={tab === 'Notes' && coach ? 'coach_private' : 'coach_client'}/>{tab === 'Goals' && <><Field name="baseline_text" label="Starting point"/><Field name="target_text" label="Target outcome"/><Field name="target_date" type="date"/><Select name="competency_id" label="Linked competency" options={options(development.filter(d => d.data_type === 'competencies'), 'title')} empty="No competency link"/><Select name="development_plan_item_id" label="Linked development record" options={options(development.filter(d => d.data_type === 'development_plan'), 'title')} empty="No development-plan link"/></>}{tab === 'Actions' && <><Select name="goal_id" options={options(goals, 'title')} empty="No goal link"/><Field name="due_date" type="date"/></>}</CoachingForm></Panel>}</>;
    }
    else {
        body = <Panel title="Engagement Overview"><p className="mb-4">{e.organization_objectives || 'No organization objectives recorded.'}</p><p>Hours: {Number(await rpc<number>(ctx.db, 'coaching_hours', { eid: id })).toFixed(2)}</p><p>Start: {e.start_date} · Status: {e.status} · Progress: {e.progress}</p>{(coach || ctx.admin) && <div className="mt-5 grid gap-5 md:grid-cols-2"><CoachingForm operation="engagement_status" hidden={hidden}><Select name="status" options={['requested', 'coach_invited', 'coach_accepted', 'coachee_invited', 'coachee_accepted', 'active', 'paused', 'completed', 'cancelled', 'declined']} value={e.status}/></CoachingForm><CoachingForm operation="progress" hidden={hidden}><Select name="progress" options={['Not Started', 'In Progress', 'On Track', 'Needs Attention', 'Completed']} value={e.progress}/></CoachingForm></div>}</Panel>;
    }
    return <><Panel title={directory.client}><p>{directory.organization} · Coach: {directory.coach}</p><p>{e.title} · {e.engagement_type.replaceAll('_', ' ')}</p><nav aria-label="Client coaching sections" className="mt-5 flex flex-wrap gap-4">{sections.map(t => <Link aria-current={tab === t ? 'page' : undefined} className={`underline ${tab === t ? 'font-bold' : ''}`} key={t} href={t==='Development'?`/coaching/clients/${id}/development`:`/coaching/clients/${id}?tab=${t}`}>{t}</Link>)}</nav></Panel><Metrics values={progress}/>{body}</>;
}
async function CoachingLog({ ctx, filters }: {
    ctx: Context;
    filters: Filters;
}) {
    if (!ctx.coach)
        notFound();
    const all = await rpc<LogRow[]>(ctx.db, 'coaching_credential_log');
    const rows = filterLog(all, filters);
    const unique = (key: 'client_id' | 'organization_id' | 'engagement_id', label: 'client_name' | 'organization' | 'engagement_id') => [...new Map(all.map(r => [r[key], { value: r[key], label: r[label] }])).values()];
    return <><Panel title="Coaching Log"><p className="mb-4">Completed sessions supply this log automatically. Hours include only the sessions selected by your filters.</p><form className="grid gap-3 md:grid-cols-3"><Field name="from" label="From" type="date" value={filters.from}/><Field name="to" label="Through" type="date" value={filters.to}/><Select name="client" options={unique('client_id', 'client_name')} empty="All clients" value={filters.client}/><Select name="organization" options={unique('organization_id', 'organization')} empty="All organizations" value={filters.organization}/><Select name="engagement" options={unique('engagement_id', 'engagement_id')} empty="All engagements" value={filters.engagement}/><Select name="compensation" options={['paid', 'pro_bono']} empty="Paid and pro bono" value={filters.compensation}/><Select name="category" options={['individual', 'group', 'team']} empty="All categories" value={filters.category}/><button className="rounded-full border p-2">Apply filters</button></form></Panel><Metrics values={logMetrics(rows)}/><Panel><ExportLog query={new URLSearchParams(Object.entries(filters).filter((entry): entry is [
        string,
        string
    ] => entry[1] !== undefined)).toString()}/><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Client', 'Organization', 'Date', 'Minutes', 'Compensation', 'Category', 'Credential consent'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr className="border-t" key={r.id}><td className="p-3">{r.client_name}</td><td className="p-3">{r.organization}</td><td className="p-3">{r.session_date}</td><td className="p-3">{r.duration_minutes}</td><td className="p-3">{r.compensation_category}</td><td className="p-3">{r.coaching_category}</td><td className="p-3">{r.consent_recorded ? 'Recorded' : 'Not granted'}</td></tr>)}</tbody></table></div>{!rows.length && <p>No completed sessions match your filters.</p>}</Panel></>;
}
async function ProfileEditor({ ctx, profile }: {
    ctx: Context;
    profile?: RecordRow;
}) {
    const refs = await Promise.all(['coaching_specialties', 'industries', 'leadership_levels'].map(t => records(ctx, t)));
    const joins = profile ? await Promise.all(['coach_specialties', 'coach_industries', 'coach_leadership_levels'].map(t => records(ctx, t, 'coach_id', profile.id))) : [[], [], []];
    return <Panel title={profile ? 'Edit Coach Profile' : 'Create Coach'}><CoachingForm operation="save_profile" hidden={profile ? { id: profile.id } : {}}><div className="grid gap-3 md:grid-cols-2">{['display_name', 'headline', 'email', 'phone', 'photo_url', 'city', 'country', 'timezone', 'icf_credential_number'].map(name => <Field key={name} name={name} value={profile?.[name]} required={name === 'display_name'}/>)}{ctx.platformAdmin && <Field name="user_id" label="Existing coach account auth user ID" value={profile?.user_id}/>}<Field name="years_coaching" type="number" value={profile?.years_coaching ?? 0}/><Field name="years_leadership_experience" type="number" value={profile?.years_leadership_experience ?? 0}/><Field name="icf_credential_expiration_date" type="date" value={profile?.icf_credential_expiration_date}/><Select name="icf_credential" options={['none', 'acc', 'pcc', 'mcc', 'other']} value={profile?.icf_credential}/><Select name="availability_status" options={['available', 'limited', 'unavailable']} value={profile?.availability_status}/><Select name="virtual_available" options={['true', 'false']} value={String(profile?.virtual_available ?? true)}/><Select name="in_person_available" options={['false', 'true']} value={String(profile?.in_person_available ?? false)}/><Field name="languages" label="Languages (separate with commas)" value={Array.isArray(profile?.languages) ? profile.languages.join(', ') : ''}/></div>{['short_bio', 'full_bio', 'coaching_philosophy'].map(name => <Field key={name} name={name} type="textarea" value={profile?.[name]}/>)}{refs.map((rows, index) => <fieldset key={index} className="rounded-xl border p-3"><legend>{['Specialties', 'Industries', 'Leadership levels'][index]}</legend><div className="flex flex-wrap gap-3">{rows.map(r => <label key={r.id} className="flex items-center gap-2"><input type="checkbox" name={['specialty_ids', 'industry_ids', 'leadership_level_ids'][index]} value={r.id} defaultChecked={joins[index].some(j => j[['specialty_id', 'industry_id', 'leadership_level_id'][index]] === r.id)}/>{r.name}</label>)}</div></fieldset>)}</CoachingForm></Panel>;
}
async function Administration({ ctx, section }: {
    ctx: Context;
    section: string;
}) {
    if (section === 'requests') {
        const requests = await records(ctx, 'coaching_opt_in_requests');
        const orgs = await records(ctx, 'organizations');
        return <Panel title="Coaching Access Requests"><div className="grid gap-4">{requests.map(r => <Panel key={r.id} title={orgs.find(o => o.id === r.organization_id)?.name ?? r.organization_id}><p>Requested: {r.created_at?.slice(0, 10)} · {r.status}</p><p>{r.notes}</p>{r.status === 'pending' && <div className="mt-3 flex gap-3"><CoachingForm operation="review_opt_in" hidden={{ id: r.id, decision: 'approved' }} button="Approve"/><CoachingForm operation="review_opt_in" hidden={{ id: r.id, decision: 'declined' }} button="Decline"/></div>}</Panel>)}</div>{!requests.length && <p>No pending coaching access requests.</p>}</Panel>;
    }
    if (section !== 'coaches')
        notFound();
    const coaches = await records(ctx, 'coach_profiles');
    const compliance = await rpc<Array<{profile: RecordRow; insurance?: RecordRow; credential?: RecordRow}>>(ctx.db, 'coach_portal_admin_summary');
    return <>{await ProfileEditor({ ctx })}<Panel title="Coach Administration">{coaches.map(c => { const row = compliance.find(item => item.profile.id === c.id); return <details key={c.id} className="mb-4 rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">{c.display_name} · {c.icf_credential.toUpperCase()} · {c.profile_status} · {c.credential_verification_status}</summary><div className="my-4"><CoachingForm operation="review_profile" hidden={{ id: c.id }}><Select name="profile_status" options={['draft', 'pending_review', 'approved', 'suspended', 'inactive']} value={c.profile_status}/><Select name="credential_verification_status" options={['unverified', 'pending', 'verified', 'expired', 'rejected']} value={c.credential_verification_status}/></CoachingForm></div>{row && <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Eligibility:</strong> {String(c.eligibility_status ?? 'action_required').replaceAll('_',' ')}</p><p><strong>Insurance:</strong> {row.insurance ? `${row.insurance.insurer} · ${row.insurance.verification_status} · expires ${row.insurance.expiration_date}` : 'Not submitted'}</p><p><strong>Credential:</strong> {row.credential ? `${row.credential.credential_name} · ${row.credential.verification_status}` : 'Not submitted'}</p><div className="mt-3 flex flex-wrap gap-2">{row.insurance && <><CoachReviewForm coachId={c.id} decision="verify_insurance" label="Verify insurance"/><CoachReviewForm coachId={c.id} decision="reject_insurance" label="Reject insurance"/></>}{row.credential && <><CoachReviewForm coachId={c.id} decision="verify_credential" label="Verify credential"/><CoachReviewForm coachId={c.id} decision="reject_credential" label="Reject credential"/></>}<CoachReviewForm coachId={c.id} decision={c.profile_status === 'suspended' ? 'restore' : 'suspend'} label={c.profile_status === 'suspended' ? 'Restore coach' : 'Suspend coach'}/></div></div>}<ProfileEditor ctx={ctx} profile={c}/></details>; })}</Panel></>;
}
