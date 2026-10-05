import { rpc } from '@/lib/coaching/server';
import { CoachingForm } from './form';
import { Field, Panel, Select } from './ui';

type TemplateRow = { agreement?: Record<string, string>; action_plan?: Record<string, string>; progress_reports?: Record<string, string>[]; summary?: Record<string, string> };

const text = (value: unknown) => typeof value === 'string' ? value : '';

function TemplateFields({ kind, data }: { kind: 'agreement' | 'action_plan' | 'progress_report' | 'summary'; data: Record<string, string> }) {
  if (kind === 'agreement') return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="coachee" label="Leader / coachee" value={data.coachee}/><Field name="coachee_email" label="Coachee email" value={data.coachee_email}/><Field name="coach" label="Coach" value={data.coach}/><Field name="sponsor" label="Manager or sponsor" value={data.sponsor}/><Field name="sponsor_email" label="Sponsor email" value={data.sponsor_email}/><Field name="hr_sponsor" label="HR sponsor" value={data.hr_sponsor}/><Field name="organization" label="Organization" value={data.organization}/><Field name="job_title" label="Coachee role" value={data.job_title}/><Field name="start_date" label="Start date" type="date" value={data.start_date}/><Field name="end_date" label="Planned end date" type="date" value={data.end_date}/><Field name="assignment_length" label="Engagement length" value={data.assignment_length}/></div>
    <Field name="confidentiality" label="Confidentiality and information-sharing agreement" type="textarea" value={data.confidentiality}/>
    <Field name="business_context" label="Business context and key challenges" type="textarea" value={data.business_context}/>
    <Field name="strengths" label="Performance strengths and behaviors" type="textarea" value={data.strengths}/>
    <Field name="focus_areas" label="Priority growth and development areas" type="textarea" value={data.focus_areas}/>
    <Field name="sharing_notes" label="What may be shared with the sponsor, and at what level" type="textarea" value={data.sharing_notes}/>
    <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-semibold">Information-sharing permissions</h3><p className="mt-1 text-sm text-slate-600">Choose no share, summary, or detailed sharing for each area. Private coaching notes remain private.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><Select name="share_assessments" label="Assessments" options={['not_shared','summary','detailed']} value={data.share_assessments}/><Select name="share_agreement" label="Coaching agreement" options={['not_shared','summary','detailed']} value={data.share_agreement}/><Select name="share_status_updates" label="Status updates" options={['not_shared','summary','detailed']} value={data.share_status_updates}/><Select name="share_action_plan" label="Action plan" options={['not_shared','summary','detailed']} value={data.share_action_plan}/></div></div>
  </>;
  if (kind === 'action_plan') return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="start_date" label="Start date" type="date" value={data.start_date}/><Field name="end_date" label="Planned end date" type="date" value={data.end_date}/><Field name="timeframe" label="Review timeframe" value={data.timeframe}/></div>
    {[1,2,3].map(n => <div className="rounded-2xl border border-slate-200 p-4" key={n}><h3 className="font-semibold">Development goal {n}</h3><Field name={`outcome_${n}`} label="Desired outcome and measure" type="textarea" value={data[`outcome_${n}`]}/><Field name={`action_${n}`} label="Action steps" type="textarea" value={data[`action_${n}`]}/><Field name={`impact_${n}`} label="Expected business or team impact" type="textarea" value={data[`impact_${n}`]}/></div>)}
    <Field name="accelerators" label="Accelerators: resources and people who can help" type="textarea" value={data.accelerators}/><Field name="derailers" label="Potential derailers and mitigation" type="textarea" value={data.derailers}/>
  </>;
  if (kind === 'progress_report') return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="report_date" label="Report date" type="date" value={data.report_date}/><Select name="milestone" label="Milestone" options={['2_month','4_month','final']} value={data.milestone}/></div>
    <Field name="progress_summary" label="Progress summary" type="textarea" value={data.progress_summary}/><Field name="observed_changes" label="Observed leadership changes" type="textarea" value={data.observed_changes}/><Field name="business_impact" label="Business or team impact" type="textarea" value={data.business_impact}/><Field name="next_steps" label="Recommended next steps" type="textarea" value={data.next_steps}/><Field name="manager_feedback" label="Manager or sponsor feedback" type="textarea" value={data.manager_feedback}/>
  </>;
  return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="start_date" label="Start date" type="date" value={data.start_date}/><Field name="end_date" label="End date" type="date" value={data.end_date}/></div>
    {[1,2,3].map(n => <div className="rounded-2xl border border-slate-200 p-4" key={n}><h3 className="font-semibold">Development focus {n}</h3><Field name={`focus_${n}`} label="Focus area" value={data[`focus_${n}`]}/><div className="grid gap-3 md:grid-cols-3"><Select name={`start_rating_${n}`} label="Starting rating" options={['1','2','3','4','5']} value={data[`start_rating_${n}`]}/><Select name={`end_rating_${n}`} label="Ending rating" options={['1','2','3','4','5']} value={data[`end_rating_${n}`]}/><Field name={`goal_${n}`} label="Goal at end" value={data[`goal_${n}`]}/></div><Field name={`comment_${n}`} label="Comment or evidence" type="textarea" value={data[`comment_${n}`]}/></div>)}
    <Field name="business_examples" label="Specific business, team, or organizational examples" type="textarea" value={data.business_examples}/><Field name="impact_value" label="Impact or value to the leader, team, and organization" type="textarea" value={data.impact_value}/><Field name="next_steps" label="Next steps to sustain development" type="textarea" value={data.next_steps}/><Field name="new_practices" label="New leadership practices or behaviors" type="textarea" value={data.new_practices}/>
  </>;
}

export async function CoachingTemplates({ ctx, engagementId }: { ctx: { db: Parameters<typeof rpc>[0] }; engagementId: string }) {
  const data = await rpc<TemplateRow | null>(ctx.db, 'coaching_template_read', { eid: engagementId });
  const template = data ?? {};
  return <><Panel title="Coaching templates"><p className="mb-5">Complete these generic engagement documents together. Keep private reflections out of shared fields and use only information appropriate for the selected audience.</p></Panel>
    {(['agreement','action_plan','progress_report','summary'] as const).map(kind => { const labels={agreement:'Leadership Coaching Agreement',action_plan:'Leadership Coaching Action Plan',progress_report:'Coaching Progress Report',summary:'End-of-Engagement Summary and Sustainment'}; const current=kind === 'progress_report' ? {} : (template[kind] ?? {}); return <Panel key={kind} title={labels[kind]}><CoachingForm operation="template_save" hidden={{ engagement_id: engagementId, template: kind }}><TemplateFields kind={kind} data={Object.fromEntries(Object.entries(current).map(([key,value])=>[key,text(value)]))}/></CoachingForm></Panel>; })}</>;
}
