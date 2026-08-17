"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

type CandidateDetailSection = {
  id: string;
  label: string;
  summary: string;
  content: ReactNode;
  dashboardContent?: ReactNode;
  detailSectionIds?: string[];
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
  const [activeDetailSectionId, setActiveDetailSectionId] = useState<string>("");

  const urlSectionId = searchParams.get("section");
  const resolvedUrlSectionId =
    sections.find((section) => section.id === urlSectionId)?.parentSectionId ??
    urlSectionId;
  const selectedSectionId = sections.some((section) => section.id === resolvedUrlSectionId)
    ? resolvedUrlSectionId
    : activeSectionId;
  const activeSection =
    sections.find((section) => section.id === selectedSectionId) ?? sections[0] ?? null;
  const detailSections = activeSection?.detailSectionIds
    ? activeSection.detailSectionIds
        .map((sectionId) => sections.find((section) => section.id === sectionId))
        .filter((section): section is CandidateDetailSection => Boolean(section))
    : [];
  const selectedDetailSectionId = detailSections.some(
    (section) => section.id === urlSectionId,
  )
    ? urlSectionId
    : detailSections.some((section) => section.id === activeDetailSectionId)
      ? activeDetailSectionId
      : (detailSections[0]?.id ?? "");
  const activeDetailSection =
    detailSections.find((section) => section.id === selectedDetailSectionId) ?? null;

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
        {activeSection.dashboardContent ? activeSection.dashboardContent : null}
        {detailSections.length > 0 ? (
          <section className="grid gap-5">
            <nav
              className="flex flex-wrap gap-2 border-b border-slate-200 pb-4"
              aria-label="Candidate profile detail sections"
            >
              {detailSections.map((section) => {
                const isActive = section.id === activeDetailSection?.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      setActiveDetailSectionId(section.id);
                      const nextParams = new URLSearchParams(searchParams.toString());
                      nextParams.set("section", section.id);
                      router.replace(`${pathname}?${nextParams.toString()}`, {
                        scroll: false,
                      });
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-teal-900 bg-teal-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </nav>
            {activeDetailSection ? activeDetailSection.content : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}
