import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import {
  buildRoleInterviewScorecardDocumentBuffer,
  generateRoleInterviewScorecardContent,
} from "@/lib/role-interview-scorecard";
import { hasOpenAIEnv } from "@/lib/env";

type RouteContext = {
  params: Promise<{
    roleId: string;
  }>;
};

function createSafeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    if (!hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY to .env.local before generating interview resources.",
        400,
      );
    }

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

    if ((competenciesResult.data ?? []).length === 0) {
      throw new ApiRouteError(
        "Generate the role composite first so interview resources can be based on the role competencies.",
        400,
      );
    }

    const idealCompetencies = groupCharacteristicsByCategory(
      characteristicsResult.data ?? [],
    );

    const content = await generateRoleInterviewScorecardContent({
      organizationName: organizationResult.data?.name ?? "Organization",
      roleTitle: roleResult.data.title,
      roleDescription: roleResult.data.description ?? "",
      idealCompetencies,
      roleCompetencies: (competenciesResult.data ?? []).map((competency) => ({
        name: competency.name,
        definition: competency.definition ?? "",
        behavioral_indicators:
          (competency.behavioral_indicators as string[] | null) ?? [],
        red_flags: (competency.red_flags as string[] | null) ?? [],
      })),
    });

    const buffer = await buildRoleInterviewScorecardDocumentBuffer({
      organizationName: organizationResult.data?.name ?? "Organization",
      roleTitle: roleResult.data.title,
      content,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${createSafeFileName(roleResult.data.title)}-interview-scorecard.docx"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate the interview scorecard Word document.",
    );
  }
}
