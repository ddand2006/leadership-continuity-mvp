import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const createRoleMentorAssignmentSchema = z.object({
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid(),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = createRoleMentorAssignmentSchema.parse(await request.json());

    const [roleResult, mentorResult] = await Promise.all([
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

    for (const result of [roleResult, mentorResult]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);

    if (!mentorResult.data || mentorResult.data.role !== "mentor") {
      throw new ApiRouteError("Selected mentor could not be found.", 404);
    }

    const assignmentResult = await admin
      .from("role_mentor_assignments")
      .upsert(
        {
          organization_id: profile.organization_id,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          status: "active",
          notes: payload.notes || null,
        },
        { onConflict: "role_id,mentor_profile_id" },
      );

    if (assignmentResult.error) {
      throw new ApiRouteError(assignmentResult.error.message, 500);
    }

    const roleCandidatesResult = await admin
      .from("candidate_role_considerations")
      .select("candidate_id")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", payload.roleId);

    if (roleCandidatesResult.error) {
      throw new ApiRouteError(roleCandidatesResult.error.message, 500);
    }

    const candidateAssignments = (roleCandidatesResult.data ?? []).map((record) => ({
      organization_id: profile.organization_id,
      candidate_id: record.candidate_id,
      role_id: payload.roleId,
      mentor_profile_id: payload.mentorProfileId,
      status: "active",
      notes: payload.notes || null,
    }));

    if (candidateAssignments.length > 0) {
      const mentorRoleAssignmentResult = await admin
        .from("mentor_role_assignments")
        .upsert(candidateAssignments, {
          onConflict: "candidate_id,role_id,mentor_profile_id",
        });

      if (mentorRoleAssignmentResult.error) {
        throw new ApiRouteError(mentorRoleAssignmentResult.error.message, 500);
      }
    }

    return NextResponse.json({
      message:
        candidateAssignments.length > 0
          ? `${mentorResult.data.full_name} is now attached to ${roleTitle} and connected to ${candidateAssignments.length} candidate role track${candidateAssignments.length === 1 ? "" : "s"}.`
          : `${mentorResult.data.full_name} is now attached to ${roleTitle}.`,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected role mentor assignment failure.",
    );
  }
}
