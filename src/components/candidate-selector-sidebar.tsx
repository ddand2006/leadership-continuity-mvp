import Link from "next/link";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";

type CandidateSelectorSidebarProps = {
  candidates: Array<{
    id: string;
    fullName: string;
    currentTitle: string | null;
    status: string;
  }>;
  selectedCandidateId?: string | null;
  selectedCandidateName?: string | null;
  currentSectionId?: string | null;
  canCreateCandidates: boolean;
  isCreatingCandidate?: boolean;
};

export function CandidateSelectorSidebar({
  candidates,
  selectedCandidateId = null,
  selectedCandidateName = null,
  currentSectionId = null,
  canCreateCandidates,
  isCreatingCandidate = false,
}: CandidateSelectorSidebarProps) {
  return (
    <aside className="theme-panel h-fit rounded-[1.75rem] p-5 xl:sticky xl:top-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Candidates
      </p>
      <h1 className="mt-2 font-display text-3xl text-slate-900">
        {canCreateCandidates ? "Add or select a candidate" : "Select a candidate"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {canCreateCandidates
          ? "Create a candidate or open an existing candidate workspace."
          : "Open a candidate workspace assigned to you."}
      </p>

      <nav className="mt-6 grid gap-2" aria-label="Candidate selection">
        {canCreateCandidates ? (
          <Link
            href="/candidates?mode=create"
            aria-current={isCreatingCandidate ? "page" : undefined}
            className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition ${
              isCreatingCandidate
                ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_14px_30px_rgba(15,118,110,0.18)]"
                : "border-teal-200 bg-teal-50 text-teal-950 hover:border-teal-400 hover:bg-teal-100"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-lg leading-none">
                +
              </span>
              Add new candidate
            </span>
          </Link>
        ) : null}

        {candidates.length > 0 ? (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Your candidates
            </p>
            <div className="grid gap-2">
              {candidates.map((candidate) => {
                const isSelected = candidate.id === selectedCandidateId;
                const displayName =
                  isSelected
                    ? selectedCandidateName?.trim() || candidate.fullName
                    : candidate.fullName;
                const visibleCandidateName = getCandidateDisplayName(displayName);
                const candidateParams = new URLSearchParams();

                if (currentSectionId) {
                  candidateParams.set("section", currentSectionId);
                }
                const candidateHref = `/candidates/${candidate.id}${
                  candidateParams.size > 0 ? `?${candidateParams.toString()}` : ""
                }`;

                return (
                  <Link
                    key={candidate.id}
                    href={candidateHref}
                    aria-current={isSelected ? "page" : undefined}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{visibleCandidateName}</span>
                    <span
                      className={`mt-1 block text-xs ${
                        isSelected ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {candidate.currentTitle ?? "No current title"} · {candidate.status.replaceAll("_", " ")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            {canCreateCandidates
              ? "Your first candidate will appear here after you create it."
              : "No candidates are assigned to you yet."}
          </p>
        )}
      </nav>
    </aside>
  );
}
