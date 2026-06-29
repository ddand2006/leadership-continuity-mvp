import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole } from "@/lib/mentor-access";

const payloadSchema = z.object({
  roleId: z.string().uuid(),
  competencyId: z.string().uuid(),
  targetScore: z.number().min(1).max(5),
});

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [competencyResult, mentorAssignmentResult] = await Promise.all([
      admin
        .from("role_competencies")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .eq("id", payload.competencyId)
        .maybeSingle(),
      admin
        .from("mentor_role_assignments")
        .select("mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .eq("mentor_profile_id", profile.id)
        .eq("status", "active")
        .limit(1),
    ]);

    if (competencyResult.error) {
      throw new ApiRouteError(competencyResult.error.message, 500);
    }

    if (mentorAssignmentResult.error) {
      throw new ApiRouteError(mentorAssignmentResult.error.message, 500);
    }

    if (!competencyResult.data) {
      throw new ApiRouteError("That role competency could not be found.", 404);
    }

    const canEdit =
      isAdminAppRole(profile.role) || (mentorAssignmentResult.data ?? []).length > 0;

    if (!canEdit) {
      throw new ApiRouteError(
        "You do not have access to update target scores for this role.",
        403,
      );
    }

    const updateResult = await admin
      .from("role_competencies")
      .update({
        target_score: Number(payload.targetScore.toFixed(2)),
      })
      .eq("organization_id", profile.organization_id)
      .eq("role_id", payload.roleId)
      .eq("id", payload.competencyId);

    if (updateResult.error) {
      throw new ApiRouteError(updateResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Target score updated for "${competencyResult.data.name}".`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update the target score.");
  }
}
