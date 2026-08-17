"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type MatchStatus = "match" | "not_yet" | "not_recommended";
type HiringDecision = "hire" | "continue_mentoring" | "decline";

export function CandidateWorkflowStateManager({
  candidateId,
  roleId,
  roleOptions,
  readinessScore,
  readinessRoleId,
  latestStateByRoleId,
  latestMatch,
  latestDecision,
}: {
  candidateId: string;
  roleId: string;
  roleOptions: Array<{ id: string; title: string }>;
  readinessScore: number | null;
  readinessRoleId: string;
  latestStateByRoleId: Record<
    string,
    {
      match: { status: MatchStatus; createdAt: string } | null;
      decision: { decision: HiringDecision; createdAt: string } | null;
    }
  >;
  latestMatch: { status: MatchStatus; createdAt: string } | null;
  latestDecision: { decision: HiringDecision; createdAt: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(latestMatch?.status ?? "not_yet");
  const [decision, setDecision] = useState<HiringDecision>(latestDecision?.decision ?? "continue_mentoring");
  const [selectedRoleId, setSelectedRoleId] = useState(roleId);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const selectedState = latestStateByRoleId[selectedRoleId] ?? {
    match: null,
    decision: null,
  };

  function save(kind: "match" | "decision") {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/candidates/${candidateId}/workflow-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "match" ? {
            kind, roleId: selectedRoleId, matchStatus, readinessScore, notes,
          } : { kind, roleId: selectedRoleId, decision, notes }),
        });
        const payload = await response.json() as { message?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to save.");
        setNotes("");
        setMessage(payload.message ?? "Saved.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save.");
      }
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Workflow state</p>
      <h2 className="mt-2 font-display text-3xl text-slate-900">Record leadership decisions</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">Save a dated role-fit snapshot or an interim/final decision. Development assignments continue to be managed through the mentoring workflow.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Potential role
          <select
            value={selectedRoleId}
            onChange={(event) => {
              const nextRoleId = event.currentTarget.value;
              const nextState = latestStateByRoleId[nextRoleId] ?? {
                match: null,
                decision: null,
              };
              setSelectedRoleId(nextRoleId);
              setMatchStatus(nextState.match?.status ?? "not_yet");
              setDecision(nextState.decision?.decision ?? "continue_mentoring");
            }}
            disabled={isPending}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-900"
          >
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>{role.title}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Role-match assessment
          <select value={matchStatus} onChange={(event) => setMatchStatus(event.currentTarget.value as MatchStatus)} disabled={isPending} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-900">
            <option value="match">Match</option><option value="not_yet">Not yet</option><option value="not_recommended">Not recommended</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Leadership decision
          <select value={decision} onChange={(event) => setDecision(event.currentTarget.value as HiringDecision)} disabled={isPending} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-slate-900">
            <option value="continue_mentoring">Continue mentoring</option><option value="hire">Hire / advance</option><option value="decline">Decline</option>
          </select>
        </label>
        <div className="flex items-end gap-2"><button type="button" onClick={() => save("match")} disabled={isPending} className="rounded-xl border border-teal-800 px-3 py-2.5 text-sm font-semibold text-teal-900 disabled:opacity-50">Save match</button><button type="button" onClick={() => save("decision")} disabled={isPending} className="interactive-contrast rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save decision</button></div>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Notes <span className="font-normal text-slate-500">(optional)</span>
        <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} maxLength={2000} rows={3} disabled={isPending} className="resize-y rounded-xl border border-slate-200 px-3 py-2.5 font-normal text-slate-900" />
      </label>
      <p className="mt-4 text-sm text-slate-600">
        {selectedRoleId === readinessRoleId ? <>Calculated readiness: <span className="font-semibold text-slate-900">{readinessScore === null ? "Not available" : `${readinessScore}%`}</span></> : "Readiness is calculated when this potential role is opened."}
        {selectedState.match ? ` · Last match: ${selectedState.match.status.replaceAll("_", " ")}` : ""}
        {selectedState.decision ? ` · Last decision: ${selectedState.decision.decision.replaceAll("_", " ")}` : ""}
      </p>
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-teal-800">{message}</p> : null}
    </section>
  );
}
