import { createHash } from "node:crypto";

export type PrintableRoleCompetency = {
  name: string;
  definition: string | null;
  weight?: number | null;
  target_score?: number | null;
  behavioral_indicators: unknown;
  red_flags: unknown;
};

function normalize(values: unknown) {
  return Array.isArray(values) ? values.map(String).map((value) => value.trim()).filter(Boolean) : [];
}

export function createRolePrintableCompetencySignature(competencies: PrintableRoleCompetency[]) {
  return createHash("sha256").update(JSON.stringify(competencies.map((competency) => ({
    name: competency.name.trim(), definition: competency.definition?.trim() ?? "", weight: competency.weight ?? null,
    targetScore: competency.target_score ?? null, indicators: normalize(competency.behavioral_indicators), redFlags: normalize(competency.red_flags),
  })))).digest("hex");
}
