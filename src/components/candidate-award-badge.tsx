import Image from "next/image";
import type { CandidateAward } from "@/lib/candidate-awards";
import { getLegacyCertificationAsset } from "@/lib/legacy-certifications";

type CandidateAwardBadgeProps = {
  award: CandidateAward;
  size?: "sm" | "md";
};

const SIZE_CLASS_NAMES = {
  sm: "gap-2 px-3 py-1 text-xs",
  md: "gap-2.5 px-3.5 py-1.5 text-sm",
} as const;

const IMAGE_SIZE = {
  sm: 22,
  md: 28,
} as const;

function getBadgeClassName(tier: CandidateAward["tier"]) {
  switch (tier) {
    case "bronze":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "silver":
      return "border-slate-200 bg-slate-100 text-slate-800";
    case "gold":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    case "platinum":
      return "border-teal-200 bg-teal-50 text-teal-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function CandidateAwardBadge({
  award,
  size = "md",
}: CandidateAwardBadgeProps) {
  const asset = getLegacyCertificationAsset(award.tier);

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${SIZE_CLASS_NAMES[size]} ${getBadgeClassName(award.tier)}`}
    >
      {asset ? (
        <Image
          src={asset.src}
          alt={asset.alt}
          width={IMAGE_SIZE[size]}
          height={IMAGE_SIZE[size]}
          className="rounded-full"
        />
      ) : null}
      {asset ? asset.fullLabel : award.label}
    </span>
  );
}
