"use client";

import { useState } from "react";
import type { GeneratedCandidateCoachingNarrative } from "@/lib/candidate-coaching-narrative";

export function CompetencyCoachingNarrativePanel({
  canGenerate,
  candidateId,
  roleId,
  competencyId,
}: {
  canGenerate: boolean;
  candidateId?: string;
  roleId?: string;
  competencyId?: string;
}) {
  const [narrative, setNarrative] =
    useState<GeneratedCandidateCoachingNarrative | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateNarrative() {
    if (!candidateId || !roleId || !competencyId) {
      setError("This competency is missing the selection details needed for coaching guidance.");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch("/api/candidates/generate-coaching-narrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          competencyId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        narrative?: GeneratedCandidateCoachingNarrative;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate the coaching narrative.");
      }

      setNarrative(payload.narrative ?? null);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate the coaching narrative.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (!canGenerate) {
    return null;
  }

  return (
    <div className="mt-6 rounded-3xl border border-teal-200 bg-teal-50/50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
            AI Coaching Narrative
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Generate a mentor-ready narrative that interprets score progress,
            explains how strengths can help close the gap, and suggests coaching
            projects for this competency.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateNarrative}
          disabled={isGenerating}
          className="rounded-full bg-teal-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {isGenerating
            ? "Generating..."
            : narrative
              ? "Regenerate Coaching Narrative"
              : "Generate Coaching Narrative"}
        </button>
      </div>

      {error ? (
        <article className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-700">
          {error}
        </article>
      ) : null}

      {narrative ? (
        <div className="mt-5 grid gap-4">
          <article className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">
              Progress Over Time
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {narrative.progress_over_time}
            </p>
          </article>

          <article className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">
              Using Strengths To Close The Gap
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {narrative.strengths_application}
            </p>
          </article>

          <article className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">
              Mentor Coaching Guidance
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {narrative.mentor_guidance}
            </p>
          </article>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">
                Suggested Stretch Projects
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {narrative.suggested_projects.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-teal-200 bg-white/90 px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-teal-700 uppercase">
                Coaching Checkpoints
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                {narrative.coaching_checkpoints.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      ) : null}
    </div>
  );
}
