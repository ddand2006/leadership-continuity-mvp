"use client";

import { useState } from "react";

type Strength = {
  themeName: string;
  rank: number;
  domain: string;
};

type InterviewCompetency = {
  name: string;
  targetScore: number;
  interviewScore: number | null;
};

export function CandidateAssessmentDashboard({
  interviewCompetencies,
  latestInterviewPanelName,
  latest360Score,
  latest360Title,
  has360Review,
  strengths,
}: {
  interviewCompetencies: InterviewCompetency[];
  latestInterviewPanelName: string | null;
  latest360Score: number | null;
  latest360Title: string | null;
  has360Review: boolean;
  strengths: Strength[];
}) {
  const [selectedStrengthName, setSelectedStrengthName] = useState(
    strengths[0]?.themeName ?? "",
  );
  const selectedStrength =
    strengths.find((strength) => strength.themeName === selectedStrengthName) ?? null;
  const topStrengths = strengths.slice(0, 5);
  const nextStrengths = strengths.slice(5, 15);

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div>
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Assessment Dashboard
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Candidate evidence at a glance
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
          <p className="mt-3 font-display text-4xl text-slate-900">
            {latest360Score !== null
              ? latest360Score.toFixed(1)
              : has360Review
                ? "Protected"
                : "—"}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {latest360Score !== null
              ? "out of 5 · non-self feedback"
              : has360Review
                ? "awaiting the confidentiality threshold"
                : "no review launched"}
          </p>
          <p className="mt-4 text-sm font-medium leading-6 text-slate-800">
            {latest360Title ?? "No current-role 360 review"}
          </p>
          <p className="mt-4 text-xs leading-5 text-teal-900">
            Open the 360 Reviews tab for group-level results by competency.
          </p>
        </article>

        <article className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
          <p className="text-sm font-semibold tracking-[0.14em] text-emerald-800 uppercase">
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
                <p className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-emerald-950">
                  <span className="font-semibold">Selected:</span> #{selectedStrength.rank} {selectedStrength.themeName} · {selectedStrength.domain}
                </p>
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
      <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800 uppercase">
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
                  : "border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
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
