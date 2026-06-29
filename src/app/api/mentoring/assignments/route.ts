import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole } from "@/lib/mentor-access";

const createAssignmentSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid(),
  startDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = createAssignmentSchema.parse(await request.json());

    if (!isAdminAppRole(profile.role) && profile.role !== "mentor") {
      throw new ApiRouteError("Only admins or mentors can use this feature.", 403);
    }

    const [candidateResult, roleResult, mentorResult] = await Promise.all([
      admin
        .from("candidates")
        .select("id, full_name")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.candidateId)
        .maybeSingle(),
      admin
        .from("roles")
        .select("id, title")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id, full_name, role")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.mentorProfileId)
        .maybeSingle(),
    ]);

    for (const result of [candidateResult, roleResult, mentorResult]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data) {
      throw new ApiRouteError("Selected candidate could not be found.", 404);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    if (!mentorResult.data || mentorResult.data.role !== "mentor") {
      throw new ApiRouteError("Selected mentor could not be found.", 404);
    }

    if (!isAdminAppRole(profile.role)) {
      if (payload.mentorProfileId !== profile.id) {
        throw new ApiRouteError(
          "Mentors can only attach candidates to their own mentoring role.",
          403,
        );
      }

      const roleMentorAccessResult = await admin
        .from("role_mentor_assignments")
        .select("role_id")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .eq("mentor_profile_id", profile.id)
        .eq("status", "active")
        .maybeSingle();

      if (roleMentorAccessResult.error) {
        throw new ApiRouteError(roleMentorAccessResult.error.message, 500);
      }

      if (!roleMentorAccessResult.data) {
        throw new ApiRouteError(
          "You can only attach candidates to roles assigned to your mentor account.",
          403,
        );
      }
    }

    const roleMentorAssignmentResult = await admin
      .from("role_mentor_assignments")
      .upsert(
        {
          organization_id: profile.organization_id,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          status: "active",
        },
        { onConflict: "role_id,mentor_profile_id" },
      );

    if (roleMentorAssignmentResult.error) {
      throw new ApiRouteError(roleMentorAssignmentResult.error.message, 500);
    }

    const considerationResult = await admin
      .from("candidate_role_considerations")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          role_id: payload.roleId,
          status: "active",
          is_primary: false,
        },
        { onConflict: "candidate_id,role_id" },
      );

    if (considerationResult.error) {
      throw new ApiRouteError(considerationResult.error.message, 500);
    }

    const assignmentResult = await admin
      .from("mentor_role_assignments")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          status: "active",
          start_date: payload.startDate || null,
          notes: payload.notes || null,
        },
        { onConflict: "candidate_id,role_id,mentor_profile_id" },
      );

    if (assignmentResult.error) {
      throw new ApiRouteError(assignmentResult.error.message, 500);
    }

    const primaryCandidateUpdateResult = await admin
      .from("candidates")
      .update({
        target_role_id: payload.roleId,
      })
      .eq("organization_id", profile.organization_id)
      .eq("id", payload.candidateId)
      .is("target_role_id", null);

    if (primaryCandidateUpdateResult.error) {
      throw new ApiRouteError(primaryCandidateUpdateResult.error.message, 500);
    }

    return NextResponse.json({
      message: `${mentorResult.data.full_name} is now assigned to ${candidateResult.data.full_name} for ${roleResult.data.title}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected mentor assignment failure.");
  }
}
