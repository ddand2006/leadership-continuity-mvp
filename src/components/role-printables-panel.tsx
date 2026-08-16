"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Printable = { id: "role_composite" | "condensed_profile" | "printable_narrative" | "interview_scorecard"; title: string; description: string; endpoint: string; enabled: boolean; generated: boolean; outdated: boolean };

export function RolePrintablesPanel({ roleId, roleTitle, printables }: { roleId: string; roleTitle: string; printables: Printable[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function download(printable: Printable) {
    setBusyId(printable.id); setMessage("");
    try {
      const response = await fetch(printable.endpoint);
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Unable to prepare this document."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `${roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${printable.id}.docx`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      if (!printable.generated || printable.outdated) { const tracked = await fetch(`/api/roles/${roleId}/printables/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType: printable.id }) }); if (!tracked.ok) throw new Error("The document downloaded, but its generation status could not be saved."); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to prepare this document."); } finally { setBusyId(null); }
  }

  return <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Role printables</p><h2 className="mt-2 font-display text-4xl">Ready-to-use role documents</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Generate and download the role materials in workflow order. A regeneration option appears only when the saved competency set has changed since the document was last generated.</p><div className="mt-7 grid gap-4">{printables.map((printable, index) => <article key={printable.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold tracking-[.14em] text-slate-500 uppercase">{index + 1}. Printable</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{printable.title}</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">{printable.description}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${!printable.enabled ? "bg-slate-100 text-slate-500" : printable.outdated ? "bg-amber-100 text-amber-900" : printable.generated ? "bg-teal-100 text-teal-900" : "bg-blue-100 text-blue-900"}`}>{!printable.enabled ? "Needs competencies" : printable.outdated ? "Competencies changed" : printable.generated ? "Current" : "Not generated"}</span>{printable.enabled ? <button type="button" disabled={busyId === printable.id} onClick={() => download(printable)} className="interactive-contrast rounded-full bg-teal-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === printable.id ? "Preparing document..." : printable.outdated ? "Regenerate doc" : printable.generated ? "Download & print" : "Generate doc"}</button> : <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400">Generate composite first</span>}</div></article>)}</div>{message ? <p className="mt-4 text-sm text-rose-700">{message}</p> : null}</section>;
}
