"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FLOWCHART_ACTION_DISABLED_CLASS,
  FLOWCHART_ACTION_ENABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_DISABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_ENABLED_CLASS,
  FLOWCHART_SELECT_INPUT_CLASS,
  FLOWCHART_SELECT_PANEL_CLASS,
  FLOWCHART_START_BUTTON_CLASS,
  FLOWCHART_START_BUTTON_DISABLED_CLASS,
} from "@/components/flowchart-theme";

type CandidateFlowPanelProps = {
  candidates: {
    id: string;
    fullName: string;
    currentTitle: string | null;
    primaryRoleTitle: string;
    primaryRoleId: string | null;
    readiness: number;
  }[];
  selectedCandidateId: string | null;
  canCreateCandidates: boolean;
};

type CandidateFlowAction = {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function CandidateFlowPanel({
  candidates,
  selectedCandidateId,
  canCreateCandidates,
}: CandidateFlowPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;

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

  function buildCandidateSectionHref(section: string) {
    if (!selectedCandidate) {
      return undefined;
    }

    const nextParams = new URLSearchParams();
    nextParams.set("section", section);

    if (selectedCandidate.primaryRoleId) {
      nextParams.set("roleId", selectedCandidate.primaryRoleId);
    }

    return `/candidates/${selectedCandidate.id}?${nextParams.toString()}`;
  }

  const actions: CandidateFlowAction[] = [
    {
      title: "Input Interview Scores",
      description: selectedCandidate
        ? "Open this candidate’s interview scoring workspace."
        : "Choose a candidate first to enter interview scores.",
      href: buildCandidateSectionHref("interview-scores"),
      disabled: !selectedCandidate,
    },
    {
      title: "View Role Fit & Strengths",
      description: selectedCandidate
        ? "Review role fit, strengths ranking, and readiness insights."
        : "Choose a candidate first to review role fit and strengths.",
      href: buildCandidateSectionHref("role-fit"),
      disabled: !selectedCandidate,
    },
    {
      title: "Upload & View Strengths Files",
      description: selectedCandidate
        ? "Open the Gallup source documents area for this candidate."
        : "Choose a candidate first to manage strengths files.",
      href: buildCandidateSectionHref("strengths-files"),
      disabled: !selectedCandidate,
    },
    {
      title: "Generate Mentor Report",
      description: selectedCandidate
        ? "Open the mentor report view for this candidate and role."
        : "Choose a candidate first to work with mentor reports.",
      href: buildCandidateSectionHref("mentor-report"),
      disabled: !selectedCandidate,
    },
  ];

  return (
    <section className="theme-panel rounded-[1.75rem] p-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Candidates Flow
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Follow one clear candidate workflow
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        Use this flow to move from candidate setup into interview scoring,
        strengths files, role fit, and mentor reporting without hunting through
        the system.
      </p>

      {candidates.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          No candidates exist yet. Start with <span className="font-semibold">Add Candidate</span> to
          create the first person in the pipeline.
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-8 overflow-x-auto">
          <div className="hidden min-w-[980px] grid-cols-[12rem_16rem_1fr] items-center gap-10 lg:grid">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => updateRoute("create", selectedCandidateId)}
                disabled={!canCreateCandidates}
                className={`group relative flex h-36 w-36 items-center justify-center ${FLOWCHART_START_BUTTON_CLASS} ${
                  !canCreateCandidates ? FLOWCHART_START_BUTTON_DISABLED_CLASS : ""
                }`}
                style={{ transform: "rotate(45deg)" }}
              >
                <span
                  className="px-4 text-center text-lg font-semibold leading-6"
                  style={{ transform: "rotate(-45deg)" }}
                >
                  ADD
                  <br />
                  CANDIDATE
                </span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute top-1/2 left-[-2.5rem] h-[2px] w-10 -translate-y-1/2 bg-slate-900" />
              <div className={FLOWCHART_SELECT_PANEL_CLASS}>
                <p className="text-center text-lg font-semibold">Select Candidate</p>
                <select
                  className={FLOWCHART_SELECT_INPUT_CLASS}
                  value={selectedCandidateId ?? ""}
                  onChange={(event) =>
                    updateRoute("flow", event.currentTarget.value || null)
                  }
                >
                  <option value="" className="text-slate-900">
                    Select candidate
                  </option>
                  {candidates.map((candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                      className="text-slate-900"
                    >
                      {candidate.fullName}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-center text-xs leading-6 text-white/80">
                  {selectedCandidate
                    ? `${selectedCandidate.fullName}${selectedCandidate.currentTitle ? ` • ${selectedCandidate.currentTitle}` : ""}`
                    : "Choose one candidate to activate the next steps."}
                </p>
              </div>
              <div className="absolute top-1/2 left-full h-[2px] w-14 -translate-y-1/2 bg-slate-900" />
            </div>

            <div className="relative pl-14">
              <div className="absolute top-12 left-3 bottom-12 w-[2px] bg-slate-900" />
              <div className="flex flex-col gap-6">
                {actions.map((action) => (
                  <div key={action.title} className="relative">
                    <div className="absolute top-1/2 left-[-2.75rem] h-[2px] w-11 -translate-y-1/2 bg-slate-900" />
                    {action.href && !action.disabled ? (
                      <Link
                        href={action.href}
                        className={FLOWCHART_ACTION_ENABLED_CLASS}
                      >
                        <p className="text-center text-2xl font-semibold leading-tight">
                          {action.title}
                        </p>
                        <p className="mt-3 text-center text-sm leading-6 text-white/80">
                          {action.description}
                        </p>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={action.onClick}
                        disabled
                        className={`w-full ${FLOWCHART_ACTION_DISABLED_CLASS}`}
                      >
                        <p className="text-center text-2xl font-semibold leading-tight">
                          {action.title}
                        </p>
                        <p className="mt-3 text-center text-sm leading-6">
                          {action.description}
                        </p>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:hidden">
            {canCreateCandidates ? (
              <button
                type="button"
                onClick={() => updateRoute("create", selectedCandidateId)}
                className={FLOWCHART_START_BUTTON_CLASS}
              >
                <p className="text-sm font-semibold tracking-[0.14em] uppercase">
                  Start
                </p>
                <p className="mt-2 text-2xl font-semibold">Add Candidate</p>
              </button>
            ) : null}

            <div className={FLOWCHART_SELECT_PANEL_CLASS}>
              <p className="text-sm font-semibold tracking-[0.14em] uppercase">
                Select Candidate
              </p>
              <select
                className={FLOWCHART_SELECT_INPUT_CLASS}
                value={selectedCandidateId ?? ""}
                onChange={(event) =>
                  updateRoute("flow", event.currentTarget.value || null)
                }
              >
                <option value="" className="text-slate-900">
                  Select candidate
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id} className="text-slate-900">
                    {candidate.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4">
              {actions.map((action) =>
                action.href && !action.disabled ? (
                  <Link
                    key={action.title}
                    href={action.href}
                    className={FLOWCHART_MOBILE_ACTION_ENABLED_CLASS}
                  >
                    <p className="text-lg font-semibold text-white">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      {action.description}
                    </p>
                  </Link>
                ) : (
                  <div
                    key={action.title}
                    className={FLOWCHART_MOBILE_ACTION_DISABLED_CLASS}
                  >
                    <p className="text-lg font-semibold text-slate-600">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {action.description}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedCandidate ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-700">
          <span className="font-semibold text-slate-900">
            {selectedCandidate.fullName}
          </span>
          {selectedCandidate.currentTitle ? ` • ${selectedCandidate.currentTitle}` : ""}
          {selectedCandidate.primaryRoleTitle
            ? ` • ${selectedCandidate.primaryRoleTitle}`
            : ""}{" "}
          is currently tracking at {selectedCandidate.readiness.toFixed(2)} / 5.
        </div>
      ) : null}
    </section>
  );
}
