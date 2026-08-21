import Image from "next/image";
import type { CandidateAwardTier } from "@/lib/candidate-awards";
import { getLegacyCertificationAsset } from "@/lib/legacy-certifications";

export type CompanyMentorRanking = {
  mentorId: string;
  mentorName: string;
  positionTitle: string | null;
  score: number;
  tier: CandidateAwardTier | null;
  activeTrackCount: number;
};

function levelLabel(tier: CandidateAwardTier | null) {
  return tier
    ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
    : "Getting Started";
}

export function CompanyMentorRankings({
  mentors,
  isCompanyView,
}: {
  mentors: CompanyMentorRanking[];
  isCompanyView: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
        Mentor recognition
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl text-slate-900 sm:text-4xl">
            {isCompanyView ? "Mentor levels across the organization" : "Your mentor level"}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Levels recognize active development work and timely reports and reviews. They do not depend on whether a candidate is promoted.
          </p>
        </div>
        <span className="brand-lime-accent rounded-full border px-4 py-2 text-sm font-semibold">
          {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"}
        </span>
      </div>

      <div className="mt-6 grid gap-3">
        {mentors.map((mentor, index) => {
          const asset = getLegacyCertificationAsset(mentor.tier);
          return (
            <article key={mentor.mentorId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-4">
                {isCompanyView ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700">
                    {index + 1}
                  </span>
                ) : null}
                <div>
                  <p className="font-semibold text-slate-900">{mentor.mentorName}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {mentor.positionTitle ?? "Position not entered"} · {mentor.activeTrackCount} active {mentor.activeTrackCount === 1 ? "track" : "tracks"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">{mentor.score} / 100</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">
                  {asset ? <Image src={asset.src} alt={asset.alt} width={22} height={22} className="rounded-full" /> : null}
                  {asset ? asset.shortLabel : levelLabel(mentor.tier)}
                </span>
              </div>
            </article>
          );
        })}
        {mentors.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            No active mentors are available yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
