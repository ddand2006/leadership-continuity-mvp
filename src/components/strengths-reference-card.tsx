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
    <section className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
        Top 10 Strengths
      </p>
      <p className="mt-3 text-sm leading-7 text-[#24512f]">
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
                    ? "border-[#2d7c38] bg-white text-[#14361d]"
                    : "border-[#57c95f] bg-white/35 text-[#14361d] hover:bg-white/55"
                }`}
              >
                #{strength.rank} {sanitizeAppText(strength.theme_name)}
              </button>
            );
          })
        ) : (
          <p className="text-sm leading-7 text-[#24512f]">
            No strengths have been uploaded for this candidate yet.
          </p>
        )}
      </div>

      {activeReference ? (
        <article className="emerald-soft-surface mt-6 rounded-3xl border p-5 text-sm text-[#14361d]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-semibold text-[#14361d]">
              {sanitizeAppText(activeReference.theme_name)}
            </h3>
            <span className="rounded-full bg-white/45 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
              {activeReference.domain}
            </span>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                Strength Summary
              </p>
              <p className="mt-2 leading-7 text-[#14361d]">
                {sanitizeAppText(activeReference.leadership_advantages)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                Watchouts
              </p>
              <p className="mt-2 leading-7 text-[#14361d]">
                {sanitizeAppText(activeReference.possible_blind_spots)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#24512f] uppercase">
                Development Use
              </p>
              <p className="mt-2 leading-7 text-[#14361d]">
                {sanitizeAppText(activeReference.development_uses)}
              </p>
            </div>
          </div>
        </article>
      ) : activeThemeName ? (
        <article className="emerald-soft-surface mt-6 rounded-3xl border p-5 text-sm leading-7 text-[#24512f]">
          No reference summary is loaded yet for {sanitizeAppText(activeThemeName)}.
        </article>
      ) : null}
    </section>
  );
}
