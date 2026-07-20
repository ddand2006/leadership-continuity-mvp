import type { CandidateAward } from "@/lib/candidate-awards";

type CandidateAwardBadgeProps = {
  award: CandidateAward;
  size?: "sm" | "md";
};

const SIZE_CLASS_NAMES = {
  sm: "px-3 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
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
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${SIZE_CLASS_NAMES[size]} ${getBadgeClassName(award.tier)}`}
    >
      {award.tier ? `${award.label} Award` : award.label}
    </span>
  );
}
