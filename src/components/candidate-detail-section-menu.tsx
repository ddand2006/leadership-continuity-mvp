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
  initialSectionId,
}: {
  sections: CandidateDetailSection[];
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
    <section className="grid gap-6">
      <nav className="flex flex-wrap gap-3 border-b border-slate-200 pb-5" aria-label="Candidate workspace sections">
        {sections.map((section) => {
          const isActive = section.id === activeSection.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSectionId(section.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                isActive
                  ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-6">
        {activeSection.content}
      </div>
    </section>
  );
}
