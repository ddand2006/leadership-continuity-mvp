import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiRouteError } from "@/lib/api-route";
import { hasOpenAIEnv } from "@/lib/env";
import {
  generateRoleInterviewScorecardContent,
  hasLockedRoleInterviewScorecard,
  roleInterviewScorecardContentSchema,
  type RoleInterviewScorecardContent,
} from "@/lib/role-interview-scorecard";

type ScorecardIdealCompetencies = {
  talents: string[];
  skills: string[];
  behaviors: string[];
};

type ScorecardRoleCompetency = {
  name: string;
  definition: string;
  behavioral_indicators: string[];
  red_flags: string[];
};

function normalizeTextArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function createRoleInterviewScorecardSignature(options: {
  idealCompetencies: ScorecardIdealCompetencies;
  roleCompetencies: ScorecardRoleCompetency[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        idealCompetencies: {
          talents: normalizeTextArray(options.idealCompetencies.talents),
          skills: normalizeTextArray(options.idealCompetencies.skills),
          behaviors: normalizeTextArray(options.idealCompetencies.behaviors),
        },
        roleCompetencies: options.roleCompetencies.map((competency) => ({
          name: competency.name.trim(),
          definition: competency.definition.trim(),
          behavioral_indicators: normalizeTextArray(
            competency.behavioral_indicators,
          ),
          red_flags: normalizeTextArray(competency.red_flags),
        })),
      }),
    )
    .digest("hex");
}

function parseStoredRoleInterviewScorecardContent(value: unknown) {
  const parsed = roleInterviewScorecardContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function invalidateRoleInterviewScorecard(options: {
  admin: SupabaseClient;
  organizationId: string;
  roleId: string;
}) {
  const deleteResult = await options.admin
    .from("role_interview_scorecards")
    .delete()
    .eq("organization_id", options.organizationId)
    .eq("role_id", options.roleId);

  if (deleteResult.error) {
    throw new ApiRouteError(deleteResult.error.message, 500);
  }
}

export async function getOrCreateRoleInterviewScorecard(options: {
  admin: SupabaseClient;
  organizationId: string;
  organizationName: string;
  roleId: string;
  roleTitle: string;
  roleDescription: string;
  generatedByProfileId: string;
  idealCompetencies: ScorecardIdealCompetencies;
  roleCompetencies: ScorecardRoleCompetency[];
}) {
  const competencySignature = createRoleInterviewScorecardSignature({
    idealCompetencies: options.idealCompetencies,
    roleCompetencies: options.roleCompetencies,
  });

  const existingScorecardResult = await options.admin
    .from("role_interview_scorecards")
    .select("scorecard_json, competency_signature")
    .eq("organization_id", options.organizationId)
    .eq("role_id", options.roleId)
    .maybeSingle();

  if (existingScorecardResult.error) {
    throw new ApiRouteError(existingScorecardResult.error.message, 500);
  }

  const existingContent =
    existingScorecardResult.data?.competency_signature === competencySignature
      ? parseStoredRoleInterviewScorecardContent(
          existingScorecardResult.data.scorecard_json,
        )
      : null;

  if (existingContent) {
    return existingContent;
  }

  if (!hasOpenAIEnv() && !hasLockedRoleInterviewScorecard(options.roleTitle)) {
    throw new ApiRouteError(
      "Add OPENAI_API_KEY to .env.local before generating interview resources.",
      400,
    );
  }

  const content = await generateRoleInterviewScorecardContent({
    organizationName: options.organizationName,
    roleTitle: options.roleTitle,
    roleDescription: options.roleDescription,
    idealCompetencies: options.idealCompetencies,
    roleCompetencies: options.roleCompetencies,
  });

  const saveResult = await options.admin
    .from("role_interview_scorecards")
    .upsert(
      {
        organization_id: options.organizationId,
        role_id: options.roleId,
        generated_by_profile_id: options.generatedByProfileId,
        template_source:
          hasLockedRoleInterviewScorecard(options.roleTitle)
            ? "locked_template"
            : "generated",
        competency_signature: competencySignature,
        scorecard_json: content,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "role_id" },
    );

  if (saveResult.error) {
    throw new ApiRouteError(saveResult.error.message, 500);
  }

  return content;
}
