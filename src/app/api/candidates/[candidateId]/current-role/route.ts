import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { canonicalizeRoleTitle } from "@/lib/role-title";

type RouteContext = {
  params: Promise<{ candidateId: string }>;
};

const currentRoleSchema = z.object({
  roleId: z.string().uuid().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { candidateId } = await context.params;
    const { roleId } = currentRoleSchema.parse(await request.json());

    const candidateResult = await admin
      .from("candidates")
      .select("id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateResult.error) {
      throw new ApiRouteError(candidateResult.error.message, 500);
    }
    if (!candidateResult.data) {
      throw new ApiRouteError("Selected candidate could not be found.", 404);
    }

    if (!roleId) {
      const clearResult = await admin
        .from("candidates")
        .update({ current_role_id: null, current_title: null })
        .eq("organization_id", profile.organization_id)
        .eq("id", candidateId);

      if (clearResult.error) {
        throw new ApiRouteError(clearResult.error.message, 500);
      }

      return NextResponse.json({ message: "Current organizational role cleared." });
    }

    const roleResult = await admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", profile.organization_id)
      .eq("id", roleId)
      .maybeSingle();

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }
    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);
    const updateResult = await admin
      .from("candidates")
      .update({ current_role_id: roleId, current_title: roleTitle })
      .eq("organization_id", profile.organization_id)
      .eq("id", candidateId);

    if (updateResult.error) {
      throw new ApiRouteError(updateResult.error.message, 500);
    }

    return NextResponse.json({
      message: `${roleTitle} is now ${candidateResult.data.full_name}'s current organizational role.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update the current role.");
  }
}
