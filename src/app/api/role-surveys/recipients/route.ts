import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { normalizeEmail } from "@/lib/organization-users";
import { isMissingRoleSurveyTablesError } from "@/lib/role-competency-surveys";
import { sanitizeAppText } from "@/lib/text-sanitizer";

const createRecipientSchema = z.object({
  surveyId: z.string().uuid(),
  recipientName: z.string().trim().min(2).max(160),
  recipientEmail: z.string().trim().email().max(320),
  recipientTitle: z.string().trim().max(160).optional().default(""),
  relationshipToRole: z.string().trim().max(240).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = createRecipientSchema.parse(await request.json());
    const surveyResult = await admin
      .from("role_surveys")
      .select("id, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", payload.surveyId)
      .maybeSingle();

    if (surveyResult.error) {
      if (isMissingRoleSurveyTablesError(surveyResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before adding recipients.",
          400,
        );
      }

      throw new ApiRouteError(surveyResult.error.message, 500);
    }

    if (!surveyResult.data) {
      throw new ApiRouteError("The selected survey could not be found.", 404);
    }

    if (surveyResult.data.status === "closed") {
      throw new ApiRouteError(
        "This survey is closed. Reopen it before adding recipients.",
        409,
      );
    }

    const normalizedEmail = normalizeEmail(payload.recipientEmail);
    const existingRecipientResult = await admin
      .from("role_survey_recipients")
      .select("id, access_token")
      .eq("survey_id", payload.surveyId)
      .ilike("recipient_email", normalizedEmail)
      .maybeSingle();

    if (existingRecipientResult.error) {
      if (isMissingRoleSurveyTablesError(existingRecipientResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before adding recipients.",
          400,
        );
      }

      throw new ApiRouteError(existingRecipientResult.error.message, 500);
    }

    if (existingRecipientResult.data) {
      return NextResponse.json({
        message: "That recipient is already on this survey.",
        recipientId: existingRecipientResult.data.id,
      });
    }

    const now = new Date().toISOString();
    const insertResult = await admin
      .from("role_survey_recipients")
      .insert({
        organization_id: profile.organization_id,
        survey_id: payload.surveyId,
        recipient_name: sanitizeAppText(payload.recipientName),
        recipient_email: normalizedEmail,
        recipient_title: sanitizeAppText(payload.recipientTitle) || null,
        relationship_to_role: sanitizeAppText(payload.relationshipToRole) || null,
        invited_by_profile_id: profile.id,
        invited_at: now,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      if (isMissingRoleSurveyTablesError(insertResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before adding recipients.",
          400,
        );
      }

      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message: "Recipient added. You can now send or copy the survey link.",
      recipientId: insertResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to add the survey recipient.");
  }
}
