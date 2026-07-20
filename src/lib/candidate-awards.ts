export type CandidateAwardTier = "bronze" | "silver" | "gold" | "platinum";

export type CandidateAwardGate =
  | "readiness"
  | "mentor_assignment"
  | "development_record"
  | "mentor_review";

export type CandidateAward = {
  tier: CandidateAwardTier | null;
  rawTier: CandidateAwardTier | null;
  readinessPercent: number | null;
  gate: CandidateAwardGate | null;
  label: string;
  shortDescription: string;
  nextStep: string;
};

const AWARD_ORDER: CandidateAwardTier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
];

const AWARD_LABELS: Record<CandidateAwardTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

function getTierRank(tier: CandidateAwardTier) {
  return AWARD_ORDER.indexOf(tier);
}

function clampTier(
  tier: CandidateAwardTier | null,
  maxTier: CandidateAwardTier,
) {
  if (!tier) {
    return null;
  }

  return getTierRank(tier) > getTierRank(maxTier) ? maxTier : tier;
}

export function getCandidateAwardTierFromReadiness(
  readinessPercent: number | null,
): CandidateAwardTier | null {
  if (readinessPercent === null || !Number.isFinite(readinessPercent)) {
    return null;
  }

  if (readinessPercent >= 100) {
    return "platinum";
  }

  if (readinessPercent >= 90) {
    return "gold";
  }

  if (readinessPercent >= 75) {
    return "silver";
  }

  if (readinessPercent >= 60) {
    return "bronze";
  }

  return null;
}

export function computeCandidateAward(input: {
  readinessPercent: number | null;
  hasMentorAssigned: boolean;
  hasDevelopmentRecord: boolean;
  hasCompletedMentorReview: boolean;
}): CandidateAward {
  const rawTier = getCandidateAwardTierFromReadiness(input.readinessPercent);

  if (!rawTier) {
    return {
      tier: null,
      rawTier,
      readinessPercent: input.readinessPercent,
      gate: "readiness",
      label: "No award yet",
      shortDescription:
        "Awards begin once the candidate reaches at least 60% role-goal readiness.",
      nextStep: "Increase role-goal readiness to 60% or higher to unlock Bronze.",
    };
  }

  if (!input.hasMentorAssigned) {
    const tier = clampTier(rawTier, "bronze");

    return {
      tier,
      rawTier,
      readinessPercent: input.readinessPercent,
      gate: getTierRank(rawTier) > getTierRank("bronze") ? "mentor_assignment" : null,
      label: AWARD_LABELS[tier ?? "bronze"],
      shortDescription:
        tier === rawTier
          ? "Bronze recognizes early readiness momentum for this role."
          : "Readiness is higher, but awards stay capped at Bronze until a mentor is assigned.",
      nextStep: "Assign a mentor to unlock Silver, Gold, and Platinum awards.",
    };
  }

  if (!input.hasDevelopmentRecord) {
    const tier = clampTier(rawTier, "silver");

    return {
      tier,
      rawTier,
      readinessPercent: input.readinessPercent,
      gate: getTierRank(rawTier) > getTierRank("silver") ? "development_record" : null,
      label: AWARD_LABELS[tier ?? "silver"],
      shortDescription:
        tier === rawTier
          ? "Silver reflects strong readiness with a mentor already in place."
          : "Readiness is higher, but awards stay capped at Silver until a development record is saved.",
      nextStep:
        "Save a leadership development record to unlock Gold and Platinum awards.",
    };
  }

  if (!input.hasCompletedMentorReview) {
    const tier = clampTier(rawTier, "gold");

    return {
      tier,
      rawTier,
      readinessPercent: input.readinessPercent,
      gate: getTierRank(rawTier) > getTierRank("gold") ? "mentor_review" : null,
      label: AWARD_LABELS[tier ?? "gold"],
      shortDescription:
        tier === rawTier
          ? "Gold shows strong readiness backed by an active development record."
          : "Readiness is higher, but Platinum stays locked until a mentor-reviewed development record is on file.",
      nextStep:
        "Complete at least one mentor review to unlock Platinum recognition.",
    };
  }

  return {
    tier: rawTier,
    rawTier,
    readinessPercent: input.readinessPercent,
    gate: null,
    label: AWARD_LABELS[rawTier],
    shortDescription:
      rawTier === "platinum"
        ? "Platinum confirms full role-goal readiness with mentor-reviewed evidence."
        : `${AWARD_LABELS[rawTier]} reflects the candidate's current role-goal readiness and completed mentoring milestones.`,
    nextStep:
      rawTier === "platinum"
        ? "Maintain the current development cadence and use this candidate in succession planning conversations."
        : "Continue lifting role-goal readiness and complete mentor checkpoints to move toward Platinum.",
  };
}
