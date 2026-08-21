import Image from "next/image";
import type { MentorScorecard as MentorScorecardData } from "@/lib/mentor-scorecard";
import { getLegacyCertificationAsset } from "@/lib/legacy-certifications";

type MentorScorecardEntry = MentorScorecardData & {
  mentorId: string;
  mentorName: string;
  positionTitle: string | null;
  isCurrentMentor: boolean;
};

function getLevelLabel(entry: MentorScorecardEntry) {
  return entry.tier
    ? `${entry.tier.charAt(0).toUpperCase()}${entry.tier.slice(1)}`
    : "Getting Started";
}

export function MentorScorecard({
  entries,
  isAdmin,
}: {
  entries: MentorScorecardEntry[];
  isAdmin: boolean;
}) {
  const currentMentor = entries.find((entry) => entry.isCurrentMentor) ?? entries[0];

  if (!currentMentor) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        No mentors are available for a scorecard yet.
      </section>
    );
  }

  const currentAsset = getLegacyCertificationAsset(currentMentor.tier);

  return (
    <section className="grid gap-6">
      <section className="rounded-[1.75rem] border border-teal-200 bg-teal-50 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-800 uppercase">
          Mentor scorecard
        </p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-4xl text-slate-900">
              {isAdmin ? "Mentor engagement and impact" : "Your mentoring impact"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              Recognition is earned through active development records, current mentor reports, and timely mentor reviews—not whether a candidate is promoted.
            </p>
          </div>
          <div className="rounded-3xl border border-teal-200 bg-white px-5 py-4 text-right">
            <p className="text-xs font-semibold tracking-[0.14em] text-teal-800 uppercase">
              {currentMentor.mentorName}
            </p>
            <p className="mt-2 text-4xl font-semibold text-slate-900">{currentMentor.score}</p>
            <p className="mt-1 text-sm text-slate-600">of 100 points</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800">
              {currentAsset ? (
                <Image src={currentAsset.src} alt={currentAsset.alt} width={24} height={24} className="rounded-full" />
              ) : null}
              {currentAsset ? currentAsset.fullLabel : getLevelLabel(currentMentor)}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active tracks", currentMentor.activeTrackCount],
            ["Development records", `${currentMentor.developmentRecordCount} / ${currentMentor.activeTrackCount}`],
            ["Current reports", `${currentMentor.currentReportCount} / ${currentMentor.activeTrackCount}`],
            ["Current reviews", `${currentMentor.currentReviewCount} / ${currentMentor.activeTrackCount}`],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-3xl border border-teal-100 bg-white p-5">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 rounded-2xl border border-teal-200 bg-white/80 px-4 py-3 text-sm font-semibold text-teal-950">
          Next best action: {currentMentor.nextAction}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Mentor levels
        </p>
        <h3 className="mt-3 font-display text-3xl text-slate-900">
          {isAdmin ? "All active mentors" : "Your recognition level"}
        </h3>
        <div className="mt-6 grid gap-3">
          {entries.map((entry) => {
            const asset = getLegacyCertificationAsset(entry.tier);
            return (
              <article key={entry.mentorId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="font-semibold text-slate-900">{entry.mentorName}</p>
                  <p className="mt-1 text-sm text-slate-600">{entry.positionTitle ?? "Position not entered"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">{entry.score} / 100</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">
                    {asset ? <Image src={asset.src} alt={asset.alt} width={22} height={22} className="rounded-full" /> : null}
                    {asset ? asset.shortLabel : getLevelLabel(entry)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
