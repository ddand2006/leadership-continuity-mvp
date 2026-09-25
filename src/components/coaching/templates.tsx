import { rpc } from '@/lib/coaching/server';
import { CoachingForm } from './form';
import { Field, Panel, Select } from './ui';

type TemplateRow = { agreement?: Record<string, string>; action_plan?: Record<string, string>; summary?: Record<string, string> };

const text = (value: unknown) => typeof value === 'string' ? value : '';

function TemplateFields({ kind, data }: { kind: 'agreement' | 'action_plan' | 'summary'; data: Record<string, string> }) {
  if (kind === 'agreement') return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="coachee" label="Leader / coachee" value={data.coachee}/><Field name="coach" label="Coach" value={data.coach}/><Field name="sponsor" label="Manager or sponsor" value={data.sponsor}/><Field name="start_date" label="Start date" type="date" value={data.start_date}/><Field name="end_date" label="Planned end date" type="date" value={data.end_date}/><Field name="assignment_length" label="Engagement length" value={data.assignment_length}/></div>
    <Field name="confidentiality" label="Confidentiality and information-sharing agreement" type="textarea" value={data.confidentiality}/>
    <Field name="business_context" label="Business context and key challenges" type="textarea" value={data.business_context}/>
    <Field name="strengths" label="Performance strengths and behaviors" type="textarea" value={data.strengths}/>
    <Field name="focus_areas" label="Priority growth and development areas" type="textarea" value={data.focus_areas}/>
    <Field name="sharing_notes" label="What may be shared with the sponsor, and at what level" type="textarea" value={data.sharing_notes}/>
  </>;
  if (kind === 'action_plan') return <>
    <div className="grid gap-3 md:grid-cols-2"><Field name="start_date" label="Start date" type="date" value={data.start_date}/><Field name="end_date" label="Planned end date" type="date" value={data.end_date}/><Field name="timeframe" label="Review timeframe" value={data.timeframe}/></div>
    {[1,2,3].map(n => <div className="rounded-2xl border border-slate-200 p-4" key={n}><h3 className="font-semibold">Development goal {n}</h3><Field name={`outcome_${n}`} label="Desired outcome and measure" type="textarea" value={data[`outcome_${n}`]}/><Field name={`action_${n}`} label="Action steps" type="textarea" value={data[`action_${n}`]}/><Field name={`impact_${n}`} label="Expected business or team impact" type="textarea" value={data[`impact_${n}`]}/></div>)}
    <Field name="accelerators" label="Accelerators: resources and people who can help" type="textarea" value={data.accelerators}/><Field name="derailers" label="Potential derailers and mitigation" type="textarea" value={data.derailers}/>
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
    {(['agreement','action_plan','summary'] as const).map(kind => { const labels={agreement:'Leadership Coaching Agreement',action_plan:'Leadership Coaching Action Plan',summary:'End-of-Engagement Summary and Sustainment'}; const current=template[kind] ?? {}; return <Panel key={kind} title={labels[kind]}><CoachingForm operation="template_save" hidden={{ engagement_id: engagementId, template: kind }}><TemplateFields kind={kind} data={Object.fromEntries(Object.entries(current).map(([key,value])=>[key,text(value)]))}/></CoachingForm></Panel>; })}</>;
}
