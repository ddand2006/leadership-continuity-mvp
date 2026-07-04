import Link from "next/link";
import { MentorFlowPanel } from "@/components/mentor-flow-panel";
import { MentoringCrossDepartmentalProjectWorksheetManager } from "@/components/mentoring-cross-departmental-project-worksheet-manager";
import { MentoringDepartmentalProjectWorksheetManager } from "@/components/mentoring-departmental-project-worksheet-manager";
import { MentorAssignmentManager } from "@/components/mentor-assignment-manager";
import { MentoringPreparationWorksheetManager } from "@/components/mentoring-preparation-worksheet-manager";
import { LeadershipDevelopmentRecordManager } from "@/components/leadership-development-record-manager";
import { MentoringWorkspaceMenu } from "@/components/mentoring-workspace-menu";
import { isMissingCrossDepartmentalProjectWorksheetTableError } from "@/lib/mentoring-cross-departmental-project-worksheet";
import { isMissingDepartmentalProjectWorksheetTableError } from "@/lib/mentoring-departmental-project-worksheet";
import { isAdminAppRole } from "@/lib/mentor-access";
import { isMissingPreparationWorksheetTableError } from "@/lib/mentoring-preparation-worksheet";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type MentoringPageProps = {
  searchParams: Promise<{
    section?: string;
    candidateId?: string;
    roleId?: string;
    mentorProfileId?: string;
  }>;
};

function getAssignmentKey(option: {
  candidate_id: string;
  role_id: string;
  mentor_profile_id: string;
}) {
  return `${option.candidate_id}:${option.role_id}:${option.mentor_profile_id}`;
}

export default async function MentoringPage({
  searchParams,
}: MentoringPageProps) {
  const {
    candidateId: requestedCandidateId,
    mentorProfileId: requestedMentorProfileId,
    roleId: requestedRoleId,
    section: requestedSection,
  } = await searchParams;
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  const [
    candidatesResult,
    reportsResult,
    rolesResult,
    mentorsResult,
    mentorAssignmentsResult,
    roleMentorAssignmentsResult,
    preparationWorksheetsResult,
    departmentalProjectWorksheetsResult,
    crossDepartmentalProjectWorksheetsResult,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, current_title, status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("mentor_reports")
      .select("id, candidate_id, role_id, created_at")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("roles")
      .select("id, title, department")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", profile.organization_id)
      .eq("role", "mentor")
      .order("created_at", { ascending: true }),
    supabase
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id, status, start_date, notes")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("role_mentor_assignments")
      .select("role_id, mentor_profile_id, status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("mentoring_preparation_worksheets")
      .select(
        "id, candidate_id, role_id, mentor_profile_id, status, worksheet_date, critical_competencies, mentee_least_prepared, mentee_strongest_area, strengths_help, strengths_distraction_plan, shared_development_focus, desired_improvement, mentor_support_needed, communication_expectations, initial_development_focus, mentor_guidance_notes, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("worksheet_type", "mentor_mentee_preparation")
      .order("updated_at", { ascending: false }),
    supabase
      .from("mentoring_departmental_project_worksheets")
      .select(
        "id, candidate_id, role_id, mentor_profile_id, status, project_timeline, department_need, project_title, project_objective, project_importance, responsible_outcomes, collaborators, leadership_actions_required, leadership_actions_other, competencies_developed, mentor_anticipated_difficulty, mentor_stretch_competencies, mentee_anticipated_difficulty, challenge_process_with_mentor, coaching_areas, figuring_things_out_process, help_threshold, success_measures, post_project_leader_wins, post_project_do_differently, post_project_feedback_received, mentor_evaluation_competencies_developed, strengths_observed, future_development_areas, readiness_signal, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("mentoring_cross_departmental_project_worksheets")
      .select(
        "id, candidate_id, role_id, mentor_profile_id, status, worksheet_date, department_conversations, cross_department_challenge, project_title, project_objective, project_partners, project_timeline, project_learning_goal, shared_themes, alignment_risks, biggest_surprise, leadership_shift, critical_behaviors, hospital_insights, action_commitments, mentor_observed_qualities, mentor_comments, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false }),
  ]);

  for (const result of [
    candidatesResult,
    reportsResult,
    rolesResult,
    mentorsResult,
    mentorAssignmentsResult,
    roleMentorAssignmentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const roleMap = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
  const candidateMap = new Map(
    (candidatesResult.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const mentorMap = new Map(
    (mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const candidateRolePairsWithReports = new Set(
    (reportsResult.data ?? []).map((report) => `${report.candidate_id}:${report.role_id}`),
  );

  const visibleAssignments = isAdminAppRole(profile.role)
    ? mentorAssignmentsResult.data ?? []
    : (mentorAssignmentsResult.data ?? []).filter(
        (assignment) => assignment.mentor_profile_id === profile.id,
      );
  const visibleRoleOptions = isAdminAppRole(profile.role)
    ? rolesResult.data ?? []
    : (rolesResult.data ?? []).filter((role) =>
        (roleMentorAssignmentsResult.data ?? []).some(
          (assignment) =>
            assignment.role_id === role.id &&
            assignment.mentor_profile_id === profile.id &&
            assignment.status === "active",
        ),
      );
  const visibleMentorOptions = isAdminAppRole(profile.role)
    ? mentorsResult.data ?? []
    : (mentorsResult.data ?? []).filter((mentor) => mentor.id === profile.id);
  const selectedSectionId =
    requestedSection === "mentor-assignments" ||
    requestedSection === "preparation-worksheet" ||
    requestedSection === "leadership-development-record" ||
    requestedSection === "departmental-project" ||
    requestedSection === "cross-departmental-project" ||
    requestedSection === "readiness-review" ||
    requestedSection === "overview"
      ? requestedSection
      : "overview";
  const requestedAssignmentKey =
    requestedCandidateId && requestedRoleId && requestedMentorProfileId
      ? `${requestedCandidateId}:${requestedRoleId}:${requestedMentorProfileId}`
      : null;
  const worksheetStorageReady = !isMissingPreparationWorksheetTableError(
    preparationWorksheetsResult.error,
  );

  if (preparationWorksheetsResult.error && worksheetStorageReady) {
    throw new Error(preparationWorksheetsResult.error.message);
  }
  const departmentalProjectStorageReady =
    !isMissingDepartmentalProjectWorksheetTableError(
      departmentalProjectWorksheetsResult.error,
    );

  if (
    departmentalProjectWorksheetsResult.error &&
    departmentalProjectStorageReady
  ) {
    throw new Error(departmentalProjectWorksheetsResult.error.message);
  }
  const crossDepartmentalProjectStorageReady =
    !isMissingCrossDepartmentalProjectWorksheetTableError(
      crossDepartmentalProjectWorksheetsResult.error,
    );

  if (
    crossDepartmentalProjectWorksheetsResult.error &&
    crossDepartmentalProjectStorageReady
  ) {
    throw new Error(crossDepartmentalProjectWorksheetsResult.error.message);
  }

  const visibleAssignmentsWithWorksheet = visibleAssignments.map((assignment) => {
    const worksheet =
      (preparationWorksheetsResult.data ?? []).find(
        (item) =>
          item.candidate_id === assignment.candidate_id &&
          item.role_id === assignment.role_id &&
          item.mentor_profile_id === assignment.mentor_profile_id,
      ) ?? null;

    return {
      candidateId: assignment.candidate_id,
      roleId: assignment.role_id,
      mentorProfileId: assignment.mentor_profile_id,
      candidateName:
        candidateMap.get(assignment.candidate_id)?.full_name ?? "Unknown candidate",
      currentTitle:
        candidateMap.get(assignment.candidate_id)?.current_title ?? null,
      roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
      departmentName: roleMap.get(assignment.role_id)?.department ?? null,
      mentorName:
        mentorMap.get(assignment.mentor_profile_id)?.full_name ?? "Unknown mentor",
      mentorPositionTitle:
        mentorMap.get(assignment.mentor_profile_id)?.position_title ?? null,
      startDate: assignment.start_date,
      worksheet: worksheet
        ? {
            id: worksheet.id,
            candidateId: worksheet.candidate_id,
            roleId: worksheet.role_id,
            mentorProfileId: worksheet.mentor_profile_id,
            status:
              worksheet.status === "completed"
                ? ("completed" as const)
                : ("draft" as const),
            worksheetDate: worksheet.worksheet_date ?? "",
            criticalCompetencies: Array.isArray(worksheet.critical_competencies)
              ? worksheet.critical_competencies.map((item) => ({
                  whatMustDo:
                    typeof item?.whatMustDo === "string" ? item.whatMustDo : "",
                  whyCritical:
                    typeof item?.whyCritical === "string" ? item.whyCritical : "",
                  successLooksLike:
                    typeof item?.successLooksLike === "string"
                      ? item.successLooksLike
                      : "",
                  failureLooksLike:
                    typeof item?.failureLooksLike === "string"
                      ? item.failureLooksLike
                      : "",
                  priorityRank:
                    typeof item?.priorityRank === "string" ? item.priorityRank : "",
                }))
              : [],
            menteeLeastPrepared: worksheet.mentee_least_prepared ?? "",
            menteeStrongestArea: worksheet.mentee_strongest_area ?? "",
            strengthsHelp: worksheet.strengths_help ?? "",
            strengthsDistractionPlan:
              worksheet.strengths_distraction_plan ?? "",
            sharedDevelopmentFocus: worksheet.shared_development_focus ?? "",
            desiredImprovement: worksheet.desired_improvement ?? "",
            mentorSupportNeeded: worksheet.mentor_support_needed ?? "",
            communicationExpectations:
              worksheet.communication_expectations ?? "",
            initialDevelopmentFocus: Array.isArray(
              worksheet.initial_development_focus,
            )
              ? worksheet.initial_development_focus.map((item) =>
                  typeof item === "string" ? item : "",
                )
              : ["", ""],
            mentorGuidanceNotes: worksheet.mentor_guidance_notes ?? "",
            updatedAt: worksheet.updated_at,
          }
        : null,
    };
  });
  const visibleAssignmentsWithDepartmentalWorksheet = visibleAssignments.map(
    (assignment) => {
      const worksheet =
        (departmentalProjectWorksheetsResult.data ?? []).find(
          (item) =>
            item.candidate_id === assignment.candidate_id &&
            item.role_id === assignment.role_id &&
            item.mentor_profile_id === assignment.mentor_profile_id,
        ) ?? null;

      return {
        candidateId: assignment.candidate_id,
        roleId: assignment.role_id,
        mentorProfileId: assignment.mentor_profile_id,
        candidateName:
          candidateMap.get(assignment.candidate_id)?.full_name ??
          "Unknown candidate",
        currentTitle:
          candidateMap.get(assignment.candidate_id)?.current_title ?? null,
        roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
        departmentName: roleMap.get(assignment.role_id)?.department ?? null,
        mentorName:
          mentorMap.get(assignment.mentor_profile_id)?.full_name ??
          "Unknown mentor",
        mentorPositionTitle:
          mentorMap.get(assignment.mentor_profile_id)?.position_title ?? null,
        startDate: assignment.start_date,
        worksheet: worksheet
          ? {
              id: worksheet.id,
              candidateId: worksheet.candidate_id,
              roleId: worksheet.role_id,
              mentorProfileId: worksheet.mentor_profile_id,
              status:
                worksheet.status === "completed"
                  ? ("completed" as const)
                  : ("draft" as const),
              projectTimeline: worksheet.project_timeline ?? "",
              departmentNeed: worksheet.department_need ?? "",
              projectTitle: worksheet.project_title ?? "",
              projectObjective: worksheet.project_objective ?? "",
              projectImportance: worksheet.project_importance ?? "",
              responsibleOutcomes: worksheet.responsible_outcomes ?? "",
              collaborators: worksheet.collaborators ?? "",
              leadershipActionsRequired: Array.isArray(
                worksheet.leadership_actions_required,
              )
                ? worksheet.leadership_actions_required.map((item) =>
                    typeof item === "string" ? item : "",
                  )
                : [],
              leadershipActionsOther:
                worksheet.leadership_actions_other ?? "",
              competenciesDeveloped: worksheet.competencies_developed ?? "",
              mentorAnticipatedDifficulty:
                worksheet.mentor_anticipated_difficulty ?? "",
              mentorStretchCompetencies:
                worksheet.mentor_stretch_competencies ?? "",
              menteeAnticipatedDifficulty:
                worksheet.mentee_anticipated_difficulty ?? "",
              challengeProcessWithMentor:
                worksheet.challenge_process_with_mentor ?? "",
              coachingAreas: worksheet.coaching_areas ?? "",
              figuringThingsOutProcess:
                worksheet.figuring_things_out_process ?? "",
              helpThreshold: worksheet.help_threshold ?? "",
              successMeasures: worksheet.success_measures ?? "",
              postProjectLeaderWins:
                worksheet.post_project_leader_wins ?? "",
              postProjectDoDifferently:
                worksheet.post_project_do_differently ?? "",
              postProjectFeedbackReceived:
                worksheet.post_project_feedback_received ?? "",
              mentorEvaluationCompetenciesDeveloped:
                worksheet.mentor_evaluation_competencies_developed ?? "",
              strengthsObserved: worksheet.strengths_observed ?? "",
              futureDevelopmentAreas:
                worksheet.future_development_areas ?? "",
              readinessSignal:
                worksheet.readiness_signal === "developing" ||
                worksheet.readiness_signal === "progressing" ||
                worksheet.readiness_signal === "role_ready"
                  ? worksheet.readiness_signal
                  : "",
              updatedAt: worksheet.updated_at,
            }
          : null,
      };
    },
  );
  const visibleAssignmentsWithCrossDepartmentalWorksheet =
    visibleAssignments.map((assignment) => {
      const worksheet =
        (crossDepartmentalProjectWorksheetsResult.data ?? []).find(
          (item) =>
            item.candidate_id === assignment.candidate_id &&
            item.role_id === assignment.role_id &&
            item.mentor_profile_id === assignment.mentor_profile_id,
        ) ?? null;

      return {
        candidateId: assignment.candidate_id,
        roleId: assignment.role_id,
        mentorProfileId: assignment.mentor_profile_id,
        candidateName:
          candidateMap.get(assignment.candidate_id)?.full_name ??
          "Unknown candidate",
        currentTitle:
          candidateMap.get(assignment.candidate_id)?.current_title ?? null,
        roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
        departmentName: roleMap.get(assignment.role_id)?.department ?? null,
        mentorName:
          mentorMap.get(assignment.mentor_profile_id)?.full_name ??
          "Unknown mentor",
        mentorPositionTitle:
          mentorMap.get(assignment.mentor_profile_id)?.position_title ?? null,
        startDate: assignment.start_date,
        worksheet: worksheet
          ? {
              id: worksheet.id,
              candidateId: worksheet.candidate_id,
              roleId: worksheet.role_id,
              mentorProfileId: worksheet.mentor_profile_id,
              status:
                worksheet.status === "completed"
                  ? ("completed" as const)
                  : ("draft" as const),
              worksheetDate: worksheet.worksheet_date ?? "",
              departmentConversations: Array.isArray(
                worksheet.department_conversations,
              )
                ? worksheet.department_conversations.map((item) => ({
                    departmentName:
                      typeof item?.departmentName === "string"
                        ? item.departmentName
                        : "",
                    leaderName:
                      typeof item?.leaderName === "string" ? item.leaderName : "",
                    topPriorities:
                      typeof item?.topPriorities === "string"
                        ? item.topPriorities
                        : "",
                    pressuresChallenges:
                      typeof item?.pressuresChallenges === "string"
                        ? item.pressuresChallenges
                        : "",
                    roleImpact:
                      typeof item?.roleImpact === "string" ? item.roleImpact : "",
                    breakdowns:
                      typeof item?.breakdowns === "string" ? item.breakdowns : "",
                    strongCollaboration:
                      typeof item?.strongCollaboration === "string"
                        ? item.strongCollaboration
                        : "",
                  }))
                : [],
              crossDepartmentChallenge:
                worksheet.cross_department_challenge ?? "",
              projectTitle: worksheet.project_title ?? "",
              projectObjective: worksheet.project_objective ?? "",
              projectPartners: worksheet.project_partners ?? "",
              projectTimeline: worksheet.project_timeline ?? "",
              projectLearningGoal: worksheet.project_learning_goal ?? "",
              sharedThemes: worksheet.shared_themes ?? "",
              alignmentRisks: worksheet.alignment_risks ?? "",
              biggestSurprise: worksheet.biggest_surprise ?? "",
              leadershipShift: worksheet.leadership_shift ?? "",
              criticalBehaviors: worksheet.critical_behaviors ?? "",
              hospitalInsights: worksheet.hospital_insights ?? "",
              actionCommitments: Array.isArray(worksheet.action_commitments)
                ? worksheet.action_commitments.map((item) =>
                    typeof item === "string" ? item : "",
                  )
                : ["", "", ""],
              mentorObservedQualities: Array.isArray(
                worksheet.mentor_observed_qualities,
              )
                ? worksheet.mentor_observed_qualities.map((item) =>
                    typeof item === "string" ? item : "",
                  )
                : [],
              mentorComments: worksheet.mentor_comments ?? "",
              updatedAt: worksheet.updated_at,
            }
          : null,
      };
    });
  const mentoringWorkspaceDetailItems = [
    `${new Set(visibleAssignments.map((assignment) => assignment.candidate_id)).size} candidates in active mentoring`,
    `${visibleAssignments.length} active mentor assignments`,
    `${
      visibleAssignments.filter((assignment) =>
        candidateRolePairsWithReports.has(
          `${assignment.candidate_id}:${assignment.role_id}`,
        ),
      ).length
    } role tracks with reports`,
    "Leadership development records, preparation worksheets, departmental projects, and cross-departmental projects are all live in this workspace",
  ];
  const selectedAssignmentKey =
    requestedAssignmentKey &&
    visibleAssignments.some(
      (assignment) => getAssignmentKey(assignment) === requestedAssignmentKey,
    )
      ? requestedAssignmentKey
      : null;
  const isResourceSection =
    selectedSectionId === "preparation-worksheet" ||
    selectedSectionId === "departmental-project" ||
    selectedSectionId === "cross-departmental-project";
  const mentoringSections = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Candidates in Mentoring
              </p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">
                {
                  new Set(
                    visibleAssignments.map((assignment) => assignment.candidate_id),
                  ).size
                }
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Active Mentor Assignments
              </p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">
                {visibleAssignments.length}
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Role Tracks with Reports
              </p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">
                {
                  visibleAssignments.filter((assignment) =>
                    candidateRolePairsWithReports.has(
                      `${assignment.candidate_id}:${assignment.role_id}`,
                    ),
                  ).length
                }
              </p>
            </article>
          </section>

          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-8 shadow-[0_20px_60px_rgba(217,119,6,0.12)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">
              Mentoring Process
            </p>
            <ol className="mt-6 grid gap-3 text-sm leading-7 text-amber-950">
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                Attach the mentor to the candidate through the specific role.
              </li>
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                Complete the preparation worksheet together before deeper project work begins.
              </li>
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                Open the leadership development record to define the stretch experience, target competencies, leader touchpoints, and review cycle for that mentoring track.
              </li>
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                Generate the mentor report inside that candidate-role track.
              </li>
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                Review strengths, fit gaps, development plans, and check-ins in context of that role.
              </li>
              <li className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                If the candidate is being considered for another role, add a second role track and assign another mentor there.
              </li>
            </ol>
          </section>
        </>
      ),
    },
    {
      id: "mentor-assignments",
      label: "Mentor Assignments",
      content: (
        <>
          {(isAdminAppRole(profile.role) || visibleRoleOptions.length > 0) ? (
            <MentorAssignmentManager
              candidates={(candidatesResult.data ?? []).map((candidate) => ({
                id: candidate.id,
                full_name: candidate.full_name,
              }))}
              roles={visibleRoleOptions.map((role) => ({
                id: role.id,
                title: role.title,
              }))}
              mentors={visibleMentorOptions.map((mentor) => ({
                id: mentor.id,
                full_name: mentor.full_name,
                position_title: mentor.position_title,
              }))}
              canChooseMentor={isAdminAppRole(profile.role)}
            />
          ) : null}

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Mentor Assignments
                </p>
                <h2 className="mt-3 font-display text-3xl text-slate-900">
                  Current candidate-role assignments
                </h2>
              </div>
              <Link
                href="/candidates"
                className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Candidates
              </Link>
            </div>

            <div className="mt-6 grid gap-3">
              {visibleAssignments.length > 0 ? (
                visibleAssignments.map((assignment) => {
                  const candidate = candidateMap.get(assignment.candidate_id);
                  const role = roleMap.get(assignment.role_id);
                  const mentor = mentorMap.get(assignment.mentor_profile_id);
                  const hasReport = candidateRolePairsWithReports.has(
                    `${assignment.candidate_id}:${assignment.role_id}`,
                  );

                  return (
                    <Link
                      key={`${assignment.candidate_id}-${assignment.role_id}-${assignment.mentor_profile_id}`}
                      href={`/candidates/${assignment.candidate_id}?roleId=${assignment.role_id}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
                    >
                      <p className="font-semibold text-slate-900">
                        {candidate?.full_name ?? "Unknown candidate"}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Role: {role?.title ?? "Unknown role"}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Mentor: {mentor?.full_name ?? "Unknown mentor"}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Start date: {assignment.start_date || "Not set"}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Report status:{" "}
                        {hasReport ? "Report generated" : "Needs mentor report"}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  {isAdminAppRole(profile.role)
                    ? "No mentor assignments exist yet. Create the first candidate-role assignment above."
                    : "No candidate-role assignments are attached to your mentor account yet."}
                </article>
              )}
            </div>
          </section>
        </>
      ),
    },
    {
      id: "preparation-worksheet",
      label: "Preparation Worksheet",
      content: (
        <MentoringPreparationWorksheetManager
          key={selectedAssignmentKey ?? "no-assignment"}
          assignments={visibleAssignmentsWithWorksheet}
          initialSelectedAssignmentKey={selectedAssignmentKey}
          storageReady={worksheetStorageReady}
        />
      ),
    },
    {
      id: "leadership-development-record",
      label: "Leadership Development Record",
      content: (
        <LeadershipDevelopmentRecordManager
          assignments={visibleAssignments.map((assignment) => ({
            candidateId: assignment.candidate_id,
            roleId: assignment.role_id,
            mentorProfileId: assignment.mentor_profile_id,
            candidateName:
              candidateMap.get(assignment.candidate_id)?.full_name ??
              "Unknown candidate",
            currentTitle:
              candidateMap.get(assignment.candidate_id)?.current_title ?? null,
            roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
            mentorName:
              mentorMap.get(assignment.mentor_profile_id)?.full_name ??
              "Unknown mentor",
            mentorPositionTitle:
              mentorMap.get(assignment.mentor_profile_id)?.position_title ?? null,
            startDate: assignment.start_date,
          }))}
          initialSelectedAssignmentKey={selectedAssignmentKey}
        />
      ),
    },
    {
      id: "departmental-project",
      label: "Departmental Project",
      content: (
        <MentoringDepartmentalProjectWorksheetManager
          key={selectedAssignmentKey ?? "no-assignment"}
          assignments={visibleAssignmentsWithDepartmentalWorksheet}
          initialSelectedAssignmentKey={selectedAssignmentKey}
          storageReady={departmentalProjectStorageReady}
        />
      ),
    },
    {
      id: "cross-departmental-project",
      label: "Cross-Departmental Project",
      content: (
        <MentoringCrossDepartmentalProjectWorksheetManager
          key={selectedAssignmentKey ?? "no-assignment"}
          assignments={visibleAssignmentsWithCrossDepartmentalWorksheet}
          initialSelectedAssignmentKey={selectedAssignmentKey}
          storageReady={crossDepartmentalProjectStorageReady}
        />
      ),
    },
    {
      id: "readiness-review",
      label: "Readiness Review",
      content: (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Future Worksheet
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Readiness review worksheet
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            This section can later hold readiness review notes and scoring
            conversations that pull from the completed mentoring worksheets.
          </p>
        </section>
      ),
    },
  ] satisfies Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
  const selectedMentoringSection =
    mentoringSections.find((section) => section.id === selectedSectionId) ??
    mentoringSections[0];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        {!isResourceSection ? (
          <section className="theme-panel-strong rounded-[2rem] p-8">
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
              Mentoring Workflow
            </p>
            <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
              Manage mentoring by candidate and role
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Mentors are now attached to the candidate through a specific role.
              That means one candidate can sit in more than one role track, with a
              different mentor assigned to each track when needed.
            </p>
          </section>
        ) : null}

        {selectedSectionId === "overview" ? (
          <MentorFlowPanel
            assignments={visibleAssignmentsWithWorksheet.map((assignment) => ({
              candidateId: assignment.candidateId,
              roleId: assignment.roleId,
              mentorProfileId: assignment.mentorProfileId,
              candidateName: assignment.candidateName,
              currentTitle: assignment.currentTitle,
              roleTitle: assignment.roleTitle,
              mentorName: assignment.mentorName,
              mentorPositionTitle: assignment.mentorPositionTitle,
              hasPreparationWorksheet: assignment.worksheet !== null,
              hasDepartmentalWorksheet:
                visibleAssignmentsWithDepartmentalWorksheet.some(
                  (item) =>
                    item.candidateId === assignment.candidateId &&
                    item.roleId === assignment.roleId &&
                    item.mentorProfileId === assignment.mentorProfileId &&
                    item.worksheet !== null,
                ),
              hasCrossDepartmentalWorksheet:
                visibleAssignmentsWithCrossDepartmentalWorksheet.some(
                  (item) =>
                    item.candidateId === assignment.candidateId &&
                    item.roleId === assignment.roleId &&
                    item.mentorProfileId === assignment.mentorProfileId &&
                    item.worksheet !== null,
                ),
              hasReport: candidateRolePairsWithReports.has(
                `${assignment.candidateId}:${assignment.roleId}`,
              ),
            }))}
            selectedAssignmentKey={selectedAssignmentKey}
            canChooseMentor={isAdminAppRole(profile.role)}
          />
        ) : null}

        {isResourceSection ? (
          selectedMentoringSection.content
        ) : (
          <MentoringWorkspaceMenu
            key={selectedSectionId}
            detailItems={mentoringWorkspaceDetailItems}
            initialSectionId={selectedSectionId}
            sections={mentoringSections}
          />
        )}
      </div>
    </main>
  );
}
