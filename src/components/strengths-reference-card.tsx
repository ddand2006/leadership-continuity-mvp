"use client";

import { useMemo, useState } from "react";
import { sanitizeAppText } from "@/lib/text-sanitizer";

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

export function StrengthsReferenceCard({
  strengths,
  references,
}: {
  strengths: StrengthTheme[];
  references: StrengthReference[];
}) {
  const [activeThemeName, setActiveThemeName] = useState<string | null>(
    strengths[0]?.theme_name ?? null,
  );
  const referenceMap = useMemo(
    () => new Map(references.map((reference) => [reference.theme_name, reference])),
    [references],
  );
  const activeReference = activeThemeName
    ? referenceMap.get(activeThemeName) ?? null
    : null;

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-900 uppercase">
        Top 10 Strengths
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Click a strength to open its reference summary.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {strengths.length > 0 ? (
          strengths.map((strength) => {
            const isActive = strength.theme_name === activeThemeName;

            return (
              <button
                key={strength.theme_name}
                type="button"
                onClick={() => setActiveThemeName(strength.theme_name)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-teal-900 bg-teal-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                #{strength.rank} {sanitizeAppText(strength.theme_name)}
              </button>
            );
          })
        ) : (
          <p className="text-sm leading-7 text-slate-600">
            No strengths have been uploaded for this candidate yet.
          </p>
        )}
      </div>

      {activeReference ? (
        <article className="emerald-soft-surface mt-6 rounded-3xl border p-5 text-sm text-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-semibold text-slate-900">
              {sanitizeAppText(activeReference.theme_name)}
            </h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
              {activeReference.domain}
            </span>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
                Strength Summary
              </p>
              <p className="mt-2 leading-7 text-slate-700">
                {sanitizeAppText(activeReference.leadership_advantages)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
                Watchouts
              </p>
              <p className="mt-2 leading-7 text-slate-700">
                {sanitizeAppText(activeReference.possible_blind_spots)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-700 uppercase">
                Development Use
              </p>
              <p className="mt-2 leading-7 text-slate-700">
                {sanitizeAppText(activeReference.development_uses)}
              </p>
            </div>
          </div>
        </article>
      ) : activeThemeName ? (
        <article className="emerald-soft-surface mt-6 rounded-3xl border p-5 text-sm leading-7 text-slate-600">
          No reference summary is loaded yet for {sanitizeAppText(activeThemeName)}.
        </article>
      ) : null}
    </section>
  );
}
