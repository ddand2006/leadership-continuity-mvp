import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { hasResendEnv } from "@/lib/env";
import { isMissingRoleSurveyTablesError } from "@/lib/role-competency-surveys";
import { buildRoleSurveyInviteEmail } from "@/lib/role-survey-email";
import { ResendSendError, sendResendEmail } from "@/lib/resend";

type RouteContext = {
  params: Promise<{
    recipientId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    if (!hasResendEnv()) {
      throw new ApiRouteError(
        "Configure RESEND_API_KEY and RESEND_FROM_EMAIL before sending survey emails.",
        503,
      );
    }

    const { recipientId } = await context.params;
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const recipientResult = await admin
      .from("role_survey_recipients")
      .select(
        "id, organization_id, survey_id, recipient_name, recipient_email, access_token",
      )
      .eq("organization_id", profile.organization_id)
      .eq("id", recipientId)
      .maybeSingle();

    if (recipientResult.error) {
      if (isMissingRoleSurveyTablesError(recipientResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before sending survey emails.",
          400,
        );
      }

      throw new ApiRouteError(recipientResult.error.message, 500);
    }

    if (!recipientResult.data) {
      throw new ApiRouteError("The selected survey recipient could not be found.", 404);
    }

    const surveyResult = await admin
      .from("role_surveys")
      .select("id, role_id, title, intro_message, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", recipientResult.data.survey_id)
      .maybeSingle();

    if (surveyResult.error) {
      if (isMissingRoleSurveyTablesError(surveyResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before sending survey emails.",
          400,
        );
      }

      throw new ApiRouteError(surveyResult.error.message, 500);
    }

    if (!surveyResult.data) {
      throw new ApiRouteError("The selected survey could not be found.", 404);
    }

    if (surveyResult.data.status !== "active") {
      throw new ApiRouteError(
        "Activate the survey before emailing recipients so the link can accept responses.",
        409,
      );
    }

    const roleResult = await admin
      .from("roles")
      .select("title")
      .eq("organization_id", profile.organization_id)
      .eq("id", surveyResult.data.role_id)
      .maybeSingle();

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }

    const email = buildRoleSurveyInviteEmail({
      recipientName: recipientResult.data.recipient_name,
      survey: surveyResult.data,
      roleTitle: roleResult.data?.title ?? "this role",
      surveyToken: recipientResult.data.access_token,
    });

    try {
      await sendResendEmail({
        to: recipientResult.data.recipient_email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: `role-survey-${recipientResult.data.id}-${Date.now()}`,
        tags: [
          {
            name: "email_type",
            value: "role_survey_invite",
          },
          {
            name: "survey_id",
            value: surveyResult.data.id,
          },
          {
            name: "recipient_id",
            value: recipientResult.data.id,
          },
        ],
      });
    } catch (error) {
      if (error instanceof ResendSendError) {
        throw new ApiRouteError(error.message, 502);
      }

      throw error;
    }

    return NextResponse.json({
      message: `Survey email sent to ${recipientResult.data.recipient_email}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to send the survey email.");
  }
}
