"use client";

import { useState, type ReactNode } from "react";

type CandidateDetailSection = {
  id: string;
  label: string;
  summary: string;
  content: ReactNode;
};

export function CandidateDetailSectionMenu({
  sections,
  candidateName,
  detailItems,
  initialSectionId,
}: {
  sections: CandidateDetailSection[];
  candidateName: string;
  detailItems: string[];
  initialSectionId?: string;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections.some((section) => section.id === initialSectionId)
      ? (initialSectionId ?? "")
      : (sections[0]?.id ?? ""),
  );

  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null;

  if (!activeSection) {
    return null;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="theme-panel rounded-[1.75rem] p-6 lg:sticky lg:top-8">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Candidate Workspace
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight text-slate-900">
          {candidateName}
        </h2>
        <ul className="mt-4 grid gap-2 text-sm leading-7 text-slate-600">
          {detailItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3">
          {sections.map((section) => {
            const isActive = section.id === activeSection.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSectionId(section.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? "border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                    : "border-slate-200/80 bg-white/85 text-slate-700 hover:bg-white"
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="grid gap-6">
        {activeSection.content}
      </div>
    </section>
  );
}
