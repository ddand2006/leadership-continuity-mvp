import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  coachingChallengeAreaSchema,
  coachingSupportPathSchema,
  coachingUrgencySchema,
  generateLeadershipCoachingGuidance,
  getInitialCoachingStatus,
} from "@/lib/coaching-support";
import { hasOpenAIEnv } from "@/lib/env";
import { sanitizeAppText } from "@/lib/text-sanitizer";

const createCoachingRequestSchema = z.object({
  challengeArea: coachingChallengeAreaSchema,
  challengeTitle: z.string().trim().min(3, "Add a short title for the challenge."),
  challengeSummary: z
    .string()
    .trim()
    .min(20, "Describe the challenge in a little more detail."),
  organizationalContext: z.string().trim().max(4000).optional().default(""),
  desiredOutcome: z.string().trim().max(4000).optional().default(""),
  urgency: coachingUrgencySchema,
  supportPath: coachingSupportPathSchema,
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      product: "leadership_help",
    });
    const payload = createCoachingRequestSchema.parse(await request.json());
    const shouldGenerateGuidance =
      payload.supportPath === "ai_guidance" || payload.supportPath === "both";

    if (shouldGenerateGuidance && !hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY before generating AI coaching guidance.",
        400,
      );
    }

    const organizationResult = await admin
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (organizationResult.error) {
      throw new ApiRouteError(organizationResult.error.message, 500);
    }

    const guidance =
      shouldGenerateGuidance && organizationResult.data
        ? await generateLeadershipCoachingGuidance({
            organizationName: organizationResult.data.name,
            requesterName: profile.full_name,
            challengeArea: payload.challengeArea,
            challengeTitle: payload.challengeTitle,
            challengeSummary: payload.challengeSummary,
            organizationalContext: payload.organizationalContext || null,
            desiredOutcome: payload.desiredOutcome || null,
            urgency: payload.urgency,
            supportPath: payload.supportPath,
          })
        : {};

    const insertResult = await admin
      .from("coaching_requests")
      .insert({
        organization_id: profile.organization_id,
        requester_profile_id: profile.id,
        challenge_area: payload.challengeArea,
        challenge_title: sanitizeAppText(payload.challengeTitle),
        challenge_summary: sanitizeAppText(payload.challengeSummary),
        organizational_context: sanitizeAppText(payload.organizationalContext) || null,
        desired_outcome: sanitizeAppText(payload.desiredOutcome) || null,
        urgency: payload.urgency,
        support_path: payload.supportPath,
        status: getInitialCoachingStatus(payload.supportPath, shouldGenerateGuidance),
        ai_guidance: guidance,
        ai_generated_at: shouldGenerateGuidance ? new Date().toISOString() : null,
      })
      .select("id, status")
      .single();

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message:
        payload.supportPath === "coach_request"
          ? "Your coaching request was submitted."
          : payload.supportPath === "both"
            ? "Your AI guidance and coach request are ready."
            : "Your AI guidance is ready.",
      requestId: insertResult.data.id,
      status: insertResult.data.status,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to create the coaching request.");
  }
}
