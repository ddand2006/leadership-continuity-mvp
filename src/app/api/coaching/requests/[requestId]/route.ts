import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  coachingStatusSchema,
  isMissingCoachingRequestsTableError,
} from "@/lib/coaching-support";
import { isAdminAppRole, isMentorAppUser } from "@/lib/mentor-access";
import { sanitizeAppText } from "@/lib/text-sanitizer";

const updateCoachingRequestSchema = z.object({
  status: coachingStatusSchema,
  assignedCoachName: z.string().trim().max(250).optional().default(""),
  internalNotes: z.string().trim().max(6000).optional().default(""),
});

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/coaching/requests/[requestId]">,
) {
  try {
    const { admin, profile, account } = await requireApiWorkspaceProfile({
      product: "leadership_help",
    });
    const isReviewer = isAdminAppRole(profile.role) || isMentorAppUser(profile, account);

    if (!isReviewer) {
      throw new ApiRouteError(
        "Only admins and mentors can manage coaching requests.",
        403,
      );
    }

    const { requestId } = await context.params;
    const payload = updateCoachingRequestSchema.parse(await request.json());
    const updateResult = await admin
      .from("coaching_requests")
      .update({
        status: payload.status,
        assigned_coach_name: sanitizeAppText(payload.assignedCoachName) || null,
        internal_notes: sanitizeAppText(payload.internalNotes) || null,
        last_reviewed_by_profile_id: profile.id,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("organization_id", profile.organization_id)
      .eq("id", requestId)
      .select("id")
      .maybeSingle();

    if (updateResult.error) {
      if (isMissingCoachingRequestsTableError(updateResult.error)) {
        throw new ApiRouteError(
          "The coaching workspace tables are not installed yet.",
          503,
        );
      }

      throw new ApiRouteError(updateResult.error.message, 500);
    }

    if (!updateResult.data) {
      throw new ApiRouteError("That coaching request could not be found.", 404);
    }

    return NextResponse.json({
      message: "Coaching request updated.",
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update the coaching request.");
  }
}
