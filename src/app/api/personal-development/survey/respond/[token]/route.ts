import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractRoleSurveyNormalizedCompetencies,
  parseRoleSurveyResponsePayload,
  roleSurveyResponsePayloadSchema,
} from "@/lib/role-competency-surveys";

type Context = { params: Promise<{ token: string }> };

async function load(token: string) {
  const admin = createSupabaseAdminClient();
  const recipient = await admin
    .from("personal_competency_survey_recipients")
    .select("id, organization_id, survey_id, status, opened_at, completed_at")
    .eq("access_token", token)
    .maybeSingle();
  if (recipient.error || !recipient.data) return { admin, error: NextResponse.json({ error: "Survey link not found." }, { status: 404 }) };
  const survey = await admin.from("personal_competency_surveys").select("id, status").eq("id", recipient.data.survey_id).maybeSingle();
  if (survey.error || !survey.data) return { admin, error: NextResponse.json({ error: "This survey is no longer available." }, { status: 404 }) };
  return { admin, recipient: recipient.data, survey: survey.data };
}

export async function PATCH(_request: Request, context: Context) {
  const loaded = await load((await context.params).token);
  if ("error" in loaded) return loaded.error;
  if (loaded.survey.status === "active" && loaded.recipient.status === "pending") {
    await loaded.admin.from("personal_competency_survey_recipients").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", loaded.recipient.id);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: Context) {
  const loaded = await load((await context.params).token);
  if ("error" in loaded) return loaded.error;
  if (loaded.survey.status !== "active") return NextResponse.json({ error: "This survey is not accepting responses right now." }, { status: 409 });
  if (loaded.recipient.status === "completed") return NextResponse.json({ error: "This response has already been submitted." }, { status: 409 });
  const payload = parseRoleSurveyResponsePayload(await request.json());
  if (!payload) return NextResponse.json({ error: "Please answer each survey question before submitting." }, { status: 400 });
  const now = new Date().toISOString();
  const response = await loaded.admin.from("personal_competency_survey_responses").upsert({ organization_id: loaded.recipient.organization_id, survey_id: loaded.recipient.survey_id, recipient_id: loaded.recipient.id, response_json: roleSurveyResponsePayloadSchema.parse(payload), normalized_competencies: extractRoleSurveyNormalizedCompetencies(payload), submitted_at: now }, { onConflict: "recipient_id" });
  if (response.error) return NextResponse.json({ error: response.error.message }, { status: 500 });
  await loaded.admin.from("personal_competency_survey_recipients").update({ status: "completed", completed_at: now, opened_at: loaded.recipient.opened_at ?? now }).eq("id", loaded.recipient.id);
  return NextResponse.json({ message: "Your survey response was submitted." });
}
