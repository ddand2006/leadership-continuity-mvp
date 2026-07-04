"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CandidateFocusSelectorProps = {
  candidates: {
    id: string;
    fullName: string;
  }[];
  selectedCandidateId: string | null;
  selectedMode: "flow" | "create";
  canCreateCandidates: boolean;
};

const CREATE_CANDIDATE_VALUE = "__create_candidate__";

export function CandidateFocusSelector({
  candidates,
  selectedCandidateId,
  selectedMode,
  canCreateCandidates,
}: CandidateFocusSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateRoute(nextMode: "flow" | "create", nextCandidateId?: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("mode", nextMode);

    if (nextCandidateId) {
      nextParams.set("candidateId", nextCandidateId);
    } else {
      nextParams.delete("candidateId");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  return (
    <section className="w-full rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Candidate Workflow
          </p>
          <h2 className="mt-2 font-display text-2xl leading-tight text-slate-900">
            Choose what you want to do
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Pick one workflow at a time, then work through that candidate task in
            the main panel below.
          </p>
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[28rem]">
          <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => updateRoute("flow", selectedCandidateId)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "flow"
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-slate-200/80 bg-white/85 text-slate-700 hover:bg-white"
            }`}
          >
            Candidates Flow
          </button>
          {canCreateCandidates ? (
            <button
              type="button"
              onClick={() => updateRoute("create", selectedCandidateId)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selectedMode === "create"
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200/80 bg-white/85 text-slate-700 hover:bg-white"
              }`}
            >
              Add Candidate
            </button>
          ) : null}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Focus candidate
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              value={
                selectedMode === "create" && !selectedCandidateId
                  ? CREATE_CANDIDATE_VALUE
                  : (selectedCandidateId ?? "")
              }
              onChange={(event) => {
                const nextCandidateId = event.currentTarget.value;

                if (nextCandidateId === CREATE_CANDIDATE_VALUE) {
                  updateRoute("create", null);
                  return;
                }

                updateRoute(selectedMode, nextCandidateId || null);
              }}
            >
              <option value="">Select candidate</option>
              {canCreateCandidates ? (
                <option value={CREATE_CANDIDATE_VALUE}>Add candidate</option>
              ) : null}
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
