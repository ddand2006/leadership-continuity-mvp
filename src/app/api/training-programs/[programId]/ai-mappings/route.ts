import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { hasOpenAIEnv } from "@/lib/env";
import { generateTrainingProgramMappings } from "@/lib/training-program-ai-mapping";

type RouteContext = { params: Promise<{ programId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    if (!hasOpenAIEnv()) {
      throw new ApiRouteError("Add OPENAI_API_KEY before generating training mappings.", 503);
    }

    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const { programId } = await context.params;
    z.string().uuid().parse(programId);
    const [programResult, competenciesResult] = await Promise.all([
      admin
        .from("training_programs")
        .select("name, description, delivery_formats, audience_levels, training_providers(name)")
        .eq("organization_id", profile.organization_id)
        .eq("id", programId)
        .maybeSingle(),
      admin
        .from("role_competencies")
        .select("name, definition")
        .eq("organization_id", profile.organization_id)
        .order("name", { ascending: true }),
    ]);

    for (const result of [programResult, competenciesResult]) {
      if (result.error) throw new ApiRouteError(result.error.message, 500);
    }
    if (!programResult.data) throw new ApiRouteError("Training program could not be found.", 404);

    const provider = Array.isArray(programResult.data.training_providers)
      ? programResult.data.training_providers[0]
      : programResult.data.training_providers;
    const competencies = Array.from(
      new Map((competenciesResult.data ?? []).map((competency) => [competency.name.trim().toLowerCase(), competency])).values(),
    );
    const mappings = await generateTrainingProgramMappings({
      program: {
        name: programResult.data.name,
        provider: provider?.name ?? "Training provider",
        description: programResult.data.description,
        deliveryFormat: Array.isArray(programResult.data.delivery_formats) ? programResult.data.delivery_formats.join(", ") : "",
        intendedAudience: Array.isArray(programResult.data.audience_levels) ? programResult.data.audience_levels.join(", ") : "",
      },
      competencies,
    });

    return NextResponse.json({ mappings, message: "AI suggestions are ready for review. Save the program to apply them." });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to generate competency mappings.");
  }
}
