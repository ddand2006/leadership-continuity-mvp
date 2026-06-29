import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { buildCandidateMentoringIdeaDocumentBuffer } from "@/lib/candidate-mentoring-idea-document";

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

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mentoring-project"
  );
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [candidateResult, roleResult, competencyResult] = await Promise.all([
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
    ]);

    if (candidateResult.error || roleResult.error || competencyResult.error) {
      throw new ApiRouteError(
        candidateResult.error?.message ??
          roleResult.error?.message ??
          competencyResult.error?.message ??
          "Unable to load the mentoring project context.",
        500,
      );
    }

    if (!candidateResult.data || !roleResult.data || !competencyResult.data) {
      throw new ApiRouteError("Unable to locate the candidate, role, or competency.", 404);
    }

    const buffer = await buildCandidateMentoringIdeaDocumentBuffer({
      candidateName: candidateResult.data.full_name,
      roleTitle: roleResult.data.title,
      competencyName: competencyResult.data.name,
      idea: payload.idea,
    });
    const fileName = `${slugify(candidateResult.data.full_name)}-${slugify(payload.idea.title)}.docx`;

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
      "Unable to generate the mentoring project Word document.",
    );
  }
}
