import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole } from "@/lib/mentor-access";

const payloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  competencyId: z.string().uuid(),
  idea: z.object({
    title: z.string().min(1),
    project_type: z.enum(["departmental", "cross_departmental"]),
    purpose: z.string().min(1),
    description: z.string().min(1),
    working_goal: z.string().min(1),
    why_it_fits: z.string().min(1),
    strengths_application: z.string().min(1),
    mentor_focus: z.string().min(1),
    first_step: z.string().min(1),
    key_partners: z.array(z.string().min(1)).min(2).max(6),
    leadership_actions_required: z.array(z.string().min(1)).min(2).max(5),
    mentor_preparation: z.array(z.string().min(1)).min(2).max(4),
    mentee_preparation: z.array(z.string().min(1)).min(2).max(4),
    anticipated_challenges: z.array(z.string().min(1)).min(2).max(4),
    success_measures: z.array(z.string().min(1)).min(3).max(5),
    reflection_questions: z.array(z.string().min(1)).min(2).max(4),
    duration_days: z.number().int().min(14).max(120),
    success_signals: z.array(z.string().min(1)).min(2).max(6),
  }),
});

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [
      candidateResult,
      roleResult,
      competencyResult,
      mentorAssignmentsResult,
      existingProjectResult,
    ] = await Promise.all([
      admin
        .from("candidates")
        .select("id, full_name, target_role_id")
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
        .from("role_competencies")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.competencyId)
        .maybeSingle(),
      admin
        .from("mentor_role_assignments")
        .select("mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      admin
        .from("development_projects")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("title", payload.idea.title)
        .maybeSingle(),
    ]);

    for (const result of [
      candidateResult,
      roleResult,
      competencyResult,
      mentorAssignmentsResult,
      existingProjectResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data || !roleResult.data || !competencyResult.data) {
      throw new ApiRouteError("Unable to locate the candidate, role, or competency.", 404);
    }

    const mentorHasAccess = (mentorAssignmentsResult.data ?? []).some(
      (assignment) =>
        assignment.mentor_profile_id === profile.id && assignment.status === "active",
    );

    if (!isAdminAppRole(profile.role) && !mentorHasAccess) {
      throw new ApiRouteError(
        "You do not have access to choose mentoring projects for this candidate.",
        403,
      );
    }

    let developmentProjectId = existingProjectResult.data?.id ?? null;

    if (!developmentProjectId) {
      const insertProjectResult = await admin
        .from("development_projects")
        .insert({
          organization_id: profile.organization_id,
          title: payload.idea.title,
          description: [
            `Project type: ${payload.idea.project_type === "cross_departmental" ? "Cross-Departmental Project" : "Departmental Project"}`,
            `Purpose: ${payload.idea.purpose}`,
            payload.idea.description,
            "",
            `Working goal: ${payload.idea.working_goal}`,
            `Why it fits: ${payload.idea.why_it_fits}`,
            `How strengths can help: ${payload.idea.strengths_application}`,
            `Mentor focus: ${payload.idea.mentor_focus}`,
            `First step: ${payload.idea.first_step}`,
            `Key partners: ${payload.idea.key_partners.join(", ")}`,
            `Leadership actions required: ${payload.idea.leadership_actions_required.join(" • ")}`,
            `Anticipated challenges: ${payload.idea.anticipated_challenges.join(" • ")}`,
          ].join("\n"),
          difficulty: "intermediate",
          duration_days: payload.idea.duration_days,
          applicable_roles: [roleResult.data.title],
          competencies_developed: [competencyResult.data.name],
          strengths_leveraged: [],
          expected_outcomes: payload.idea.success_measures,
          mentor_questions: payload.idea.reflection_questions,
          evidence_of_success: payload.idea.success_signals,
        })
        .select("id")
        .single();

      if (insertProjectResult.error) {
        throw new ApiRouteError(insertProjectResult.error.message, 500);
      }

      developmentProjectId = insertProjectResult.data.id;
    }

    const existingAssignmentResult = await admin
      .from("candidate_project_assignments")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("development_project_id", developmentProjectId)
      .maybeSingle();

    if (existingAssignmentResult.error) {
      throw new ApiRouteError(existingAssignmentResult.error.message, 500);
    }

    if (!existingAssignmentResult.data) {
      const today = new Date();
      const dueDate = addDays(today, payload.idea.duration_days);
      const assignmentResult = await admin
        .from("candidate_project_assignments")
        .insert({
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          mentor_profile_id: mentorHasAccess ? profile.id : null,
          development_project_id: developmentProjectId,
          status: "assigned",
          start_date: toIsoDate(today),
          due_date: toIsoDate(dueDate),
          mentor_notes: `Candidate-specific project selected for ${roleResult.data.title}. Focus competency: ${competencyResult.data.name}.`,
        });

      if (assignmentResult.error) {
        throw new ApiRouteError(assignmentResult.error.message, 500);
      }
    }

    return NextResponse.json({
      message: `"${payload.idea.title}" has been chosen for ${candidateResult.data.full_name}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to choose this mentoring project.");
  }
}
