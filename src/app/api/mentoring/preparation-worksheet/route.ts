import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole, isCandidateSelfAccess } from "@/lib/mentor-access";
import {
  isMissingPreparationWorksheetTableError,
  MENTORING_PREPARATION_WORKSHEET_TYPE,
  preparationWorksheetPayloadSchema,
} from "@/lib/mentoring-preparation-worksheet";

export async function POST(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = preparationWorksheetPayloadSchema.parse(await request.json());

    const canAccessAsCandidate = isCandidateSelfAccess(account, payload.candidateId);
    const canAccessAsMentor =
      (isAdminAppRole(profile.role) || profile.role === "mentor") &&
      (isAdminAppRole(profile.role) || payload.mentorProfileId === profile.id);

    if (!canAccessAsCandidate && !canAccessAsMentor) {
      throw new ApiRouteError(
        "You do not have access to save this worksheet.",
        403,
      );
    }

    const assignmentResult = await admin
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("role_id", payload.roleId)
      .eq("mentor_profile_id", payload.mentorProfileId)
      .eq("status", "active")
      .maybeSingle();

    if (assignmentResult.error) {
      throw new ApiRouteError(assignmentResult.error.message, 500);
    }

    if (!assignmentResult.data) {
      throw new ApiRouteError(
        "This worksheet must be tied to an active mentor assignment.",
        404,
      );
    }

    const priorityRanks = payload.criticalCompetencies
      .map((item) => item.priorityRank)
      .filter((value) => value.length > 0);
    const uniquePriorityRanks = new Set(priorityRanks);

    if (priorityRanks.length !== uniquePriorityRanks.size) {
      throw new ApiRouteError(
        "Each critical competency priority rank must be unique.",
        400,
      );
    }

    const upsertResult = await admin
      .from("mentoring_preparation_worksheets")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          worksheet_type: MENTORING_PREPARATION_WORKSHEET_TYPE,
          status: payload.status,
          worksheet_date: payload.worksheetDate || null,
          critical_competencies: payload.criticalCompetencies,
          mentee_least_prepared: payload.menteeLeastPrepared || null,
          mentee_strongest_area: payload.menteeStrongestArea || null,
          strengths_help: payload.strengthsHelp || null,
          strengths_distraction_plan: payload.strengthsDistractionPlan || null,
          shared_development_focus: payload.sharedDevelopmentFocus || null,
          desired_improvement: payload.desiredImprovement || null,
          mentor_support_needed: payload.mentorSupportNeeded || null,
          communication_expectations: payload.communicationExpectations || null,
          initial_development_focus: payload.initialDevelopmentFocus,
          mentor_guidance_notes: payload.mentorGuidanceNotes || null,
          created_by_profile_id: profile.id,
        },
        {
          onConflict:
            "candidate_id,role_id,mentor_profile_id,worksheet_type",
        },
      )
      .select("id, updated_at")
      .single();

    if (upsertResult.error) {
      if (isMissingPreparationWorksheetTableError(upsertResult.error)) {
        throw new ApiRouteError(
          "Worksheet storage is not available yet. Run the latest Supabase migration first.",
          503,
        );
      }

      throw new ApiRouteError(upsertResult.error.message, 500);
    }

    return NextResponse.json({
      message:
        payload.status === "completed"
          ? "Worksheet saved and marked complete."
          : "Worksheet draft saved.",
      worksheet: {
        id: upsertResult.data.id,
        updatedAt: upsertResult.data.updated_at,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save the mentor and mentee preparation worksheet.",
    );
  }
}
