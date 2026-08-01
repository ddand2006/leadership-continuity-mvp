import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";

type RouteContext = { params: Promise<{ candidateId: string }> };

const workflowStateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("match"),
    roleId: z.string().uuid(),
    matchStatus: z.enum(["match", "not_yet", "not_recommended"]),
    readinessScore: z.number().min(0).max(100).nullable(),
    notes: z.string().trim().max(2_000).optional(),
  }),
  z.object({
    kind: z.literal("decision"),
    roleId: z.string().uuid(),
    decision: z.enum(["hire", "continue_mentoring", "decline"]),
    notes: z.string().trim().max(2_000).optional(),
  }),
]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const { candidateId } = await context.params;
    const payload = workflowStateSchema.parse(await request.json());

    const considerationResult = await admin
      .from("candidate_role_considerations")
      .select("candidate_id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("role_id", payload.roleId)
      .maybeSingle();

    if (considerationResult.error) {
      throw new ApiRouteError(considerationResult.error.message, 500);
    }
    if (!considerationResult.data) {
      throw new ApiRouteError("Attach this role to the candidate before recording workflow state.", 409);
    }

    if (payload.kind === "match") {
      const result = await admin.from("candidate_role_matches").insert({
        organization_id: profile.organization_id,
        candidate_id: candidateId,
        role_id: payload.roleId,
        match_status: payload.matchStatus,
        readiness_score: payload.readinessScore,
        decision_notes: payload.notes || null,
        recorded_by_profile_id: profile.id,
      });
      if (result.error) throw new ApiRouteError(result.error.message, 500);
      return NextResponse.json({ message: "Role-match snapshot recorded." });
    }

    const result = await admin.from("hiring_decisions").insert({
      organization_id: profile.organization_id,
      candidate_id: candidateId,
      role_id: payload.roleId,
      decision: payload.decision,
      decision_notes: payload.notes || null,
      decided_by_profile_id: profile.id,
    });
    if (result.error) throw new ApiRouteError(result.error.message, 500);
    return NextResponse.json({ message: "Leadership decision recorded." });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to record candidate workflow state.");
  }
}
