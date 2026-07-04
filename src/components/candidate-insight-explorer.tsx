"use client";

import { useMemo, useState } from "react";
import { CompetencyCoachingNarrativePanel } from "@/components/competency-coaching-narrative-panel";
import { MentoringIdeasPanel } from "@/components/mentoring-ideas-panel";
import type { RankedProjectMatch } from "@/lib/fit-analysis";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

type CompetencyInsight = {
  competencyId: string;
  competencyName: string;
  targetScore: number;
  averageScore: number;
  interviewScore: number | null;
  strengthsScore: number | null;
  weightedGap: number;
  status: "Strong Match" | "Near Match / Develop" | "Development Priority";
  strengthsRationale: string | null;
  supportingStrengths: string[];
  mentoringIdeas: RankedProjectMatch[];
};

type StrengthTheme = {
  theme_name: string;
  rank: number;
  domain: string;
};

type StrengthReference = {
  theme_name: string;
  domain: string;
  leadership_advantages: string;
  possible_blind_spots: string;
  development_uses: string;
};

type CandidateInsightExplorerProps = {
  assessments: CompetencyInsight[];
  strengths: StrengthTheme[];
  references: StrengthReference[];
  canGenerateCandidateIdeas?: boolean;
  candidateId?: string;
  candidateName?: string;
  roleId?: string;
};

type SelectedInsight =
  | { kind: "competency"; id: string }
  | { kind: "strength"; id: string }
  | null;

export function CandidateInsightExplorer({
  assessments,
  strengths,
  references,
  canGenerateCandidateIdeas = false,
  candidateId,
  candidateName,
  roleId,
}: CandidateInsightExplorerProps) {
  const [selectedInsight, setSelectedInsight] = useState<SelectedInsight>(() => {
    if (assessments[0]) {
      return { kind: "competency", id: assessments[0].competencyId };
    }

    if (strengths[0]) {
      return { kind: "strength", id: strengths[0].theme_name };
    }

    return null;
  });

  const referenceMap = useMemo(
    () => new Map(references.map((reference) => [reference.theme_name, reference])),
    [references],
  );
  const topStrengths = strengths.slice(0, 5);
  const nextStrengths = strengths.slice(5, 15);

  const activeAssessment =
    selectedInsight?.kind === "competency"
      ? assessments.find(
          (assessment) => assessment.competencyId === selectedInsight.id,
        ) ?? null
      : null;
  const activeStrength =
    selectedInsight?.kind === "strength"
      ? strengths.find((strength) => strength.theme_name === selectedInsight.id) ?? null
      : null;
  const activeStrengthReference = activeStrength
    ? referenceMap.get(activeStrength.theme_name) ?? null
    : null;

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Role Fit Analysis
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Focus on one competency or strength at a time
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Use the buttons below to isolate one role-fit area or one top strength.
              This keeps the page focused so you can review each insight without
              competing information on screen. Candidate scores on this page blend
              interview scoring with strengths-fit scoring for the same competency.
            </p>
          </div>
          <div className="rounded-3xl border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Top 15 Strengths
            </p>
            <p className="mt-3 text-sm leading-7 text-[#24512f]">
              Keep the highest-priority strengths in view first. The top 5 are
              separated from the next 10 so mentors can stay focused on the most
              influential themes.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Competency buttons
            </p>
            <div className="mt-3 grid gap-3">
              {assessments.length > 0 ? (
                assessments.map((assessment) => {
                  const isActive =
                    selectedInsight?.kind === "competency" &&
                    selectedInsight.id === assessment.competencyId;

                  return (
                    <button
                      key={assessment.competencyId}
                      type="button"
                      onClick={() =>
                        setSelectedInsight({
                          kind: "competency",
                          id: assessment.competencyId,
                        })
                      }
                      className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                        isActive
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`block text-xs font-semibold tracking-[0.14em] uppercase ${
                          isActive ? "text-slate-200" : "text-slate-500"
                        }`}
                      >
                        Candidate {assessment.averageScore.toFixed(2)} • Role goal{" "}
                        {assessment.targetScore.toFixed(2)}
                      </span>
                      <span className="mt-2 block text-lg font-semibold leading-snug">
                        {assessment.competencyName}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  No role-fit competencies are available for this candidate yet.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Strength buttons
            </p>
            <div className="mt-3 space-y-5">
              {strengths.length > 0 ? (
                <>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
                      Top 5
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {topStrengths.map((strength) => {
                        const isActive =
                          selectedInsight?.kind === "strength" &&
                          selectedInsight.id === strength.theme_name;

                        return (
                          <button
                            key={strength.theme_name}
                            type="button"
                            onClick={() =>
                              setSelectedInsight({
                                kind: "strength",
                                id: strength.theme_name,
                              })
                            }
                            className={`rounded-full border px-4 py-3 text-sm font-semibold transition ${
                              isActive
                                ? "border-teal-900 bg-teal-900 text-white"
                                : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                            }`}
                          >
                            #{strength.rank} {sanitizeAppText(strength.theme_name)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {nextStrengths.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
                        Next 10
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {nextStrengths.map((strength) => {
                          const isActive =
                            selectedInsight?.kind === "strength" &&
                            selectedInsight.id === strength.theme_name;

                          return (
                            <button
                              key={strength.theme_name}
                              type="button"
                              onClick={() =>
                                setSelectedInsight({
                                  kind: "strength",
                                  id: strength.theme_name,
                                })
                              }
                              className={`rounded-full border px-4 py-3 text-sm font-semibold transition ${
                                isActive
                                  ? "border-teal-900 bg-teal-900 text-white"
                                  : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                              }`}
                            >
                              #{strength.rank} {sanitizeAppText(strength.theme_name)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm leading-7 text-slate-600">
                  No strengths have been uploaded for this candidate yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {activeStrength ? (
          <section className="mt-6 rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
                  Selected Strength
                </p>
                <h3 className="mt-3 font-display text-4xl text-[#14361d]">
                  #{activeStrength.rank} {sanitizeAppText(activeStrength.theme_name)}
                </h3>
              </div>
              <span className="rounded-full bg-white/45 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                {activeStrengthReference?.domain ?? activeStrength.domain}
              </span>
            </div>

            {activeStrengthReference ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                <article className="emerald-soft-surface rounded-3xl border p-5">
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                    Strength Summary
                  </p>
                  <p className="mt-3 text-base leading-8 text-[#14361d]">
                    {sanitizeAppText(activeStrengthReference.leadership_advantages)}
                  </p>
                </article>
                <article className="emerald-soft-surface rounded-3xl border p-5">
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                    Watchouts
                  </p>
                  <p className="mt-3 text-base leading-8 text-[#14361d]">
                    {sanitizeAppText(activeStrengthReference.possible_blind_spots)}
                  </p>
                </article>
                <article className="emerald-soft-surface rounded-3xl border p-5">
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                    Development Use
                  </p>
                  <p className="mt-3 text-base leading-8 text-[#14361d]">
                    {sanitizeAppText(activeStrengthReference.development_uses)}
                  </p>
                </article>
              </div>
            ) : (
              <article className="emerald-soft-surface mt-6 rounded-3xl border p-5 text-sm leading-7 text-[#24512f]">
                No reference summary is loaded yet for{" "}
                {sanitizeAppText(activeStrength.theme_name)}.
              </article>
            )}
          </section>
        ) : null}
      </div>

      {activeAssessment ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Selected Role Fit Area
              </p>
              <h3 className="mt-3 font-display text-4xl leading-tight text-slate-900">
                {activeAssessment.competencyName}
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The candidate score blends interview evidence with strengths fit
                for this competency, and the role goal comes directly from the
                target score set on the role composite.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
                  Candidate score {activeAssessment.averageScore.toFixed(2)}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-900">
                  Role goal {activeAssessment.targetScore.toFixed(2)}
                </span>
                {activeAssessment.interviewScore !== null ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Interview average {activeAssessment.interviewScore.toFixed(2)}
                  </span>
                ) : null}
                {activeAssessment.strengthsScore !== null ? (
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-teal-900">
                    Strengths fit {activeAssessment.strengthsScore.toFixed(2)}
                  </span>
                ) : null}
              </div>
              {activeAssessment.supportingStrengths.length > 0 ? (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Strength evidence:{" "}
                  <span className="font-semibold text-slate-900">
                    {sanitizeAppTextList(activeAssessment.supportingStrengths).join(", ")}
                  </span>
                </p>
              ) : null}
              {activeAssessment.strengthsRationale ? (
                <p className="mt-3 max-w-4xl text-base leading-8 text-slate-700">
                  {sanitizeAppText(activeAssessment.strengthsRationale)}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">
                {activeAssessment.status}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Weighted gap {activeAssessment.weightedGap.toFixed(2)}
              </p>
            </div>
          </div>

          <CompetencyCoachingNarrativePanel
            canGenerate={canGenerateCandidateIdeas && Boolean(roleId)}
            candidateId={candidateId}
            roleId={roleId}
            competencyId={activeAssessment.competencyId}
          />

          <MentoringIdeasPanel
            ideas={activeAssessment.mentoringIdeas}
            canGenerateCandidateIdeas={canGenerateCandidateIdeas && Boolean(roleId)}
            candidateId={candidateId}
            candidateName={candidateName}
            roleId={roleId}
            competencyId={activeAssessment.competencyId}
          />
        </section>
      ) : null}

    </section>
  );
}
