"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TemporaryTrainingProgram } from "@/lib/outside-training-programs";

type EditableProgram = TemporaryTrainingProgram;
type EditableMatch = EditableProgram["competencyMatches"][number];

const blank: EditableProgram = {
  id: "", provider: "", name: "", description: "", websiteUrl: "", deliveryFormat: "",
  typicalDuration: "", intendedAudience: "", internalNote: "",
  competencyMatches: [{ competencyNames: [""], strength: "strong", explanation: "" }],
};

export function TrainingCatalogManager({
  programs,
  competencyNames,
}: {
  programs: EditableProgram[];
  competencyNames: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableProgram>(blank);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const setField = (key: Exclude<keyof EditableProgram, "competencyMatches">, value: string) =>
    setEditing((current) => ({ ...current, [key]: value }));
  const updateMatch = (index: number, update: Partial<EditableMatch>) =>
    setEditing((current) => ({
      ...current,
      competencyMatches: current.competencyMatches.map((match, matchIndex) =>
        matchIndex === index ? { ...match, ...update } : match,
      ),
    }));

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const matches = editing.competencyMatches.map((match) => ({
        competencyName: match.competencyNames[0]?.trim() ?? "",
        strength: match.strength,
        explanation: match.explanation,
      }));
      const response = await fetch("/api/training-programs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id || undefined, providerName: editing.provider, name: editing.name,
          description: editing.description, websiteUrl: editing.websiteUrl,
          deliveryFormats: editing.deliveryFormat.split(",").map((item) => item.trim()).filter(Boolean),
          audienceLevels: editing.intendedAudience.split(",").map((item) => item.trim()).filter(Boolean),
          typicalDuration: editing.typicalDuration, internalNotes: editing.internalNote, matches,
        }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      setMessage(payload.error ?? payload.message ?? "Saved.");
      if (response.ok) { setEditing(blank); router.refresh(); }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this training program?")) return;
    startTransition(async () => {
      const response = await fetch("/api/training-programs", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      setMessage(payload.error ?? payload.message ?? "Removed.");
      if (response.ok) { setEditing(blank); router.refresh(); }
    });
  }

  return (
    <details className="theme-panel rounded-[1.75rem] p-6">
      <summary className="cursor-pointer text-lg font-semibold text-slate-900">Manage training catalog</summary>
      <p className="mt-3 text-sm leading-6 text-slate-600">Map each program to as many organization role competencies as it develops. A shared competency automatically benefits every role that uses it.</p>
      <div className="mt-5 grid gap-2">
        {programs.map((program) => (
          <div key={program.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <span><b className="text-sm text-slate-900">{program.name}</b><small className="ml-2 text-slate-500">{program.provider} · {program.competencyMatches.length} competencies</small></span>
            <span className="flex gap-3 text-sm font-semibold"><button type="button" className="text-teal-800" onClick={() => setEditing(program)}>Edit</button><button type="button" className="text-rose-700" onClick={() => remove(program.id)}>Remove</button></span>
          </div>
        ))}
      </div>
      <form onSubmit={save} className="mt-6 grid gap-3 border-t border-slate-200 pt-6 md:grid-cols-2">
        {([['provider', 'Provider'], ['name', 'Program name'], ['websiteUrl', 'Program website'], ['typicalDuration', 'Typical duration'], ['deliveryFormat', 'Formats (comma-separated)'], ['intendedAudience', 'Audience levels (comma-separated)']] as const).map(([key, label]) => (
          <label key={key} className="text-sm font-semibold text-slate-700">{label}<input required={key === "provider" || key === "name"} value={editing[key]} onChange={(event) => setField(key, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
        ))}
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Description<textarea required value={editing.description} onChange={(event) => setField("description", event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
        <section className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:col-span-2">
          <div><h3 className="font-semibold text-slate-900">Competency mappings</h3><p className="mt-1 text-sm text-slate-600">Choose every competency this program genuinely develops, including competencies used by other roles.</p></div>
          {editing.competencyMatches.map((match, index) => (
            <div key={`${editing.id || "new"}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_10rem_1fr_auto]">
              <label className="text-sm font-semibold text-slate-700">Competency<input required list="organization-competencies" value={match.competencyNames[0] ?? ""} onChange={(event) => updateMatch(index, { competencyNames: [event.target.value] })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold text-slate-700">Strength<select value={match.strength} onChange={(event) => updateMatch(index, { strength: event.target.value as EditableMatch["strength"] })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal"><option value="strong">Strong</option><option value="moderate">Moderate</option><option value="supporting">Supporting</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Why it matches<input required value={match.explanation} onChange={(event) => updateMatch(index, { explanation: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
              <button type="button" onClick={() => setEditing((current) => ({ ...current, competencyMatches: current.competencyMatches.filter((_, matchIndex) => matchIndex !== index) }))} disabled={editing.competencyMatches.length === 1} className="self-end rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40">Remove</button>
            </div>
          ))}
          <datalist id="organization-competencies">{competencyNames.map((name) => <option key={name} value={name} />)}</datalist>
          <button type="button" onClick={() => setEditing((current) => ({ ...current, competencyMatches: [...current.competencyMatches, { competencyNames: [""], strength: "moderate", explanation: "" }] }))} className="justify-self-start rounded-xl border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800">Add competency mapping</button>
        </section>
        <div className="md:col-span-2"><button disabled={isPending} className="rounded-xl bg-teal-900 px-4 py-2 text-sm font-semibold text-white">{isPending ? "Saving…" : editing.id ? "Save changes" : "Add program"}</button>{editing.id ? <button type="button" onClick={() => setEditing(blank)} className="ml-3 text-sm font-semibold text-slate-600">Cancel</button> : null}{message ? <p role="status" className="mt-2 text-sm text-slate-600">{message}</p> : null}</div>
      </form>
    </details>
  );
}
