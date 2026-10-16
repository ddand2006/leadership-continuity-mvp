"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type CoachAffiliation = { id: string; name: string; status: string };
export function PartnerCoachAffiliations({ initial }: { initial: CoachAffiliation[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function decide(id: string, accepted: boolean) {
    setBusy(id); setError("");
    try {
      const result = await fetch("/api/coaching/partner-affiliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accepted }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error ?? "Unable to update affiliation.");
      setRows(current => current.map(r => r.id === id ? { ...r, status: data.status } : r));
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update affiliation."); }
    finally { setBusy(null); }
  }
  if (!rows.length) return null;
  return <section className="theme-panel space-y-4 p-6"><h2 className="text-xl font-semibold">Partner affiliations</h2><p className="text-slate-600">Confirm the partners you represent. Your affiliation appears with your approved marketplace profile. Partners do not receive access to client notes.</p>{error && <p role="alert">{error}</p>}{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4"><div><p className="font-semibold">{row.name}</p><p className="text-sm capitalize">{row.status === "invited" ? "Awaiting your confirmation" : row.status}</p></div><div className="flex gap-3">{row.status === "invited" && <button disabled={busy !== null} className="interactive-contrast rounded-full bg-blue-700 px-4 py-2 disabled:opacity-50" onClick={() => void decide(row.id, true)}>Accept affiliation</button>}{row.status !== "inactive" && <button disabled={busy !== null} className="rounded-full border border-slate-300 px-4 py-2 disabled:opacity-50" onClick={() => void decide(row.id, false)}>{row.status === "accepted" ? "Leave partner roster" : "Decline"}</button>}</div></div>)}</section>;
}
