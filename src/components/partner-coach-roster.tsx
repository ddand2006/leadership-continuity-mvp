"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Coach = { id: string; coach_name: string; coach_email: string; specialty: string | null; invitation_status: string; coach_profiles?: {profile_status:string} | null };
export function PartnerCoachRoster({ initial, canManage = true }: { initial: Coach[]; canManage?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({name:"",email:"",specialty:""});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try {
      const response = await fetch("/api/partner-account/coaches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to add coach.");
      setMessage(data.message);setForm({name:"",email:"",specialty:""});router.refresh();
    } catch (caught) {setError(caught instanceof Error?caught.message:"Unable to add coach.");}
    finally {setBusy(false);}
  }
  return <section className="space-y-5"><h2 className="text-2xl font-semibold">Coaches</h2><p className="text-slate-600">Add a coach to your roster. Existing profiles are reused. Each coach confirms the affiliation and completes their own profile and credential review before publication.</p>{canManage&&<form onSubmit={add} className="grid gap-4 sm:grid-cols-3"><label>Coach name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><label>Coach email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><label>Specialty<input value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><button disabled={busy} className="interactive-contrast min-h-12 rounded-full bg-blue-700 px-5 py-3 disabled:opacity-50 sm:col-span-3">{busy?"Saving invitation…":"Add or invite coach"}</button></form>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<div className="space-y-4">{initial.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4"><div className="min-w-0"><p className="break-words font-semibold">{row.coach_name}</p><p className="break-all text-sm text-slate-600">{row.coach_email}{row.specialty?` · ${row.specialty}`:""}</p></div><div className="text-sm"><p>Affiliation: {row.invitation_status}</p><p>Profile: {row.coach_profiles?.profile_status?.replaceAll("_"," ")??"Awaiting onboarding"}</p></div></div>)}{!initial.length&&<p className="text-slate-600">No coaches added yet.</p>}</div></section>;
}
