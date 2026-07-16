import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { getOrCreateRoleInterviewScorecard } from "@/lib/role-interview-scorecard-store";
import { canonicalizeRoleTitle } from "@/lib/role-title";

type RouteContext = {
  params: Promise<{
    roleId: string;
  }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { roleId } = await context.params;

    const [organizationResult, roleResult, characteristicsResult, competenciesResult] =
      await Promise.all([
        admin
          .from("organizations")
          .select("name")
          .eq("id", profile.organization_id)
          .maybeSingle(),
        admin
          .from("roles")
          .select("id, title, description")
          .eq("organization_id", profile.organization_id)
          .eq("id", roleId)
          .maybeSingle(),
        admin
          .from("role_candidate_characteristics")
          .select("category, characteristic, sort_order")
          .eq("organization_id", profile.organization_id)
          .eq("role_id", roleId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        admin
          .from("role_competencies")
          .select("name, definition, behavioral_indicators, red_flags")
          .eq("organization_id", profile.organization_id)
          .eq("role_id", roleId)
          .order("created_at", { ascending: true }),
      ]);

    for (const result of [
      organizationResult,
      roleResult,
      characteristicsResult,
      competenciesResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);
    if ((competenciesResult.data ?? []).length === 0) {
      throw new ApiRouteError(
        "Generate the role composite first so interview resources can be based on the role competencies.",
        400,
      );
    }

    const idealCompetencies = groupCharacteristicsByCategory(
      characteristicsResult.data ?? [],
    );

    const roleCompetencies = (competenciesResult.data ?? []).map((competency) => ({
      name: competency.name,
      definition: competency.definition ?? "",
      behavioral_indicators:
        (competency.behavioral_indicators as string[] | null) ?? [],
      red_flags: (competency.red_flags as string[] | null) ?? [],
    }));

    const content = await getOrCreateRoleInterviewScorecard({
      admin,
      organizationId: profile.organization_id,
      organizationName: organizationResult.data?.name ?? "Organization",
      roleId,
      roleTitle,
      roleDescription: roleResult.data.description ?? "",
      generatedByProfileId: profile.id,
      idealCompetencies,
      roleCompetencies,
    });

    return NextResponse.json({
      roleTitle,
      purpose: content.purpose,
      sections: content.sections,
      finalSummaryLabels: content.final_summary_labels,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate interview scorecard content.",
    );
  }
}
