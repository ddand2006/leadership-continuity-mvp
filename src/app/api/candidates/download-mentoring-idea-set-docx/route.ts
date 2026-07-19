import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isAdminAppRole, mentorHasCandidateAccess } from "@/lib/mentor-access";
import { buildCandidateMentoringIdeaSetDocumentBuffer } from "@/lib/candidate-mentoring-idea-set-document";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const ideaSchema = z.object({
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
});

const payloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  competencyId: z.string().uuid(),
  ideas: z.array(ideaSchema).min(1),
});

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "development-ideas"
  );
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
        .from("role_competencies")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.competencyId)
        .maybeSingle(),
      admin
        .from("mentor_role_assignments")
        .select("candidate_id, role_id, mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
    ]);

    if (
      candidateResult.error ||
      roleResult.error ||
      competencyResult.error ||
      mentorAssignmentsResult.error
    ) {
      throw new ApiRouteError(
        candidateResult.error?.message ??
          roleResult.error?.message ??
          competencyResult.error?.message ??
          mentorAssignmentsResult.error?.message ??
          "Unable to load the mentoring idea set context.",
        500,
      );
    }

    if (!candidateResult.data || !roleResult.data || !competencyResult.data) {
      throw new ApiRouteError("Unable to locate the candidate, role, or competency.", 404);
    }

    const mentorHasAccess = mentorHasCandidateAccess({
      profileId: profile.id,
      candidateId: payload.candidateId,
      roleId: payload.roleId,
      mentorAssignments: mentorAssignmentsResult.data ?? [],
    });

    if (!isAdminAppRole(profile.role) && !mentorHasAccess) {
      throw new ApiRouteError(
        "You do not have access to download development idea documents for this candidate.",
        403,
      );
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);
    const buffer = await buildCandidateMentoringIdeaSetDocumentBuffer({
      candidateName: candidateResult.data.full_name,
      roleTitle,
      competencyName: competencyResult.data.name,
      ideas: payload.ideas,
    });

    const fileName = `${slugify(candidateResult.data.full_name)}-${slugify(competencyResult.data.name)}-development-ideas.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate the development ideas Word document.",
    );
  }
}
