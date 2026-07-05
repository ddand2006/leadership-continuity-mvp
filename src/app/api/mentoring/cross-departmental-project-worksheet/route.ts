import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole, isCandidateSelfAccess } from "@/lib/mentor-access";
import {
  crossDepartmentalProjectWorksheetPayloadSchema,
  isMissingCrossDepartmentalProjectWorksheetTableError,
} from "@/lib/mentoring-cross-departmental-project-worksheet";

export async function POST(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = crossDepartmentalProjectWorksheetPayloadSchema.parse(
      await request.json(),
    );

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

    const upsertResult = await admin
      .from("mentoring_cross_departmental_project_worksheets")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          status: payload.status,
          worksheet_date: payload.worksheetDate || null,
          department_conversations: payload.departmentConversations,
          cross_department_challenge: payload.crossDepartmentChallenge || null,
          project_title: payload.projectTitle || null,
          project_objective: payload.projectObjective || null,
          project_partners: payload.projectPartners || null,
          project_timeline: payload.projectTimeline || null,
          project_learning_goal: payload.projectLearningGoal || null,
          shared_themes: payload.sharedThemes || null,
          alignment_risks: payload.alignmentRisks || null,
          biggest_surprise: payload.biggestSurprise || null,
          leadership_shift: payload.leadershipShift || null,
          critical_behaviors: payload.criticalBehaviors || null,
          hospital_insights: payload.hospitalInsights || null,
          action_commitments: payload.actionCommitments,
          mentor_observed_qualities: payload.mentorObservedQualities,
          mentor_comments: payload.mentorComments || null,
          created_by_profile_id: profile.id,
        },
        { onConflict: "candidate_id,role_id,mentor_profile_id" },
      )
      .select("id, updated_at")
      .single();

    if (upsertResult.error) {
      if (isMissingCrossDepartmentalProjectWorksheetTableError(upsertResult.error)) {
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
          ? "Cross-departmental project worksheet saved and marked complete."
          : "Cross-departmental project worksheet draft saved.",
      worksheet: {
        id: upsertResult.data.id,
        updatedAt: upsertResult.data.updated_at,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save the cross-departmental project worksheet.",
    );
  }
}
