import Link from "next/link";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { RoleSurveyPanel } from "@/components/role-survey-panel";
import { PersonalCompetencySurveyPanel } from "@/components/personal-competency-survey-panel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasResendEnv } from "@/lib/env";
import {
  loadPersonalDevelopmentConnectedRoleSurveyData,
  loadPersonalDevelopmentWorkspaceData,
} from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentSurveyPage() {
  const workspace = await loadPersonalDevelopmentWorkspaceData();
  const isEmailDeliveryEnabled = hasResendEnv();
  const connectedRoleId =
    workspace.roleProfile?.role_mode === "organization_role"
      ? workspace.roleProfile.source_role_id
      : null;
  const surveyData =
    connectedRoleId && workspace.migrationReady
      ? await loadPersonalDevelopmentConnectedRoleSurveyData(connectedRoleId)
      : null;
  const admin = createSupabaseAdminClient();
  const personalSurveyResult =
    workspace.personalProfile && workspace.roleProfile?.role_mode === "personal_role"
      ? await admin
          .from("personal_competency_surveys")
          .select("id, title, intro_message, thank_you_message, status, created_at")
          .eq("organization_id", workspace.profile.organization_id)
          .eq("personal_development_profile_id", workspace.personalProfile.id)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  const personalSurveyIds = (personalSurveyResult.data ?? []).map((survey) => survey.id);
  const [personalRecipientsResult, personalResponsesResult] =
    personalSurveyIds.length > 0
      ? await Promise.all([
          admin.from("personal_competency_survey_recipients").select("id, survey_id, recipient_name, recipient_email, access_token, status").in("survey_id", personalSurveyIds),
          admin.from("personal_competency_survey_responses").select("id").in("survey_id", personalSurveyIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  const totalResponses = surveyData?.responses.length ?? 0;
  const detailItems = [
    `Role profile: ${workspace.roleProfile?.title ?? "Not started"}`,
    `Survey access: ${
      connectedRoleId
        ? surveyData?.canManageSurvey
          ? "Ready for survey management"
          : "Admin-managed"
        : "Needs organizational role"
    }`,
    `Surveys on file: ${surveyData?.surveys.length ?? 0}`,
    `Responses collected: ${totalResponses}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="survey"
        />

        {!workspace.migrationReady ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase">
              Personal Development Migration
            </p>
            <h2 className="mt-3 font-display text-3xl">
              Apply the Personal Development foundation migration first
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7">
              The Personal Development tables need to be available before this
              workspace can connect a role profile to the survey engine.
            </p>
          </section>
        ) : !workspace.roleProfile ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Competency Survey
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Save your role profile before opening the survey workflow
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              The competency survey needs a saved role context first so it knows
              what role people should be describing.
            </p>
            <div className="mt-6">
              <Link
                href="/personal-development/role"
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Role Profile
              </Link>
            </div>
          </section>
        ) : workspace.roleProfile.role_mode !== "organization_role" ||
          !workspace.roleProfile.source_role_id ? (
          <PersonalCompetencySurveyPanel
            roleTitle={workspace.roleProfile.title}
            surveys={(personalSurveyResult.data ?? []) as never[]}
            recipients={(personalRecipientsResult.data ?? []) as never[]}
            responseCount={personalResponsesResult.data?.length ?? 0}
          />
        ) : surveyData && !surveyData.migrationReady ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase">
              Competency Survey
            </p>
            <h2 className="mt-3 font-display text-3xl">
              Apply the role survey migration before managing surveys
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7">
              The connected organizational role is ready, but the role survey
              tables are still missing for this environment.
            </p>
          </section>
        ) : surveyData && !surveyData.canManageSurvey ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Competency Survey
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Survey management is currently admin-only
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This Personal Development workspace is connected to{" "}
              {workspace.roleProfile.title}, but creating surveys and adding
              recipients still uses the admin-managed role survey workflow. An
              organization admin can launch the survey for this role here or from
              the main Roles workspace.
            </p>
          </section>
        ) : surveyData ? (
          <RoleSurveyPanel
            roles={[
              {
                id: workspace.roleProfile.source_role_id!,
                title: workspace.roleProfile.title,
                department: workspace.roleProfile.department,
              },
            ]}
            surveys={surveyData.surveys}
            recipients={surveyData.recipients}
            responses={surveyData.responses}
            initialSelectedRoleId={workspace.roleProfile.source_role_id}
            isEmailDeliveryEnabled={isEmailDeliveryEnabled}
          />
        ) : null}
      </div>
    </main>
  );
}
