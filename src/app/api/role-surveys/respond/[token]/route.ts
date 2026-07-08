import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractRoleSurveyNormalizedCompetencies,
  isMissingRoleSurveyTablesError,
  parseRoleSurveyResponsePayload,
  roleSurveyResponsePayloadSchema,
} from "@/lib/role-competency-surveys";

type TokenRouteContext = {
  params: Promise<{
    token: string;
  }>;
};

async function loadRecipientByToken(token: string) {
  const admin = createSupabaseAdminClient();
  const recipientResult = await admin
    .from("role_survey_recipients")
    .select("id, organization_id, survey_id, status, opened_at, completed_at")
    .eq("access_token", token)
    .maybeSingle();

  if (recipientResult.error) {
    if (isMissingRoleSurveyTablesError(recipientResult.error)) {
      return {
        admin,
        error: NextResponse.json(
          { error: "Apply the role survey migration before using survey links." },
          { status: 400 },
        ),
      };
    }

    return {
      admin,
      error: NextResponse.json(
        { error: recipientResult.error.message },
        { status: 500 },
      ),
    };
  }

  if (!recipientResult.data) {
    return {
      admin,
      error: NextResponse.json({ error: "Survey link not found." }, { status: 404 }),
    };
  }

  const surveyResult = await admin
    .from("role_surveys")
    .select("id, status")
    .eq("id", recipientResult.data.survey_id)
    .maybeSingle();

  if (surveyResult.error) {
    if (isMissingRoleSurveyTablesError(surveyResult.error)) {
      return {
        admin,
        error: NextResponse.json(
          { error: "Apply the role survey migration before using survey links." },
          { status: 400 },
        ),
      };
    }

    return {
      admin,
      error: NextResponse.json(
        { error: surveyResult.error.message },
        { status: 500 },
      ),
    };
  }

  if (!surveyResult.data) {
    return {
      admin,
      error: NextResponse.json({ error: "This survey is no longer available." }, { status: 404 }),
    };
  }

  return {
    admin,
    recipient: recipientResult.data,
    survey: surveyResult.data,
  };
}

export async function PATCH(_request: Request, context: TokenRouteContext) {
  const { token } = await context.params;
  const loaded = await loadRecipientByToken(token);

  if ("error" in loaded) {
    return loaded.error;
  }

  if (loaded.survey.status !== "active") {
    return NextResponse.json({ ok: true });
  }

  if (loaded.recipient.status === "pending") {
    const now = new Date().toISOString();
    await loaded.admin
      .from("role_survey_recipients")
      .update({
        status: "opened",
        opened_at: loaded.recipient.opened_at ?? now,
      })
      .eq("id", loaded.recipient.id);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: TokenRouteContext) {
  const { token } = await context.params;
  const loaded = await loadRecipientByToken(token);

  if ("error" in loaded) {
    return loaded.error;
  }

  if (loaded.survey.status !== "active") {
    return NextResponse.json(
      { error: "This survey is not accepting responses right now." },
      { status: 409 },
    );
  }

  if (loaded.recipient.status === "completed") {
    return NextResponse.json(
      { error: "This survey response has already been submitted." },
      { status: 409 },
    );
  }

  const payload = parseRoleSurveyResponsePayload(await request.json());

  if (!payload) {
    return NextResponse.json(
      {
        error:
          "Please answer each survey question before submitting your response.",
      },
      { status: 400 },
    );
  }

  const normalizedCompetencies =
    extractRoleSurveyNormalizedCompetencies(payload);
  const now = new Date().toISOString();
  const upsertResult = await loaded.admin
    .from("role_survey_responses")
    .upsert(
      {
        organization_id: loaded.recipient.organization_id,
        survey_id: loaded.recipient.survey_id,
        recipient_id: loaded.recipient.id,
        response_json: roleSurveyResponsePayloadSchema.parse(payload),
        normalized_competencies: normalizedCompetencies,
        submitted_at: now,
      },
      { onConflict: "recipient_id" },
    )
    .select("id")
    .single();

  if (upsertResult.error) {
    if (isMissingRoleSurveyTablesError(upsertResult.error)) {
      return NextResponse.json(
        { error: "Apply the role survey migration before collecting responses." },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: upsertResult.error.message }, { status: 500 });
  }

  const recipientUpdateResult = await loaded.admin
    .from("role_survey_recipients")
    .update({
      status: "completed",
      opened_at: loaded.recipient.opened_at ?? now,
      completed_at: now,
    })
    .eq("id", loaded.recipient.id);

  if (recipientUpdateResult.error) {
    if (isMissingRoleSurveyTablesError(recipientUpdateResult.error)) {
      return NextResponse.json(
        { error: "Apply the role survey migration before collecting responses." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: recipientUpdateResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "Your survey response was submitted.",
  });
}
