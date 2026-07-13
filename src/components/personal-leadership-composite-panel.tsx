"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PersonalLeadershipCompositeRecord } from "@/lib/personal-development";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not generated yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getEvidenceLabel(
  composite: PersonalLeadershipCompositeRecord["composite_json"],
) {
  const evidence = composite?.evidence;

  if (!evidence?.generation_mode) {
    return "Generated from saved role context";
  }

  switch (evidence.generation_mode) {
    case "ideal_competencies":
      return `Generated from ${evidence.talents?.length ?? 0} talents, ${evidence.skills?.length ?? 0} skills, and ${evidence.behaviors?.length ?? 0} behaviors`;
    case "existing_role_competencies":
      return `Built from ${evidence.source_role_competency_count ?? 0} existing role competencies`;
    case "role_profile":
      return "Generated from the saved role profile and organizational context";
  }
}

function ArraySection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {title}
      </h3>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PersonalLeadershipCompositePanel({
  hasOpenAI,
  roleTitle,
  latestComposite,
}: {
  hasOpenAI: boolean;
  roleTitle: string;
  latestComposite: PersonalLeadershipCompositeRecord | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const composite = latestComposite?.composite_json;
  const narrative = latestComposite?.narrative_json;

  function handleGenerate() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/personal-development/composite/generate", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to generate the personal leadership composite.");
        return;
      }

      setSuccess(payload.message ?? "Personal leadership composite generated.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Leadership Composite
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Build and refine your personal leadership composite
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            This workspace turns your saved role context into a structured leadership
            profile with competencies, expectations, leadership style, and coaching
            watchouts. You can update it any time without leaving your Personal
            Development workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending || !hasOpenAI}
            className="interactive-contrast rounded-full bg-teal-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending
              ? "Generating..."
              : latestComposite
                ? "Refresh Composite"
                : "Generate Composite"}
          </button>
          <Link
            href="/personal-development/role"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Edit Role Profile
          </Link>
        </div>
      </div>

      {!hasOpenAI ? (
        <article className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
          Add `OPENAI_API_KEY` to the environment before generating a Personal
          Development composite for {roleTitle}.
        </article>
      ) : null}

      {error ? (
        <article className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-900">
          {error}
        </article>
      ) : null}

      {success ? (
        <article className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
          {success}
        </article>
      ) : null}

      {!latestComposite || !composite || !narrative ? (
        <article className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          Generate your first composite to capture the core competencies, success
          characteristics, leadership expectations, and coaching watchouts for this
          role.
        </article>
      ) : (
        <>
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-teal-900 uppercase">
                  Version {latestComposite.version}
                </span>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
                  {latestComposite.status}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-slate-900">
                {composite.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {composite.department || "Department not specified"}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                {narrative.professional_summary}
              </p>
              <div className="mt-5 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Generated:</span>{" "}
                  {formatTimestamp(latestComposite.generated_at)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Source:</span>{" "}
                  {getEvidenceLabel(composite)}
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822]">
              <h3 className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
                Leadership Narrative
              </h3>
              <div className="mt-4 grid gap-4 text-sm leading-7 text-[#24512f]">
                <div>
                  <p className="font-semibold text-[#183822]">Leadership style</p>
                  <p>{narrative.leadership_style}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#183822]">Communication style</p>
                  <p>{narrative.communication_style}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#183822]">Decision-making style</p>
                  <p>{narrative.decision_making_style}</p>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ArraySection
              title="Success Characteristics"
              items={narrative.success_characteristics}
            />
            <ArraySection
              title="Leadership Expectations"
              items={narrative.leadership_expectations}
            />
            <ArraySection title="Ideal Behaviors" items={narrative.ideal_behaviors} />
            <ArraySection title="Blind Spots" items={narrative.blind_spots} />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Core Competencies
              </h3>
              <div className="mt-5 grid gap-4">
                {composite.competencies.map((competency) => (
                  <article
                    key={competency.name}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-slate-900">
                        {competency.name}
                      </h4>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                        <span className="rounded-full bg-teal-100 px-3 py-1 text-teal-900">
                          Weight {competency.weight}
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
                          Target {competency.target_score}/5
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {competency.definition}
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Behavioral Indicators
                        </p>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                          {competency.behavioral_indicators.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Watch For
                        </p>
                        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                          {competency.red_flags.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <div className="grid gap-4">
              <ArraySection
                title="Strengths To Leverage"
                items={narrative.strengths_to_leverage}
              />
              <ArraySection
                title="Development Watchouts"
                items={narrative.development_watchouts}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
