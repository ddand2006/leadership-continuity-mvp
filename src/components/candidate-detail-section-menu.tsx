"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

type CandidateDetailSection = {
  id: string;
  label: string;
  summary: string;
  content: ReactNode;
  dashboardContent?: ReactNode;
  detailSectionIds?: string[];
  parentSectionId?: string;
  navOrder?: number;
};

export function CandidateDetailSectionMenu({
  sections,
  initialSectionId,
}: {
  sections: CandidateDetailSection[];
  initialSectionId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections.some((section) => section.id === initialSectionId)
      ? (initialSectionId ?? "")
      : "overview",
  );
  const [activeDetailSectionId, setActiveDetailSectionId] = useState<string>("");

  const urlSectionId = searchParams.get("section");
  const resolvedUrlSectionId =
    sections.find((section) => section.id === urlSectionId)?.parentSectionId ??
    urlSectionId;
  const selectedSectionId = (resolvedUrlSectionId === "overview" || sections.some((section) => section.id === resolvedUrlSectionId))
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


  function updateSectionInUrl(sectionId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", sectionId);
    window.history.replaceState(null, "", `${pathname}?${nextParams.toString()}`);
  }

  return (
    <section className="grid gap-6">
      {selectedSectionId === "overview" ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Candidate workspace</p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">Profile, fit, and development</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Explore the selected candidate’s profile, review their role fit, and follow their progress and mentoring priorities.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {sections
              .filter((section) => !section.parentSectionId)
              .map((section, index) => ({ section, index }))
              .sort((left, right) => (left.section.navOrder ?? left.index) - (right.section.navOrder ?? right.index))
              .map(({ section }, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSectionId(section.id);
                    updateSectionInUrl(section.id);
                  }}
                  className={`flex cursor-pointer flex-col rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 ${["accent-card-gold", "accent-card-green", "accent-card-coral", "border-sky-200 bg-sky-50"][index % 4]}`}
                >
                  <span className="font-semibold text-slate-900">{section.label}</span>
                  <span className="mt-2 flex-1 text-sm leading-6 text-slate-600">{section.summary}</span>
                  <span className="mt-4 text-sm font-semibold text-teal-800">Open {section.label.toLowerCase()}</span>
                </button>
              ))}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setActiveSectionId("overview");
            setActiveDetailSectionId("");
            updateSectionInUrl("overview");
          }}
          className="w-fit cursor-pointer rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
        >
          ← Back to Candidate Overview
        </button>
      )}

      {selectedSectionId !== "overview" && activeSection ? <div className="grid gap-6">
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
                      updateSectionInUrl(section.id);
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
      </div> : null}
    </section>
  );
}
