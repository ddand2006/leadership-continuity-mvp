import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RoleSurveyResponseForm } from "@/components/role-survey-response-form";
import { isMissingRoleSurveyTablesError } from "@/lib/role-competency-surveys";

type RoleSurveyPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function RoleSurveyPage({ params }: RoleSurveyPageProps) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const recipientResult = await admin
    .from("role_survey_recipients")
    .select(
      "id, survey_id, recipient_name, recipient_email, recipient_title, relationship_to_role, status, completed_at",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (recipientResult.error) {
    if (isMissingRoleSurveyTablesError(recipientResult.error)) {
      return (
        <main className="app-page">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
            <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-sm font-semibold tracking-[0.16em] uppercase">
                Role Competency Survey
              </p>
              <h1 className="mt-3 font-display text-4xl">
                The survey database migration still needs to be applied
              </h1>
            </section>
          </div>
        </main>
      );
    }

    throw new Error(recipientResult.error.message);
  }

  if (!recipientResult.data) {
    return (
      <main className="app-page">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Role Competency Survey
            </p>
            <h1 className="mt-3 font-display text-4xl">
              This survey link is not available
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Double-check the link or ask the sender to generate a new survey
              invitation.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const surveyResult = await admin
    .from("role_surveys")
    .select("id, role_id, title, intro_message, thank_you_message, status")
    .eq("id", recipientResult.data.survey_id)
    .maybeSingle();

  if (surveyResult.error) {
    throw new Error(surveyResult.error.message);
  }

  if (!surveyResult.data) {
    return (
      <main className="app-page">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h1 className="font-display text-4xl">This survey is no longer available</h1>
          </section>
        </div>
      </main>
    );
  }

  const roleResult = await admin
    .from("roles")
    .select("title, department")
    .eq("id", surveyResult.data.role_id)
    .maybeSingle();

  if (roleResult.error) {
    throw new Error(roleResult.error.message);
  }

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        {roleResult.data?.department ? (
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {roleResult.data.department}
          </div>
        ) : null}
        <RoleSurveyResponseForm
          token={token}
          recipientName={recipientResult.data.recipient_name}
          surveyTitle={surveyResult.data.title}
          roleTitle={roleResult.data?.title ?? "this role"}
          introMessage={surveyResult.data.intro_message}
          thankYouMessage={surveyResult.data.thank_you_message}
          surveyStatus={surveyResult.data.status as "draft" | "active" | "closed"}
          recipientStatus={
            recipientResult.data.status as "pending" | "opened" | "completed"
          }
          completedAt={recipientResult.data.completed_at}
        />
      </div>
    </main>
  );
}
