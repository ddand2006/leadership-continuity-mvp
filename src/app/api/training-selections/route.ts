import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole, isMentorAppUser } from "@/lib/mentor-access";
import { normalizeTrainingCompetencyName } from "@/lib/outside-training-programs";

const trainingSelectionSchema = z.object({
  trainingProgramId: z.string().uuid(),
  roleId: z.string().uuid(),
  competencyName: z.string().trim().min(1).max(200),
  status: z.enum(["exploring", "shortlisted", "approved", "scheduled"]).default("shortlisted"),
  notes: z.string().trim().max(2_000).optional(),
  plannedStartDate: z.string().date().optional(),
  plannedCompletionDate: z.string().date().optional(),
}).superRefine((value, context) => {
  if (
    value.plannedStartDate &&
    value.plannedCompletionDate &&
    value.plannedCompletionDate < value.plannedStartDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["plannedCompletionDate"],
      message: "Planned completion must be on or after the planned start date.",
    });
  }
});

export async function POST(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = trainingSelectionSchema.parse(await request.json());

    if (!isAdminAppRole(profile.role) && !isMentorAppUser(profile, account)) {
      throw new ApiRouteError(
        "Only organization administrators and mentors can save training selections.",
        403,
      );
    }

    const [programResult, roleResult] = await Promise.all([
      admin
        .from("training_programs")
        .select("id, training_program_competencies(competency_name)")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.trainingProgramId)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("roles")
        .select("id, role_competencies(name)")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    for (const result of [programResult, roleResult]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!programResult.data) {
      throw new ApiRouteError("Selected training program could not be found.", 404);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const normalizedCompetency = normalizeTrainingCompetencyName(payload.competencyName);
    const roleHasCompetency = (roleResult.data.role_competencies ?? []).some(
      (competency) => normalizeTrainingCompetencyName(competency.name) === normalizedCompetency,
    );
    const programSupportsCompetency = (
      programResult.data.training_program_competencies ?? []
    ).some(
      (competency) =>
        normalizeTrainingCompetencyName(competency.competency_name) === normalizedCompetency,
    );

    if (!roleHasCompetency || !programSupportsCompetency) {
      throw new ApiRouteError(
        "This program must be selected for a matching priority on the selected role.",
        400,
      );
    }

    const selectionResult = await admin
      .from("training_selections")
      .insert({
        organization_id: profile.organization_id,
        training_program_id: payload.trainingProgramId,
        role_id: payload.roleId,
        competency_name: payload.competencyName,
        status: payload.status,
        selected_by_user_id: profile.id,
        notes: payload.notes || null,
        planned_start_date: payload.plannedStartDate || null,
        planned_completion_date: payload.plannedCompletionDate || null,
      })
      .select("id")
      .single();

    if (selectionResult.error) {
      throw new ApiRouteError(selectionResult.error.message, 500);
    }

    return NextResponse.json({
      id: selectionResult.data.id,
      message: "Training selection saved.",
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to save this training selection.");
  }
}
