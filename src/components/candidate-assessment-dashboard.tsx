"use client";

import { useState } from "react";

type Strength = {
  themeName: string;
  rank: number;
  domain: string;
  strengthSummary: string | null;
  watchouts: string | null;
  developmentUse: string | null;
};

type InterviewCompetency = {
  name: string;
  targetScore: number;
  interviewScore: number | null;
};

type Review360Role = {
  roleId: string;
  roleLabel: string;
  kind: "current" | "future";
  reviewTitle: string | null;
  overallScore: number | null;
  isProtected: boolean;
  competencyScores: Array<{
    name: string;
    score: number | null;
  }>;
};

export function CandidateAssessmentDashboard({
  candidateName,
  interviewCompetencies,
  latestInterviewPanelName,
  review360Roles,
  strengths,
}: {
  candidateName: string;
  interviewCompetencies: InterviewCompetency[];
  latestInterviewPanelName: string | null;
  review360Roles: Review360Role[];
  strengths: Strength[];
}) {
  const [selectedStrengthName, setSelectedStrengthName] = useState(
    strengths[0]?.themeName ?? "",
  );
  const [selectedReviewRoleId, setSelectedReviewRoleId] = useState(
    review360Roles[0]?.roleId ?? "",
  );
  const selectedStrength =
    strengths.find((strength) => strength.themeName === selectedStrengthName) ?? null;
  const topStrengths = strengths.slice(0, 5);
  const nextStrengths = strengths.slice(5, 15);
  const selectedReviewRole =
    review360Roles.find((role) => role.roleId === selectedReviewRoleId) ?? null;

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div>
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Assessment Dashboard
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          {candidateName}&apos;s evidence at a glance
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Compare the interview competency categories, confidential 360 feedback, and Gallup strengths. Use the tabs below to add or manage the underlying information.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr_1fr]">
        <article className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
          <p className="text-sm font-semibold tracking-[0.14em] text-sky-800 uppercase">
            Interview competencies
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {latestInterviewPanelName ?? "No saved interview round yet"}
          </p>
          {interviewCompetencies.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2 text-xs font-semibold tracking-wide text-sky-800 uppercase">
                <span>Category</span>
                <span>Target</span>
                <span>Interview</span>
              </div>
              {interviewCompetencies.map((competency) => (
                <div
                  key={competency.name}
                  className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 border-b border-sky-50 px-4 py-3 text-sm last:border-0"
                >
                  <span className="font-semibold text-slate-900">{competency.name}</span>
                  <span className="text-slate-600">{competency.targetScore.toFixed(1)}</span>
                  <span className="font-semibold text-sky-900">
                    {competency.interviewScore === null
                      ? "—"
                      : competency.interviewScore.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Add role competencies before interview scores can be recorded.
            </p>
          )}
        </article>

        <article className="rounded-3xl border border-teal-100 bg-teal-50/70 p-5">
          <p className="text-sm font-semibold tracking-[0.14em] text-teal-800 uppercase">
            360 Feedback
          </p>
          {review360Roles.length > 0 ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {review360Roles.map((role) => {
                  const isSelected = role.roleId === selectedReviewRoleId;

                  return (
                    <button
                      key={role.roleId}
                      type="button"
                      onClick={() => setSelectedReviewRoleId(role.roleId)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? "border-teal-900 bg-teal-900 text-white"
                          : "border-teal-200 bg-white text-teal-900 hover:bg-teal-100"
                      }`}
                    >
                      {role.kind === "current" ? "Current" : "Future"}: {role.roleLabel}
                    </button>
                  );
                })}
              </div>
              {selectedReviewRole ? (
                <>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.12em] text-teal-800 uppercase">
                        {selectedReviewRole.kind === "current" ? "Current role" : "Future role"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedReviewRole.reviewTitle ?? "No 360 review launched"}
                      </p>
                    </div>
                    <p className="font-display text-3xl text-slate-900">
                      {selectedReviewRole.overallScore !== null
                        ? selectedReviewRole.overallScore.toFixed(1)
                        : selectedReviewRole.isProtected
                          ? "Protected"
                          : "—"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {selectedReviewRole.overallScore !== null
                      ? "overall non-self feedback · out of 5"
                      : selectedReviewRole.isProtected
                        ? "awaiting the confidentiality threshold"
                        : "Start a 360 review for this role to see scores here."}
                  </p>
                  {selectedReviewRole.competencyScores.length > 0 ? (
                    <div className="mt-4 max-h-52 overflow-y-auto rounded-2xl border border-teal-100 bg-white">
                      {selectedReviewRole.competencyScores.map((competency) => (
                        <div
                          key={competency.name}
                          className="flex items-center justify-between gap-3 border-b border-teal-50 px-3 py-2.5 text-xs last:border-0"
                        >
                          <span className="font-medium text-slate-800">{competency.name}</span>
                          <span className="shrink-0 font-semibold text-teal-900">
                            {selectedReviewRole.isProtected || competency.score === null
                              ? "Protected"
                              : competency.score.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Assign a current or potential role to view 360 feedback by role.
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-teal-900">
            Open the 360 Reviews tab for group-level results by competency.
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold tracking-[0.14em] text-slate-900 uppercase">
            Strengths
          </p>
          {strengths.length > 0 ? (
            <div className="mt-4 space-y-5">
              <StrengthGroup
                label="Top 5"
                strengths={topStrengths}
                selectedStrengthName={selectedStrengthName}
                onSelect={setSelectedStrengthName}
              />
              {nextStrengths.length > 0 ? (
                <StrengthGroup
                  label="Next 10"
                  strengths={nextStrengths}
                  selectedStrengthName={selectedStrengthName}
                  onSelect={setSelectedStrengthName}
                />
              ) : null}
              {selectedStrength ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      #{selectedStrength.rank} {selectedStrength.themeName}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.12em] text-slate-700 uppercase">
                      {selectedStrength.domain}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <StrengthDetail
                      label="Strength summary"
                      content={selectedStrength.strengthSummary}
                    />
                    <StrengthDetail label="Watchouts" content={selectedStrength.watchouts} />
                    <StrengthDetail
                      label="Development use"
                      content={selectedStrength.developmentUse}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Add a Gallup strengths document to populate this view.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function StrengthDetail({
  label,
  content,
}: {
  label: string;
  content: string | null;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-slate-700 uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-700">
        {content ?? "No reference detail is available yet."}
      </p>
    </article>
  );
}

function StrengthGroup({
  label,
  strengths,
  selectedStrengthName,
  onSelect,
}: {
  label: string;
  strengths: Strength[];
  selectedStrengthName: string;
  onSelect: (themeName: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {strengths.map((strength) => {
          const isSelected = strength.themeName === selectedStrengthName;

          return (
            <button
              key={strength.themeName}
              type="button"
              onClick={() => onSelect(strength.themeName)}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                isSelected
                  ? "border-teal-900 bg-teal-900 text-white"
                  : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
              }`}
            >
              #{strength.rank} {strength.themeName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
