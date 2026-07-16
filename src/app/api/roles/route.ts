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

const createRoleSchema = z.object({
  roleId: z.string().uuid().optional(),
  title: z.string().min(1),
  department: z.string().trim().optional(),
  description: z.string().min(1),
  status: z.enum(["draft", "active"]).default("draft"),
  mentorProfileId: z.string().uuid().optional(),
  talents: z.array(z.string().min(1)).default([]),
  skills: z.array(z.string().min(1)).default([]),
  behaviors: z.array(z.string().min(1)).default([]),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = createRoleSchema.parse(await request.json());

    const existingRoleResult = await admin
      .from("roles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("title", payload.title.trim())
      .maybeSingle();

    if (existingRoleResult.error) {
      throw new ApiRouteError(existingRoleResult.error.message, 500);
    }

    if (
      existingRoleResult.data &&
      existingRoleResult.data.id !== payload.roleId
    ) {
      throw new ApiRouteError("A role with this title already exists.", 409);
    }

    if (payload.roleId) {
      const selectedRoleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .maybeSingle();

      if (selectedRoleResult.error) {
        throw new ApiRouteError(selectedRoleResult.error.message, 500);
      }

      if (!selectedRoleResult.data) {
        throw new ApiRouteError("The selected role could not be found.", 404);
      }
    }

    if (payload.mentorProfileId) {
      const mentorResult = await admin
        .from("profiles")
        .select("id, role")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.mentorProfileId)
        .maybeSingle();

      if (mentorResult.error) {
        throw new ApiRouteError(mentorResult.error.message, 500);
      }

      if (!mentorResult.data || mentorResult.data.role !== "mentor") {
        throw new ApiRouteError("Selected mentor could not be found.", 404);
      }
    }

    const normalizedCharacteristics = await normalizeRoleCandidateCharacteristics([
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

    let roleRecord: { id: string; title: string };

    if (payload.roleId) {
      const updateResult = await admin
        .from("roles")
        .update({
          title: payload.title.trim(),
          department: payload.department?.trim() || null,
          description: payload.description.trim(),
          status: payload.status,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .select("id, title")
        .single();

      if (updateResult.error) {
        throw new ApiRouteError(updateResult.error.message, 500);
      }

      roleRecord = updateResult.data;

      const deleteCharacteristicsResult = await admin
        .from("role_candidate_characteristics")
        .delete()
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId);

      if (deleteCharacteristicsResult.error) {
        throw new ApiRouteError(deleteCharacteristicsResult.error.message, 500);
      }
    } else {
      const insertResult = await admin
        .from("roles")
        .insert({
          organization_id: profile.organization_id,
          title: payload.title.trim(),
          department: payload.department?.trim() || null,
          description: payload.description.trim(),
          status: payload.status,
        })
        .select("id, title")
        .single();

      if (insertResult.error) {
        throw new ApiRouteError(insertResult.error.message, 500);
      }

      roleRecord = insertResult.data;
    }

    if (normalizedCharacteristics.length > 0) {
      await syncRoleCharacteristicLibrary({
        admin,
        organizationId: profile.organization_id,
        items: normalizedCharacteristics,
      });

      const insertCharacteristicsResult = await admin
        .from("role_candidate_characteristics")
        .insert(
          normalizedCharacteristics.map((item) => ({
            organization_id: profile.organization_id,
            role_id: roleRecord.id,
            category: item.category,
            characteristic: item.characteristic,
            sort_order: item.sort_order,
          })),
        );

      if (insertCharacteristicsResult.error) {
        throw new ApiRouteError(insertCharacteristicsResult.error.message, 500);
      }
    }

    if (payload.mentorProfileId) {
      const mentorAssignmentResult = await admin
        .from("role_mentor_assignments")
        .upsert(
          {
            organization_id: profile.organization_id,
            role_id: roleRecord.id,
            mentor_profile_id: payload.mentorProfileId,
            status: "active",
          },
          { onConflict: "role_id,mentor_profile_id" },
        );

      if (mentorAssignmentResult.error) {
        throw new ApiRouteError(mentorAssignmentResult.error.message, 500);
      }
    }

    if (payload.roleId) {
      await invalidateRoleInterviewScorecard({
        admin,
        organizationId: profile.organization_id,
        roleId: roleRecord.id,
      });
    }

    return NextResponse.json({
      message: payload.roleId
        ? `Role "${roleRecord.title}" updated.`
        : `Role "${roleRecord.title}" created.`,
      roleId: roleRecord.id,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected role creation failure.");
  }
}
