import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole } from "@/lib/mentor-access";
import {
  departmentalProjectWorksheetPayloadSchema,
  isMissingDepartmentalProjectWorksheetTableError,
} from "@/lib/mentoring-departmental-project-worksheet";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = departmentalProjectWorksheetPayloadSchema.parse(
      await request.json(),
    );

    if (!isAdminAppRole(profile.role) && profile.role !== "mentor") {
      throw new ApiRouteError("Only admins or mentors can save this worksheet.", 403);
    }

    if (!isAdminAppRole(profile.role) && payload.mentorProfileId !== profile.id) {
      throw new ApiRouteError(
        "Mentors can only save worksheets for their own candidate-role assignments.",
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
      .from("mentoring_departmental_project_worksheets")
      .upsert(
        {
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          role_id: payload.roleId,
          mentor_profile_id: payload.mentorProfileId,
          status: payload.status,
          project_timeline: payload.projectTimeline || null,
          department_need: payload.departmentNeed || null,
          project_title: payload.projectTitle || null,
          project_objective: payload.projectObjective || null,
          project_importance: payload.projectImportance || null,
          responsible_outcomes: payload.responsibleOutcomes || null,
          collaborators: payload.collaborators || null,
          leadership_actions_required: payload.leadershipActionsRequired,
          leadership_actions_other: payload.leadershipActionsOther || null,
          competencies_developed: payload.competenciesDeveloped || null,
          mentor_anticipated_difficulty:
            payload.mentorAnticipatedDifficulty || null,
          mentor_stretch_competencies: payload.mentorStretchCompetencies || null,
          mentee_anticipated_difficulty:
            payload.menteeAnticipatedDifficulty || null,
          challenge_process_with_mentor:
            payload.challengeProcessWithMentor || null,
          coaching_areas: payload.coachingAreas || null,
          figuring_things_out_process: payload.figuringThingsOutProcess || null,
          help_threshold: payload.helpThreshold || null,
          success_measures: payload.successMeasures || null,
          post_project_leader_wins: payload.postProjectLeaderWins || null,
          post_project_do_differently: payload.postProjectDoDifferently || null,
          post_project_feedback_received:
            payload.postProjectFeedbackReceived || null,
          mentor_evaluation_competencies_developed:
            payload.mentorEvaluationCompetenciesDeveloped || null,
          strengths_observed: payload.strengthsObserved || null,
          future_development_areas: payload.futureDevelopmentAreas || null,
          readiness_signal: payload.readinessSignal || null,
          created_by_profile_id: profile.id,
        },
        { onConflict: "candidate_id,role_id,mentor_profile_id" },
      )
      .select("id, updated_at")
      .single();

    if (upsertResult.error) {
      if (isMissingDepartmentalProjectWorksheetTableError(upsertResult.error)) {
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
          ? "Departmental project worksheet saved and marked complete."
          : "Departmental project worksheet draft saved.",
      worksheet: {
        id: upsertResult.data.id,
        updatedAt: upsertResult.data.updated_at,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save the departmental project worksheet.",
    );
  }
}

