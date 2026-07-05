import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole } from "@/lib/mentor-access";

const payloadSchema = z.object({
  panelId: z.string().uuid().nullable().optional(),
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  panelName: z.string().min(1),
  dateCompleted: z.string().min(1),
  scores: z
    .array(
      z.object({
        competencyId: z.string().uuid(),
        scoreNumeric: z.number().min(1).max(5),
        evidenceNotes: z.string().optional(),
        concernNotes: z.string().optional(),
      }),
    )
    .min(1),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [
      candidateResult,
      roleResult,
      mentorAssignmentResult,
      editablePanelResult,
      competenciesResult,
    ] = await Promise.all([
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
        .from("mentor_role_assignments")
        .select("mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      payload.panelId
        ? admin
            .from("interview_panels")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .eq("id", payload.panelId)
            .eq("candidate_id", payload.candidateId)
            .eq("role_id", payload.roleId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("role_competencies")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId),
    ]);

    for (const result of [
      candidateResult,
      roleResult,
      mentorAssignmentResult,
      editablePanelResult,
      competenciesResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data || !roleResult.data) {
      throw new ApiRouteError("The candidate or role could not be found.", 404);
    }

    if (payload.panelId && !editablePanelResult.data) {
      throw new ApiRouteError(
        "The saved interview panel could not be found for editing.",
        404,
      );
    }

    const mentorHasAccess = (mentorAssignmentResult.data ?? []).some(
      (assignment) =>
        assignment.mentor_profile_id === profile.id && assignment.status === "active",
    );
    const canSubmit =
      isAdminAppRole(profile.role) ||
      mentorHasAccess ||
      profile.role === "interviewer";

    if (!canSubmit) {
      throw new ApiRouteError(
        "You do not have access to submit interview scores for this candidate.",
        403,
      );
    }

    const allowedCompetencyIds = new Set(
      (competenciesResult.data ?? []).map((competency) => competency.id),
    );

    if (
      payload.scores.some((score) => !allowedCompetencyIds.has(score.competencyId))
    ) {
      throw new ApiRouteError(
        "One or more submitted competency scores do not belong to the selected role.",
        400,
      );
    }

    let panelId = payload.panelId ? editablePanelResult.data?.id ?? null : null;

    if (!panelId) {
      const panelInsertResult = await admin
        .from("interview_panels")
        .insert({
          organization_id: profile.organization_id,
          role_id: payload.roleId,
          candidate_id: payload.candidateId,
          panel_name: payload.panelName.trim(),
          date_completed: payload.dateCompleted,
        })
        .select("id")
        .single();

      if (panelInsertResult.error) {
        throw new ApiRouteError(panelInsertResult.error.message, 500);
      }

      panelId = panelInsertResult.data.id;
    } else {
      const panelUpdateResult = await admin
        .from("interview_panels")
        .update({
          panel_name: payload.panelName.trim(),
          date_completed: payload.dateCompleted,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", panelId);

      if (panelUpdateResult.error) {
        throw new ApiRouteError(panelUpdateResult.error.message, 500);
      }
    }

    const scoresUpsertResult = await admin.from("interview_scores").upsert(
      payload.scores.map((score) => ({
        organization_id: profile.organization_id,
        panel_id: panelId,
        interviewer_profile_id: profile.id,
        competency_id: score.competencyId,
        score_numeric: score.scoreNumeric,
        evidence_notes: score.evidenceNotes?.trim() || null,
        concern_notes: score.concernNotes?.trim() || null,
      })),
      {
        onConflict: "panel_id,interviewer_profile_id,competency_id",
      },
    );

    if (scoresUpsertResult.error) {
      throw new ApiRouteError(scoresUpsertResult.error.message, 500);
    }

    return NextResponse.json({
      message: payload.panelId
        ? `Interview scores updated for "${candidateResult.data.full_name}" in ${roleResult.data.title}.`
        : `Interview scores saved for "${candidateResult.data.full_name}" in ${roleResult.data.title}.`,
      panelId,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save interview scores.",
    );
  }
}
