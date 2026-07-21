import type { CandidateAwardTier } from "@/lib/candidate-awards";
import type { OrganizationAwardTier } from "@/lib/organization-awards";

export type LegacyCertificationTier =
  | CandidateAwardTier
  | OrganizationAwardTier;

type LegacyCertificationAsset = {
  src: string;
  alt: string;
  shortLabel: string;
  fullLabel: string;
};

const LEGACY_CERTIFICATION_ASSETS: Record<
  LegacyCertificationTier,
  LegacyCertificationAsset
> = {
  bronze: {
    src: "/legacy-certifications/bronze.png",
    alt: "Legacy Bronze Leadership Continuity certification logo",
    shortLabel: "Bronze",
    fullLabel: "Bronze Certification",
  },
  silver: {
    src: "/legacy-certifications/silver.png",
    alt: "Legacy Silver Leadership Continuity certification logo",
    shortLabel: "Silver",
    fullLabel: "Silver Certification",
  },
  gold: {
    src: "/legacy-certifications/gold.png",
    alt: "Legacy Gold Leadership Continuity certification logo",
    shortLabel: "Gold",
    fullLabel: "Gold Certification",
  },
  platinum: {
    src: "/legacy-certifications/platinum.png",
    alt: "Legacy Platinum Leadership Continuity certification logo",
    shortLabel: "Platinum",
    fullLabel: "Platinum Certification",
  },
};

export function getLegacyCertificationAsset(
  tier: LegacyCertificationTier | null,
) {
  if (!tier) {
    return null;
  }

  return LEGACY_CERTIFICATION_ASSETS[tier];
}
