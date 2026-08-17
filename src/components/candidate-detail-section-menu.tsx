"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

type CandidateDetailSection = {
  id: string;
  label: string;
  summary: string;
  content: ReactNode;
  includeSectionIds?: string[];
  parentSectionId?: string;
};

export function CandidateDetailSectionMenu({
  sections,
  initialSectionId,
}: {
  sections: CandidateDetailSection[];
  initialSectionId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections.some((section) => section.id === initialSectionId)
      ? (initialSectionId ?? "")
      : (sections[0]?.id ?? ""),
  );

  const urlSectionId = searchParams.get("section");
  const resolvedUrlSectionId =
    sections.find((section) => section.id === urlSectionId)?.parentSectionId ??
    urlSectionId;
  const selectedSectionId = sections.some((section) => section.id === resolvedUrlSectionId)
    ? resolvedUrlSectionId
    : activeSectionId;
  const activeSection =
    sections.find((section) => section.id === selectedSectionId) ?? sections[0] ?? null;
  const includedSections = activeSection?.includeSectionIds
    ? activeSection.includeSectionIds
        .map((sectionId) => sections.find((section) => section.id === sectionId))
        .filter((section): section is CandidateDetailSection => Boolean(section))
    : [];

  if (!activeSection) {
    return null;
  }

  return (
    <section className="grid gap-6">
      <nav className="flex flex-wrap gap-3 border-b border-slate-200 pb-5" aria-label="Candidate workspace sections">
        {sections.filter((section) => !section.parentSectionId).map((section) => {
          const isActive = section.id === activeSection.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setActiveSectionId(section.id);
                const nextParams = new URLSearchParams(searchParams.toString());
                nextParams.set("section", section.id);
                router.replace(`${pathname}?${nextParams.toString()}`, {
                  scroll: false,
                });
              }}
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
        {includedSections.map((section) => (
          <section key={section.id} className="grid gap-6">
            {section.content}
          </section>
        ))}
      </div>
    </section>
  );
}
