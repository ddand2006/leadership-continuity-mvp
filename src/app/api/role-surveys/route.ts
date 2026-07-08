import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  roleSurveyStatusSchema,
  isMissingRoleSurveyTablesError,
} from "@/lib/role-competency-surveys";
import { sanitizeAppText } from "@/lib/text-sanitizer";

const upsertRoleSurveySchema = z.object({
  surveyId: z.string().uuid().optional(),
  roleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional().default(""),
  introMessage: z.string().trim().max(6000).optional().default(""),
  thankYouMessage: z.string().trim().max(3000).optional().default(""),
  status: roleSurveyStatusSchema,
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = upsertRoleSurveySchema.parse(await request.json());
    const roleResult = await admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", profile.organization_id)
      .eq("id", payload.roleId)
      .maybeSingle();

    if (roleResult.error) {
      if (isMissingRoleSurveyTablesError(roleResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before managing surveys.",
          400,
        );
      }

      throw new ApiRouteError(roleResult.error.message, 500);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("The selected role could not be found.", 404);
    }

    const now = new Date().toISOString();
    let existingSurvey:
      | {
          id: string;
          status: z.infer<typeof roleSurveyStatusSchema>;
          launched_at: string | null;
        }
      | null = null;

    if (payload.surveyId) {
      const existingSurveyResult = await admin
        .from("role_surveys")
        .select("id, status, launched_at")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.surveyId)
        .maybeSingle();

      if (existingSurveyResult.error) {
        if (isMissingRoleSurveyTablesError(existingSurveyResult.error)) {
          throw new ApiRouteError(
            "Apply the role survey migration before managing surveys.",
            400,
          );
        }

        throw new ApiRouteError(existingSurveyResult.error.message, 500);
      }

      if (!existingSurveyResult.data) {
        throw new ApiRouteError("The selected survey could not be found.", 404);
      }

      existingSurvey = existingSurveyResult.data;
    }

    const nextLaunchedAt =
      payload.status === "active"
        ? existingSurvey?.launched_at ?? now
        : existingSurvey?.launched_at ?? null;
    const nextClosedAt = payload.status === "closed" ? now : null;

    if (existingSurvey) {
      const updateResult = await admin
        .from("role_surveys")
        .update({
          title: sanitizeAppText(payload.title),
          description: sanitizeAppText(payload.description) || null,
          intro_message: sanitizeAppText(payload.introMessage) || null,
          thank_you_message: sanitizeAppText(payload.thankYouMessage) || null,
          status: payload.status,
          launched_at: nextLaunchedAt,
          closed_at: nextClosedAt,
          updated_by_profile_id: profile.id,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.surveyId)
        .select("id")
        .single();

      if (updateResult.error) {
        if (isMissingRoleSurveyTablesError(updateResult.error)) {
          throw new ApiRouteError(
            "Apply the role survey migration before managing surveys.",
            400,
          );
        }

        throw new ApiRouteError(updateResult.error.message, 500);
      }

      return NextResponse.json({
        message: `Survey updated for ${roleResult.data.title}.`,
        surveyId: updateResult.data.id,
      });
    }

    const insertResult = await admin
      .from("role_surveys")
      .insert({
        organization_id: profile.organization_id,
        role_id: payload.roleId,
        title: sanitizeAppText(payload.title),
        description: sanitizeAppText(payload.description) || null,
        intro_message: sanitizeAppText(payload.introMessage) || null,
        thank_you_message: sanitizeAppText(payload.thankYouMessage) || null,
        status: payload.status,
        launched_at: nextLaunchedAt,
        closed_at: nextClosedAt,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      if (isMissingRoleSurveyTablesError(insertResult.error)) {
        throw new ApiRouteError(
          "Apply the role survey migration before managing surveys.",
          400,
        );
      }

      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Survey created for ${roleResult.data.title}.`,
      surveyId: insertResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to save the role survey.");
  }
}
