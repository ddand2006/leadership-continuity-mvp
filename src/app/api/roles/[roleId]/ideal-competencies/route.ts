import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { invalidateRoleInterviewScorecard } from "@/lib/role-interview-scorecard-store";
import { syncRoleCharacteristicLibrary } from "@/lib/role-characteristic-library";
import { ROLE_CHARACTERISTIC_CATEGORIES } from "@/lib/role-characteristics";
import { normalizeRoleCandidateCharacteristics } from "@/lib/role-characteristics-normalizer";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const payloadSchema = z.object({
  talents: z.array(z.string().min(1)).default([]),
  skills: z.array(z.string().min(1)).default([]),
  behaviors: z.array(z.string().min(1)).default([]),
});

type RouteContext = {
  params: Promise<{
    roleId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { roleId } = await context.params;
    const payload = payloadSchema.parse(await request.json());

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

    const deleteResult = await admin
      .from("role_candidate_characteristics")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId);

    if (deleteResult.error) {
      throw new ApiRouteError(deleteResult.error.message, 500);
    }

    const competencies = await normalizeRoleCandidateCharacteristics([
      { category: ROLE_CHARACTERISTIC_CATEGORIES[0], items: payload.talents },
      { category: ROLE_CHARACTERISTIC_CATEGORIES[1], items: payload.skills },
      { category: ROLE_CHARACTERISTIC_CATEGORIES[2], items: payload.behaviors },
    ].flatMap(({ category, items }) =>
      items.map((characteristic, index) => ({
        category,
        characteristic: characteristic.trim(),
        sort_order: index,
      })),
    ));

    if (competencies.length > 0) {
      await syncRoleCharacteristicLibrary({
        admin,
        organizationId: profile.organization_id,
        items: competencies,
      });

      const insertResult = await admin
        .from("role_candidate_characteristics")
        .insert(
          competencies.map((competency) => ({
            organization_id: profile.organization_id,
            role_id: roleId,
            category: competency.category,
            characteristic: competency.characteristic,
            sort_order: competency.sort_order,
          })),
        );

      if (insertResult.error) {
        throw new ApiRouteError(insertResult.error.message, 500);
      }
    }

    await invalidateRoleInterviewScorecard({
      admin,
      organizationId: profile.organization_id,
      roleId,
    });

    return NextResponse.json({
      message: `Ideal candidate competencies updated for "${canonicalizeRoleTitle(roleResult.data.title)}".`,
      roleId,
      count: competencies.length,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected ideal candidate competencies update failure.",
    );
  }
}
