import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";

const createCandidateSchema = z.object({
  full_name: z.string().min(1),
  current_title: z.string().trim().optional(),
  target_role_id: z.string().uuid().optional(),
  status: z.enum(["active", "draft", "on_hold"]).default("active"),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = createCandidateSchema.parse(await request.json());

    if (payload.target_role_id) {
      const roleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.target_role_id)
        .maybeSingle();

      if (roleResult.error) {
        throw new ApiRouteError(roleResult.error.message, 500);
      }

      if (!roleResult.data) {
        throw new ApiRouteError("Selected target role could not be found.", 404);
      }
    }

    const insertResult = await admin
      .from("candidates")
      .insert({
        organization_id: profile.organization_id,
        full_name: payload.full_name.trim(),
        current_title: payload.current_title?.trim() || null,
        target_role_id: payload.target_role_id ?? null,
        status: payload.status,
      })
      .select("id, full_name")
      .single();

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    if (payload.target_role_id) {
      const considerationInsertResult = await admin
        .from("candidate_role_considerations")
        .upsert(
          {
            organization_id: profile.organization_id,
            candidate_id: insertResult.data.id,
            role_id: payload.target_role_id,
            status: "active",
            is_primary: true,
          },
          { onConflict: "candidate_id,role_id" },
        );

      if (considerationInsertResult.error) {
        throw new ApiRouteError(considerationInsertResult.error.message, 500);
      }

      const roleMentorsResult = await admin
        .from("role_mentor_assignments")
        .select("mentor_profile_id")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.target_role_id)
        .eq("status", "active");

      if (roleMentorsResult.error) {
        throw new ApiRouteError(roleMentorsResult.error.message, 500);
      }

      const mentorAssignments = (roleMentorsResult.data ?? []).map((assignment) => ({
        organization_id: profile.organization_id,
        candidate_id: insertResult.data.id,
        role_id: payload.target_role_id,
        mentor_profile_id: assignment.mentor_profile_id,
        status: "active",
      }));

      if (mentorAssignments.length > 0) {
        const mentorAssignmentInsertResult = await admin
          .from("mentor_role_assignments")
          .upsert(mentorAssignments, {
            onConflict: "candidate_id,role_id,mentor_profile_id",
          });

        if (mentorAssignmentInsertResult.error) {
          throw new ApiRouteError(mentorAssignmentInsertResult.error.message, 500);
        }
      }
    }

    return NextResponse.json({
      message: `Candidate "${insertResult.data.full_name}" created.`,
      candidateId: insertResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected candidate creation failure.");
  }
}
