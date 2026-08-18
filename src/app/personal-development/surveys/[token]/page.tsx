import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RoleSurveyResponseForm } from "@/components/role-survey-response-form";
import { getOrganizationAccessStatus } from "@/lib/organization-access";

export default async function PersonalSurveyResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const admin = createSupabaseAdminClient();
  const recipient = await admin.from("personal_competency_survey_recipients").select("id, survey_id, recipient_name, status, completed_at").eq("access_token", token).maybeSingle();
  const survey = recipient.data ? await admin.from("personal_competency_surveys").select("id, organization_id, title, intro_message, thank_you_message, status, personal_role_profile_id").eq("id", recipient.data.survey_id).maybeSingle() : null;
  const role = survey?.data ? await admin.from("personal_role_profiles").select("title").eq("id", survey.data.personal_role_profile_id).maybeSingle() : null;
  if (!recipient.data || !survey?.data) return <main className="app-page"><div className="mx-auto max-w-[980px] px-6 py-12"><section className="rounded-[1.75rem] border border-slate-200 bg-white p-8"><h1 className="font-display text-4xl">This survey link is not available</h1></section></div></main>;
  if (await getOrganizationAccessStatus(survey.data.organization_id) === "payment_hold") return <main className="app-page"><div className="mx-auto max-w-[980px] px-6 py-12"><section className="rounded-[1.75rem] border border-slate-200 bg-white p-8"><h1 className="font-display text-4xl">This survey is temporarily unavailable</h1></section></div></main>;
  return <main className="app-page"><div className="mx-auto max-w-[980px] px-6 py-12"><RoleSurveyResponseForm token={token} recipientName={recipient.data.recipient_name} surveyTitle={survey.data.title} roleTitle={role?.data?.title ?? "this role"} introMessage={survey.data.intro_message} thankYouMessage={survey.data.thank_you_message} surveyStatus={survey.data.status as "draft"|"active"|"closed"} recipientStatus={recipient.data.status as "pending"|"opened"|"completed"} completedAt={recipient.data.completed_at} responseEndpoint={`/api/personal-development/survey/respond/${token}`} surveyLabel="Personal Competency Survey" /></div></main>;
}
