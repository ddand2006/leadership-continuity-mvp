"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Survey = { id: string; title: string; intro_message: string | null; thank_you_message: string | null; status: "draft" | "active" | "closed"; created_at: string };
type Recipient = { id: string; survey_id: string; recipient_name: string; recipient_email: string; access_token: string; status: string };

export function PersonalCompetencySurveyPanel({ roleTitle, surveys, recipients, responseCount }: { roleTitle: string; surveys: Survey[]; recipients: Recipient[]; responseCount: number }) {
  const router = useRouter();
  const survey = surveys[0] ?? null;
  const [title, setTitle] = useState(survey?.title ?? `${roleTitle} competency survey`);
  const [introMessage, setIntroMessage] = useState(survey?.intro_message ?? `Please share what success looks like in ${roleTitle}.`);
  const [thankYouMessage, setThankYouMessage] = useState(survey?.thank_you_message ?? "Thank you. Your perspective has been recorded.");
  const [status, setStatus] = useState<"draft" | "active" | "closed">(survey?.status ?? "draft");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRecipientPending, startRecipientTransition] = useTransition();
  const link = (token: string) => typeof window === "undefined" ? `/personal-development/surveys/${token}` : `${window.location.origin}/personal-development/surveys/${token}`;
  const save = () => { setError(null); startTransition(async () => { const r = await fetch("/api/personal-development/survey", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",surveyId:survey?.id,title,introMessage,thankYouMessage,status})}); const p=await r.json().catch(()=>({})); if(!r.ok){setError(p.error??"Unable to save survey.");return;} setSuccess(p.message); router.refresh(); }); };
  const addRecipient = () => { if(!survey){setError("Save the survey first.");return;} setError(null); startRecipientTransition(async () => { const r=await fetch("/api/personal-development/survey",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"recipient",surveyId:survey.id,recipientName:name,recipientEmail:email})}); const p=await r.json().catch(()=>({})); if(!r.ok){setError(p.error??"Unable to add recipient.");return;} setName("");setEmail("");setSuccess(p.message);router.refresh(); }); };
  return <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Personal Competency Survey</p>
    <h2 className="mt-3 font-display text-3xl text-slate-900">Invite people who know your work</h2>
    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">This private 360 survey asks contacts what success looks like in your role. Create it, activate it, and share each recipient&apos;s unique link.</p>
    <div className="mt-6 grid gap-4">
      <label className="block"><span className="mb-2 block text-sm font-semibold">Survey title</span><input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">Invitation message</span><textarea value={introMessage} onChange={(e)=>setIntroMessage(e.target.value)} className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">Thank-you message</span><textarea value={thankYouMessage} onChange={(e)=>setThankYouMessage(e.target.value)} className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">Survey status</span><select value={status} onChange={(e)=>setStatus(e.target.value as "draft"|"active"|"closed")} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><option value="draft">Draft</option><option value="active">Active — ready to collect responses</option><option value="closed">Closed</option></select></label>
      <button type="button" onClick={save} disabled={isPending} className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">{isPending?"Saving...":"Save survey"}</button>
    </div>
    {survey ? <div className="mt-8 border-t border-slate-200 pt-6"><p className="font-semibold text-slate-900">Recipients · {responseCount} responses</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Recipient name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /><input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" placeholder="Recipient email" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></div><button type="button" onClick={addRecipient} disabled={isRecipientPending} className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">{isRecipientPending?"Adding...":"Add recipient"}</button><div className="mt-5 grid gap-3">{recipients.filter((item)=>item.survey_id===survey.id).map((item)=><article key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-semibold">{item.recipient_name} <span className="font-normal text-slate-500">· {item.status}</span></p><p className="mt-1 text-slate-600">{item.recipient_email}</p><button type="button" onClick={()=>navigator.clipboard.writeText(link(item.access_token))} className="mt-3 text-sm font-semibold text-teal-800">Copy survey link</button></article>)}</div></div> : null}
    {error?<p className="mt-4 text-sm text-rose-700">{error}</p>:null}{success?<p className="mt-4 text-sm text-teal-700">{success}</p>:null}
  </section>;
}
