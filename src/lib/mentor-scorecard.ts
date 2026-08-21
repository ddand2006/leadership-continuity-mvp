import type { CandidateAwardTier } from "@/lib/candidate-awards";

export type MentorScorecardTrack = {
  hasDevelopmentRecord: boolean;
  latestReportAt: string | null;
  latestReviewAt: string | null;
};

export type MentorScorecard = {
  score: number;
  tier: CandidateAwardTier | null;
  activeTrackCount: number;
  developmentRecordCount: number;
  currentReportCount: number;
  currentReviewCount: number;
  nextAction: string;
};

function recencyCredit(value: string | null, now: number) {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;

  const ageInDays = Math.max(0, (now - timestamp) / 86_400_000);
  if (ageInDays <= 30) return 1;
  if (ageInDays <= 60) return 0.5;
  return 0;
}

function tierForScore(score: number): CandidateAwardTier | null {
  if (score >= 90) return "platinum";
  if (score >= 75) return "gold";
  if (score >= 55) return "silver";
  if (score >= 35) return "bronze";
  return null;
}

export function computeMentorScorecard(
  tracks: MentorScorecardTrack[],
  now = Date.now(),
): MentorScorecard {
  const activeTrackCount = tracks.length;

  if (activeTrackCount === 0) {
    return {
      score: 0,
      tier: null,
      activeTrackCount,
      developmentRecordCount: 0,
      currentReportCount: 0,
      currentReviewCount: 0,
      nextAction: "Accept or create a mentoring assignment to begin building your scorecard.",
    };
  }

  const developmentRecordCount = tracks.filter(
    (track) => track.hasDevelopmentRecord,
  ).length;
  const reportCredits = tracks.map((track) => recencyCredit(track.latestReportAt, now));
  const reviewCredits = tracks.map((track) => recencyCredit(track.latestReviewAt, now));
  const currentReportCount = reportCredits.filter((credit) => credit === 1).length;
  const currentReviewCount = reviewCredits.filter((credit) => credit === 1).length;
  const developmentCoverage = developmentRecordCount / activeTrackCount;
  const reportCoverage =
    reportCredits.reduce<number>((total, credit) => total + credit, 0) /
    activeTrackCount;
  const reviewCoverage =
    reviewCredits.reduce<number>((total, credit) => total + credit, 0) /
    activeTrackCount;
  const score = Math.round(
    20 + developmentCoverage * 25 + reportCoverage * 25 + reviewCoverage * 30,
  );

  const nextAction =
    developmentCoverage < 1
      ? "Create a leadership development record for each active mentee."
      : reportCoverage < 1
        ? "Refresh the mentor report for the mentee whose report is due next."
        : reviewCoverage < 1
          ? "Complete a mentor review for the mentee whose review is due next."
          : "Keep your current mentoring cadence to maintain this level.";

  return {
    score,
    tier: tierForScore(score),
    activeTrackCount,
    developmentRecordCount,
    currentReportCount,
    currentReviewCount,
    nextAction,
  };
}
