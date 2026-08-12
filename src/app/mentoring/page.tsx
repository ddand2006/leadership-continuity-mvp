import Link from "next/link";
import { redirect } from "next/navigation";
import { MentorFlowPanel } from "@/components/mentor-flow-panel";
import { MentoringCrossDepartmentalProjectWorksheetManager } from "@/components/mentoring-cross-departmental-project-worksheet-manager";
import { MentoringDepartmentalProjectWorksheetManager } from "@/components/mentoring-departmental-project-worksheet-manager";
import { MentoringPreparationWorksheetManager } from "@/components/mentoring-preparation-worksheet-manager";
import { MentoringReadinessReview } from "@/components/mentoring-readiness-review";
import { LeadershipDevelopmentRecordManager } from "@/components/leadership-development-record-manager";
import { MentoringAssignmentSidebar } from "@/components/mentoring-assignment-sidebar";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";
import { isMissingCrossDepartmentalProjectWorksheetTableError } from "@/lib/mentoring-cross-departmental-project-worksheet";
import { isMissingDepartmentalProjectWorksheetTableError } from "@/lib/mentoring-departmental-project-worksheet";
import {
  isAdminAppRole,
  isActiveMentorAssignmentStatus,
  isCandidateAppUser,
  isMentorAppUser,
} from "@/lib/mentor-access";
import { isMissingLeadershipDevelopmentRecordTableError, type LeadershipDevelopmentRecordRecord } from "@/lib/leadership-development-record";
import { mentorReportSchema, type MentorReport } from "@/lib/mentor-report";
import { isMissingPreparationWorksheetTableError } from "@/lib/mentoring-preparation-worksheet";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type MentoringPageProps = {
  searchParams: Promise<{
    section?: string;
    candidateId?: string;
    projectId?: string;
    recordId?: string;
    roleId?: string;
    mentorProfileId?: string;
  }>;
};

function getAssignmentKey(option: {
  candidate_id: string;
  role_id: string;
  mentor_profile_id: string | null;
}) {
  return `${option.candidate_id}:${option.role_id}:${option.mentor_profile_id ?? "unassigned"}`;
}

function getAssignmentPriorityScore(
  assignment: {
    mentor_profile_id: string | null;
    status: string | null;
  },
  mentorMap: Map<string, { id: string; full_name: string | null; position_title: string | null }>,
) {
  const hasKnownMentor = Boolean(
    assignment.mentor_profile_id && mentorMap.has(assignment.mentor_profile_id),
  );
  const hasAnyMentor = Boolean(assignment.mentor_profile_id);

  return (
    (assignment.status === "active" ? 100 : 0) +
    (hasKnownMentor ? 10 : hasAnyMentor ? 5 : 0)
  );
}

function compareAssignmentsForSelection(
  left: {
    candidate_id: string;
    mentor_profile_id: string | null;
    role_id: string;
    status: string | null;
  },
  right: {
    candidate_id: string;
    mentor_profile_id: string | null;
    role_id: string;
    status: string | null;
  },
  mentorMap: Map<string, { id: string; full_name: string | null; position_title: string | null }>,
) {
  const scoreDifference =
    getAssignmentPriorityScore(right, mentorMap) -
    getAssignmentPriorityScore(left, mentorMap);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return getAssignmentKey(left).localeCompare(getAssignmentKey(right));
}

function resolvePreferredAssignmentKey(options: {
  mentorMap: Map<string, { id: string; full_name: string | null; position_title: string | null }>;
  requestedAssignmentKey: string | null;
  requestedCandidateId: string | undefined;
  requestedRoleId: string | undefined;
  visibleAssignments: Array<{
    candidate_id: string;
    mentor_profile_id: string | null;
    role_id: string;
    status: string | null;
  }>;
}) {
  const orderedAssignments = [...options.visibleAssignments].sort((left, right) =>
    compareAssignmentsForSelection(left, right, options.mentorMap),
  );

  if (orderedAssignments.length === 0) {
    return null;
  }

  const matchingRequestedTrack =
    options.requestedCandidateId && options.requestedRoleId
      ? orderedAssignments.filter(
          (assignment) =>
            assignment.candidate_id === options.requestedCandidateId &&
            assignment.role_id === options.requestedRoleId,
        )
      : [];

  if (matchingRequestedTrack.length > 0) {
    const exactRequestedMatch =
      options.requestedAssignmentKey &&
      matchingRequestedTrack.find(
        (assignment) => getAssignmentKey(assignment) === options.requestedAssignmentKey,
      );

    if (
      exactRequestedMatch &&
      getAssignmentPriorityScore(exactRequestedMatch, options.mentorMap) >=
        getAssignmentPriorityScore(matchingRequestedTrack[0], options.mentorMap)
    ) {
      return getAssignmentKey(exactRequestedMatch);
    }

    return getAssignmentKey(matchingRequestedTrack[0]);
  }

  if (
    options.requestedAssignmentKey &&
    orderedAssignments.some(
      (assignment) => getAssignmentKey(assignment) === options.requestedAssignmentKey,
    )
  ) {
    return options.requestedAssignmentKey;
  }

  return getAssignmentKey(orderedAssignments[0]);
}

export default async function MentoringPage({
  searchParams,
}: MentoringPageProps) {
  const {
    candidateId: requestedCandidateId,
    mentorProfileId: requestedMentorProfileId,
    projectId: requestedProjectId,
    recordId: requestedRecordId,
    roleId: requestedRoleId,
    section: requestedSection,
  } = await searchParams;
  const { account, profile, supabase } = await requirePaidWorkspaceProfile();
  const isAdmin = isAdminAppRole(profile.role);
  const isMentor = isMentorAppUser(profile, account);
  const isMentorOnly = isMentor && !isAdmin;
  const isCandidate = isCandidateAppUser(account);
  const candidateIdForSelfAccess = account?.candidate_id ?? null;
  const canManageMentorAssignments = isAdmin || isMentor;
  const allowedSectionIds = new Set([
    "overview",
    "resources",
    "preparation-worksheet",
    "leadership-development-record",
    "departmental-project",
    "cross-departmental-project",
    "readiness-review",
    ...(canManageMentorAssignments ? ["mentor-assignments"] : []),
  ]);
  const selectedSectionId =
    requestedSection && allowedSectionIds.has(requestedSection)
      ? requestedSection
      : isMentorOnly
        ? "mentor-assignments"
        : "overview";

  if (!isAdmin && !isMentor && !isCandidate) {
    redirect(
      "/candidates?message=Candidate+accounts+can+only+view+their+own+candidate+records",
    );
  }

  const needsPreparationWorksheets =
    selectedSectionId === "preparation-worksheet";
  const needsDepartmentalProjectWorksheets =
    selectedSectionId === "departmental-project";
  const needsCrossDepartmentalProjectWorksheets =
    selectedSectionId === "cross-departmental-project";
  const needsReadinessReview = selectedSectionId === "readiness-review";
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
    needsPreparationWorksheets
      ? supabase
          .from("mentoring_preparation_worksheets")
          .select(
            "id, candidate_id, role_id, mentor_profile_id, status, worksheet_date, critical_competencies, mentee_least_prepared, mentee_strongest_area, strengths_help, strengths_distraction_plan, shared_development_focus, desired_improvement, mentor_support_needed, communication_expectations, initial_development_focus, mentor_guidance_notes, updated_at",
          )
          .eq("organization_id", profile.organization_id)
          .eq("worksheet_type", "mentor_mentee_preparation")
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    needsDepartmentalProjectWorksheets
      ? supabase
          .from("mentoring_departmental_project_worksheets")
          .select(
            "id, candidate_id, role_id, mentor_profile_id, status, project_timeline, department_need, project_title, project_objective, project_importance, responsible_outcomes, collaborators, leadership_actions_required, leadership_actions_other, competencies_developed, mentor_anticipated_difficulty, mentor_stretch_competencies, mentee_anticipated_difficulty, challenge_process_with_mentor, coaching_areas, figuring_things_out_process, help_threshold, success_measures, post_project_leader_wins, post_project_do_differently, post_project_feedback_received, mentor_evaluation_competencies_developed, strengths_observed, future_development_areas, readiness_signal, updated_at",
          )
          .eq("organization_id", profile.organization_id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    needsCrossDepartmentalProjectWorksheets
      ? supabase
          .from("mentoring_cross_departmental_project_worksheets")
          .select(
            "id, candidate_id, role_id, mentor_profile_id, status, worksheet_date, department_conversations, cross_department_challenge, project_title, project_objective, project_partners, project_timeline, project_learning_goal, shared_themes, alignment_risks, biggest_surprise, leadership_shift, critical_behaviors, hospital_insights, action_commitments, mentor_observed_qualities, mentor_comments, updated_at",
          )
          .eq("organization_id", profile.organization_id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
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

  const roleMap = new Map(
    (rolesResult.data ?? []).map((role) => [
      role.id,
      {
        ...role,
        title: canonicalizeRoleTitle(role.title),
      },
    ]),
  );
  const candidateMap = new Map(
    (candidatesResult.data ?? []).map((candidate) => [
      candidate.id,
      { ...candidate, full_name: getCandidateDisplayName(candidate.full_name) },
    ]),
  );
  const mentorMap = new Map(
    (mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const candidateRolePairsWithReports = new Set(
    (reportsResult.data ?? []).map((report) => `${report.candidate_id}:${report.role_id}`),
  );

  const visibleAssignments = isAdmin
    ? mentorAssignmentsResult.data ?? []
    : (mentorAssignmentsResult.data ?? []).filter((assignment) =>
        isMentor
          ? assignment.mentor_profile_id === profile.id &&
            isActiveMentorAssignmentStatus(assignment.status)
          : candidateIdForSelfAccess !== null &&
            assignment.candidate_id === candidateIdForSelfAccess,
      );
  const orderedVisibleAssignments = [...visibleAssignments].sort((left, right) =>
    compareAssignmentsForSelection(left, right, mentorMap),
  );
  const requestedAssignmentKey =
    requestedCandidateId && requestedRoleId && requestedMentorProfileId
      ? `${requestedCandidateId}:${requestedRoleId}:${requestedMentorProfileId}`
      : null;
  const readinessCandidateIds = Array.from(
    new Set(orderedVisibleAssignments.map((assignment) => assignment.candidate_id)),
  );
  const readinessRoleIds = Array.from(
    new Set(orderedVisibleAssignments.map((assignment) => assignment.role_id)),
  );
  const readinessMentorIds = Array.from(
    new Set(
      orderedVisibleAssignments
        .map((assignment) => assignment.mentor_profile_id)
        .filter((mentorId): mentorId is string => Boolean(mentorId)),
    ),
  );
  const [readinessReportsResult, readinessRecordsResult] =
    needsReadinessReview &&
    readinessCandidateIds.length > 0 &&
    readinessRoleIds.length > 0
      ? await Promise.all([
          supabase
            .from("mentor_reports")
            .select("id, candidate_id, role_id, version, created_at, report_json")
            .eq("organization_id", profile.organization_id)
            .in("candidate_id", readinessCandidateIds)
            .in("role_id", readinessRoleIds)
            .order("version", { ascending: false })
            .order("created_at", { ascending: false }),
          readinessMentorIds.length > 0
            ? supabase
                .from("development_records")
                .select(
                  "id, candidate_id, role_id, mentor_id, status, growth_areas, assignment_reason, experience_title, readiness_signal, next_recommended_experience, mentor_review_date, average_feedback_score, mentor_improvement_observed, mentor_development_needed, date_assigned, updated_at",
                )
                .eq("organization_id", profile.organization_id)
                .in("candidate_id", readinessCandidateIds)
                .in("role_id", readinessRoleIds)
                .in("mentor_id", readinessMentorIds)
                .order("updated_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (readinessReportsResult.error) {
    throw new Error(readinessReportsResult.error.message);
  }

  if (
    readinessRecordsResult.error &&
    !isMissingLeadershipDevelopmentRecordTableError(readinessRecordsResult.error)
  ) {
    throw new Error(readinessRecordsResult.error.message);
  }

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
              organizationInsights: worksheet.hospital_insights ?? "",
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
  const orderedVisibleAssignmentsWithWorksheet = orderedVisibleAssignments.map((assignment) => {
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
  const readinessVisibleCandidateRolePairs = new Set(
    orderedVisibleAssignments.map(
      (assignment) => `${assignment.candidate_id}:${assignment.role_id}`,
    ),
  );
  const latestMentorReportByCandidateRole = new Map<
    string,
    {
      id: string;
      version: number;
      createdAt: string;
      report: MentorReport;
    }
  >();

  for (const reportRow of readinessReportsResult.data ?? []) {
    const candidateRoleKey = `${reportRow.candidate_id}:${reportRow.role_id}`;

    if (
      latestMentorReportByCandidateRole.has(candidateRoleKey) ||
      !readinessVisibleCandidateRolePairs.has(candidateRoleKey)
    ) {
      continue;
    }

    const parsedReport = mentorReportSchema.safeParse(reportRow.report_json);

    if (!parsedReport.success) {
      continue;
    }

    latestMentorReportByCandidateRole.set(candidateRoleKey, {
      id: reportRow.id,
      version: reportRow.version,
      createdAt: reportRow.created_at,
      report: parsedReport.data,
    });
  }

  const latestDevelopmentRecordByAssignment = new Map<
    string,
    {
      id: string;
      status: LeadershipDevelopmentRecordRecord["status"];
      experienceTitle: string;
      dateAssigned: string;
      readinessSignal: LeadershipDevelopmentRecordRecord["readinessSignal"];
      averageFeedbackScore: number | null;
      mentorReviewDate: string;
      updatedAt: string;
      growthAreas: LeadershipDevelopmentRecordRecord["growthAreas"];
      assignmentReason: string;
      mentorImprovementObserved: string;
      mentorDevelopmentNeeded: string;
      nextRecommendedExperience: string;
    }
  >();

  for (const record of readinessRecordsResult.data ?? []) {
    const assignmentKey = getAssignmentKey({
      candidate_id: record.candidate_id,
      role_id: record.role_id,
      mentor_profile_id: record.mentor_id,
    });

    if (latestDevelopmentRecordByAssignment.has(assignmentKey)) {
      continue;
    }

    latestDevelopmentRecordByAssignment.set(assignmentKey, {
      id: record.id,
      status:
        record.status === "completed" ||
        record.status === "ready_for_review" ||
        record.status === "in_progress"
          ? record.status
          : "assigned",
      experienceTitle: record.experience_title,
      dateAssigned: record.date_assigned,
      readinessSignal:
        record.readiness_signal === "developing" ||
        record.readiness_signal === "progressing" ||
        record.readiness_signal === "near_role_ready" ||
        record.readiness_signal === "role_ready"
          ? record.readiness_signal
          : "",
      averageFeedbackScore:
        typeof record.average_feedback_score === "number"
          ? record.average_feedback_score
          : null,
      mentorReviewDate: record.mentor_review_date ?? "",
      updatedAt: record.updated_at,
      growthAreas: Array.isArray(record.growth_areas)
        ? (record.growth_areas.filter(
            (value): value is LeadershipDevelopmentRecordRecord["growthAreas"][number] =>
              typeof value === "string" && value.trim().length > 0,
          ) as LeadershipDevelopmentRecordRecord["growthAreas"])
        : [],
      assignmentReason: record.assignment_reason ?? "",
      mentorImprovementObserved: record.mentor_improvement_observed ?? "",
      mentorDevelopmentNeeded: record.mentor_development_needed ?? "",
      nextRecommendedExperience: record.next_recommended_experience ?? "",
    });
  }

  const readinessReviewAssignments = orderedVisibleAssignments.map((assignment) => ({
    assignmentKey: getAssignmentKey(assignment),
    candidateId: assignment.candidate_id,
    roleId: assignment.role_id,
    mentorProfileId: assignment.mentor_profile_id,
    candidateName:
      candidateMap.get(assignment.candidate_id)?.full_name ?? "Unknown candidate",
    currentTitle:
      candidateMap.get(assignment.candidate_id)?.current_title ?? null,
    roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
    mentorName:
      mentorMap.get(assignment.mentor_profile_id)?.full_name ?? "Unknown mentor",
    mentorPositionTitle:
      mentorMap.get(assignment.mentor_profile_id)?.position_title ?? null,
    startDate: assignment.start_date,
    latestMentorReport:
      latestMentorReportByCandidateRole.get(
        `${assignment.candidate_id}:${assignment.role_id}`,
      ) ?? null,
    latestDevelopmentRecord:
      latestDevelopmentRecordByAssignment.get(getAssignmentKey(assignment)) ?? null,
  }));

  const mentoringWorkspaceDetailItems = [
    `${new Set(orderedVisibleAssignments.map((assignment) => assignment.candidate_id)).size} candidates in active mentoring`,
    `${orderedVisibleAssignments.length} active mentor assignments`,
    `${
      orderedVisibleAssignments.filter((assignment) =>
        candidateRolePairsWithReports.has(
          `${assignment.candidate_id}:${assignment.role_id}`,
        ),
      ).length
    } role tracks with reports`,
    "Leadership development records, preparation worksheets, departmental projects, and cross-departmental projects are all live in this workspace",
  ];
  const selectedAssignmentKey = resolvePreferredAssignmentKey({
    mentorMap,
    requestedAssignmentKey,
    requestedCandidateId,
    requestedRoleId,
    visibleAssignments: orderedVisibleAssignments,
  });
  const selectedAssignment = orderedVisibleAssignments.find(
    (assignment) => getAssignmentKey(assignment) === selectedAssignmentKey,
  ) ?? null;
  const selectedCandidateHref = selectedAssignment
    ? `/candidates/${selectedAssignment.candidate_id}?roleId=${selectedAssignment.role_id}`
    : "/candidates";
  function getMentoringSectionHref(sectionId: string) {
    const params = new URLSearchParams({ section: sectionId });
    if (selectedAssignment) {
      params.set("candidateId", selectedAssignment.candidate_id);
      params.set("roleId", selectedAssignment.role_id);
      if (selectedAssignment.mentor_profile_id) {
        params.set("mentorProfileId", selectedAssignment.mentor_profile_id);
      }
    }
    return `/mentoring?${params.toString()}`;
  }
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
    ...(canManageMentorAssignments
      ? [
          {
            id: "mentor-assignments",
            label: "My Mentoring Assignments",
            content: (
              <>
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                        Mentor Assignments
                      </p>
                      <h2 className="mt-3 font-display text-3xl text-slate-900">
                        {isMentorOnly
                          ? "Your mentees"
                          : "Current candidate-role assignments"}
                      </h2>
                    </div>
                    {isAdmin || isMentorOnly ? (
                      <Link
                        href={selectedCandidateHref}
                        className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                      >
                        {selectedAssignment ? "Open Candidate" : "Open Candidates"}
                      </Link>
                    ) : null}
                  </div>

                  {isMentorOnly ? (
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                      Start with the preparation worksheet for a mentee, then use
                      the leadership development record to guide and document
                      their growth.
                    </p>
                  ) : null}

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
                          <article
                            key={`${assignment.candidate_id}-${assignment.role_id}-${assignment.mentor_profile_id}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
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
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Link
                                href={`/mentoring?section=preparation-worksheet&candidateId=${assignment.candidate_id}&roleId=${assignment.role_id}&mentorProfileId=${assignment.mentor_profile_id}`}
                                className="interactive-contrast rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                              >
                                {isMentorOnly
                                  ? "Start mentoring"
                                  : "Open mentoring track"}
                              </Link>
                              {isAdmin ? (
                                <Link
                                  href={`/candidates/${assignment.candidate_id}?roleId=${assignment.role_id}`}
                                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                >
                                  Open candidate
                                </Link>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                        {isAdmin
                          ? "No mentor assignments exist yet. Open the Assign Mentors tab in Administration to create the first candidate-role assignment."
                          : "No candidate-role assignments are attached to your mentor account yet."}
                      </article>
                    )}
                  </div>
                </section>
              </>
            ),
          },
        ]
      : []),
    {
      id: "resources",
      label: "Additional Resources",
      content: (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Mentoring resources</p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">Worksheets and project tools</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Use these resources within the selected mentoring track to prepare for the relationship and document departmental or cross-departmental stretch work.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { id: "preparation-worksheet", title: "Preparation Worksheet", description: "Align mentor and candidate expectations, strengths, and the initial development focus." },
              { id: "departmental-project", title: "Departmental Project", description: "Plan and evaluate a stretch assignment inside the candidate's department." },
              { id: "cross-departmental-project", title: "Cross-Departmental Project", description: "Develop enterprise perspective through a project that crosses teams or functions." },
            ].map((resource) => (
              <Link key={resource.id} href={getMentoringSectionHref(resource.id)} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50">
                <h3 className="font-semibold text-slate-900">{resource.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-teal-800">Open resource</span>
              </Link>
            ))}
          </div>
        </section>
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
          key={`${selectedAssignmentKey ?? "no-assignment"}:${requestedProjectId ?? "no-project"}:${requestedRecordId ?? "no-record"}`}
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
          initialSelectedProjectId={requestedProjectId ?? null}
          initialSelectedRecordId={requestedRecordId ?? null}
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
        <MentoringReadinessReview
          assignments={readinessReviewAssignments}
          selectedAssignmentKey={selectedAssignmentKey}
        />
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
      <div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <MentoringAssignmentSidebar
            assignments={orderedVisibleAssignments.map((assignment) => ({
              key: getAssignmentKey(assignment),
              candidateId: assignment.candidate_id,
              candidateName:
                candidateMap.get(assignment.candidate_id)?.full_name?.trim() ||
                "Candidate name not entered",
              currentTitle: candidateMap.get(assignment.candidate_id)?.current_title ?? null,
              roleId: assignment.role_id,
              roleTitle: roleMap.get(assignment.role_id)?.title ?? "Unknown role",
              mentorProfileId: assignment.mentor_profile_id,
              mentorName: mentorMap.get(assignment.mentor_profile_id)?.full_name ?? "Unassigned",
              status: assignment.status,
            }))}
            isMentorOnly={isMentorOnly}
            selectedAssignmentKey={selectedAssignmentKey}
            sectionId={selectedSectionId}
          />
          <div className="min-w-0">
            <section className="grid gap-6">
              <section className="theme-panel-strong rounded-[2rem] p-8">
                <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">Mentoring workspace</p>
                <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">{isAdmin ? "Manage mentoring by candidate and role" : isMentorOnly ? "Guide your mentees through their development" : "View your mentoring by role"}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{isAdmin ? "Use the selected candidate-role track to prepare, assign stretch work, record development evidence, and review readiness with the mentor." : isMentorOnly ? "Choose a mentee below to begin with shared expectations, then document development work and review progress in one role-based track." : "Your mentoring workspace is limited to role tracks assigned to your candidate account."}</p>
                <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
                  {mentoringWorkspaceDetailItems.slice(0, 3).map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />{item}</li>)}
                </ul>
              </section>
              <nav className="flex flex-wrap gap-3 border-b border-slate-200 pb-5" aria-label="Mentoring workspace sections">
                {["mentor-assignments", "leadership-development-record", "readiness-review", "resources"].flatMap((sectionId) => mentoringSections.filter((section) => section.id === sectionId)).map((section) => {
                  const isActive = section.id === selectedSectionId;
                  return <Link key={section.id} href={getMentoringSectionHref(section.id)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${isActive ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>{section.label}</Link>;
                })}
              </nav>
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
            canManageAssignments={canManageMentorAssignments}
            canChooseMentor={isAdmin}
                />
              ) : null}
              {selectedMentoringSection.content}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
