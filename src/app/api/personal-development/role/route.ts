import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";

const savePersonalRoleProfileSchema = z.object({
  currentPositionTitle: z.string().trim().max(200).optional().default(""),
  yearsInRole: z.number().min(0).max(80).nullable().optional(),
  leadershipHistory: z.string().trim().max(12000).optional().default(""),
  organizationalContext: z.string().trim().max(12000).optional().default(""),
  roleMode: z.enum(["organization_role", "personal_role"]),
  sourceRoleId: z.string().uuid().optional(),
  title: z.string().trim().max(200).optional().default(""),
  department: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(12000).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      product: "leadership_help",
    });
    const payload = savePersonalRoleProfileSchema.parse(await request.json());

    let roleTitle = payload.title.trim();
    let roleDepartment = payload.department.trim() || null;
    let roleDescription = payload.description.trim();
    let currentRoleId: string | null = null;

    if (payload.roleMode === "organization_role") {
      if (!payload.sourceRoleId) {
        throw new ApiRouteError("Choose an organizational role first.", 400);
      }

      const roleResult = await admin
        .from("roles")
        .select("id, title, department, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.sourceRoleId)
        .maybeSingle();

      if (roleResult.error) {
        throw new ApiRouteError(roleResult.error.message, 500);
      }

      if (!roleResult.data) {
        throw new ApiRouteError("The selected organizational role could not be found.", 404);
      }

      roleTitle = roleResult.data.title;
      roleDepartment = roleResult.data.department ?? null;
      roleDescription = roleResult.data.description ?? "";
      currentRoleId = roleResult.data.id;

      if (!roleDescription.trim()) {
        throw new ApiRouteError(
          "The selected organizational role needs a description before it can be used here.",
          400,
        );
      }
    } else {
      if (!roleTitle) {
        throw new ApiRouteError("Add a title for the personal role profile.", 400);
      }

      if (roleDescription.trim().length < 20) {
        throw new ApiRouteError(
          "Add a fuller role description so the leadership composite can be generated later.",
          400,
        );
      }
    }

    const personalProfileResult = await admin
      .from("personal_development_profiles")
      .upsert(
        {
          organization_id: profile.organization_id,
          profile_id: profile.id,
          current_role_id: currentRoleId,
          current_position_title: payload.currentPositionTitle.trim() || null,
          years_in_role: payload.yearsInRole ?? null,
          leadership_history: payload.leadershipHistory.trim() || null,
          organizational_context: payload.organizationalContext.trim() || null,
        },
        { onConflict: "profile_id" },
      )
      .select("id")
      .single();

    if (personalProfileResult.error) {
      throw new ApiRouteError(personalProfileResult.error.message, 500);
    }

    const roleProfileResult = await admin
      .from("personal_role_profiles")
      .upsert(
        {
          organization_id: profile.organization_id,
          personal_development_profile_id: personalProfileResult.data.id,
          source_role_id:
            payload.roleMode === "organization_role" ? payload.sourceRoleId ?? null : null,
          role_mode: payload.roleMode,
          title: roleTitle,
          department: roleDepartment,
          description: roleDescription,
        },
        { onConflict: "personal_development_profile_id" },
      )
      .select("id")
      .single();

    if (roleProfileResult.error) {
      throw new ApiRouteError(roleProfileResult.error.message, 500);
    }

    return NextResponse.json({
      message:
        payload.roleMode === "organization_role"
          ? `Your Personal Development workspace is now connected to "${roleTitle}".`
          : `Your personal role profile for "${roleTitle}" was saved.`,
      personalDevelopmentProfileId: personalProfileResult.data.id,
      personalRoleProfileId: roleProfileResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save the Personal Development role profile.",
    );
  }
}
