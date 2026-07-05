import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";

type RouteContext = {
  params: Promise<{
    candidateId: string;
  }>;
};

const roleConsiderationStatusSchema = z.enum(["active", "on_hold"]);

const createRoleConsiderationSchema = z.object({
  roleId: z.string().uuid(),
  status: roleConsiderationStatusSchema.default("active"),
  makePrimary: z.boolean().optional(),
});

const updateRoleConsiderationSchema = z.object({
  roleId: z.string().uuid(),
  status: roleConsiderationStatusSchema,
  makePrimary: z.boolean().optional(),
});

async function loadCandidateAndRole(options: {
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"];
  organizationId: string;
  candidateId: string;
  roleId: string;
}) {
  const [candidateResult, roleResult] = await Promise.all([
    options.admin
      .from("candidates")
      .select("id, full_name, target_role_id")
      .eq("organization_id", options.organizationId)
      .eq("id", options.candidateId)
      .maybeSingle(),
    options.admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", options.organizationId)
      .eq("id", options.roleId)
      .maybeSingle(),
  ]);

  if (candidateResult.error) {
    throw new ApiRouteError(candidateResult.error.message, 500);
  }

  if (roleResult.error) {
    throw new ApiRouteError(roleResult.error.message, 500);
  }

  if (!candidateResult.data) {
    throw new ApiRouteError("Selected candidate could not be found.", 404);
  }

  if (!roleResult.data) {
    throw new ApiRouteError("Selected role could not be found.", 404);
  }

  return {
    candidate: candidateResult.data,
    role: roleResult.data,
  };
}

async function setPrimaryRole(options: {
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"];
  organizationId: string;
  candidateId: string;
  roleId: string;
}) {
  const clearPrimaryResult = await options.admin
    .from("candidate_role_considerations")
    .update({ is_primary: false })
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId);

  if (clearPrimaryResult.error) {
    throw new ApiRouteError(clearPrimaryResult.error.message, 500);
  }

  const setPrimaryResult = await options.admin
    .from("candidate_role_considerations")
    .update({ is_primary: true })
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId)
    .eq("role_id", options.roleId);

  if (setPrimaryResult.error) {
    throw new ApiRouteError(setPrimaryResult.error.message, 500);
  }

  const candidateUpdateResult = await options.admin
    .from("candidates")
    .update({ target_role_id: options.roleId })
    .eq("organization_id", options.organizationId)
    .eq("id", options.candidateId);

  if (candidateUpdateResult.error) {
    throw new ApiRouteError(candidateUpdateResult.error.message, 500);
  }
}

async function syncCandidateRoleMentorAssignments(options: {
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"];
  organizationId: string;
  candidateId: string;
  roleId: string;
  status: "active" | "on_hold";
}) {
  const roleMentorsResult = await options.admin
    .from("role_mentor_assignments")
    .select("mentor_profile_id")
    .eq("organization_id", options.organizationId)
    .eq("role_id", options.roleId)
    .eq("status", "active");

  if (roleMentorsResult.error) {
    throw new ApiRouteError(roleMentorsResult.error.message, 500);
  }

  const existingAssignmentsResult = await options.admin
    .from("mentor_role_assignments")
    .select("id")
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId)
    .eq("role_id", options.roleId);

  if (existingAssignmentsResult.error) {
    throw new ApiRouteError(existingAssignmentsResult.error.message, 500);
  }

  if ((existingAssignmentsResult.data ?? []).length > 0) {
    const updateExistingResult = await options.admin
      .from("mentor_role_assignments")
      .update({ status: options.status })
      .eq("organization_id", options.organizationId)
      .eq("candidate_id", options.candidateId)
      .eq("role_id", options.roleId);

    if (updateExistingResult.error) {
      throw new ApiRouteError(updateExistingResult.error.message, 500);
    }
  }

  const mentorAssignments = (roleMentorsResult.data ?? []).map((assignment) => ({
    organization_id: options.organizationId,
    candidate_id: options.candidateId,
    role_id: options.roleId,
    mentor_profile_id: assignment.mentor_profile_id,
    status: options.status,
  }));

  if (mentorAssignments.length === 0) {
    return;
  }

  const upsertMentorAssignmentsResult = await options.admin
    .from("mentor_role_assignments")
    .upsert(mentorAssignments, {
      onConflict: "candidate_id,role_id,mentor_profile_id",
    });

  if (upsertMentorAssignmentsResult.error) {
    throw new ApiRouteError(upsertMentorAssignmentsResult.error.message, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { candidateId } = await context.params;
    const payload = createRoleConsiderationSchema.parse(await request.json());
    const { candidate, role } = await loadCandidateAndRole({
      admin,
      organizationId: profile.organization_id,
      candidateId,
      roleId: payload.roleId,
    });

    const existingConsiderationsResult = await admin
      .from("candidate_role_considerations")
      .select("role_id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId);

    if (existingConsiderationsResult.error) {
      throw new ApiRouteError(existingConsiderationsResult.error.message, 500);
    }

    const shouldBePrimary =
      payload.makePrimary === true ||
      (existingConsiderationsResult.data ?? []).length === 0 ||
      !candidate.target_role_id;

    const upsertConsiderationResult = await admin
      .from("candidate_role_considerations")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: candidateId,
          role_id: payload.roleId,
          status: payload.status,
          is_primary: shouldBePrimary,
        },
        { onConflict: "candidate_id,role_id" },
      );

    if (upsertConsiderationResult.error) {
      throw new ApiRouteError(upsertConsiderationResult.error.message, 500);
    }

    if (shouldBePrimary) {
      await setPrimaryRole({
        admin,
        organizationId: profile.organization_id,
        candidateId,
        roleId: payload.roleId,
      });
    }

    await syncCandidateRoleMentorAssignments({
      admin,
      organizationId: profile.organization_id,
      candidateId,
      roleId: payload.roleId,
      status: payload.status,
    });

    return NextResponse.json({
      message: `${role.title} is now attached to ${candidate.full_name}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to assign this position.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { candidateId } = await context.params;
    const payload = updateRoleConsiderationSchema.parse(await request.json());
    const { candidate, role } = await loadCandidateAndRole({
      admin,
      organizationId: profile.organization_id,
      candidateId,
      roleId: payload.roleId,
    });

    const existingConsiderationResult = await admin
      .from("candidate_role_considerations")
      .select("role_id, is_primary")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("role_id", payload.roleId)
      .maybeSingle();

    if (existingConsiderationResult.error) {
      throw new ApiRouteError(existingConsiderationResult.error.message, 500);
    }

    if (!existingConsiderationResult.data) {
      throw new ApiRouteError("This role is not attached to the candidate yet.", 404);
    }

    const updateConsiderationResult = await admin
      .from("candidate_role_considerations")
      .update({
        status: payload.status,
      })
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("role_id", payload.roleId);

    if (updateConsiderationResult.error) {
      throw new ApiRouteError(updateConsiderationResult.error.message, 500);
    }

    if (payload.makePrimary) {
      await setPrimaryRole({
        admin,
        organizationId: profile.organization_id,
        candidateId,
        roleId: payload.roleId,
      });
    } else if (
      existingConsiderationResult.data.is_primary &&
      candidate.target_role_id !== payload.roleId
    ) {
      const candidateUpdateResult = await admin
        .from("candidates")
        .update({ target_role_id: payload.roleId })
        .eq("organization_id", profile.organization_id)
        .eq("id", candidateId);

      if (candidateUpdateResult.error) {
        throw new ApiRouteError(candidateUpdateResult.error.message, 500);
      }
    }

    await syncCandidateRoleMentorAssignments({
      admin,
      organizationId: profile.organization_id,
      candidateId,
      roleId: payload.roleId,
      status: payload.status,
    });

    return NextResponse.json({
      message: `${role.title} was updated for ${candidate.full_name}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update this position.");
  }
}
