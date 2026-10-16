"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type PartnerTeamMember = { user_id: string; email: string; role: string; status: string };
export function PartnerTeam({ members }: { members: PartnerTeamMember[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "member", status: "active" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try {
      const response = await fetch("/api/partner-account/team", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update access.");
      setMessage(result.message);router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update access."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5"><h2 className="text-2xl font-semibold">Team access</h2><p className="text-slate-600">Administrators manage the roster and contacts; finance members view referrals and payments; members view referrals and the roster. Only the owner manages team access.</p><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><label>Name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3" /></label><label>Permission<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3"><option value="member">Member</option><option value="finance">Finance</option><option value="admin">Administrator</option></select></label><label>Access<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="mt-1 block w-full rounded-xl border border-slate-300 p-3"><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button disabled={busy} className="interactive-contrast min-h-12 rounded-full bg-blue-700 px-5 py-3 disabled:opacity-50 sm:col-span-2">{busy?"Saving…":"Save team access"}</button></form>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-3">Email</th><th className="p-3">Permission</th><th className="p-3">Access</th></tr></thead><tbody>{members.map(m=><tr className="border-t border-slate-200" key={m.user_id}><td className="break-all p-3">{m.email}</td><td className="p-3 capitalize">{m.role}</td><td className="p-3 capitalize">{m.status}</td></tr>)}</tbody></table></div></section>;
}
