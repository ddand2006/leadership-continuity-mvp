import Link from "next/link";
import { redirect } from "next/navigation";
import { CandidateRoleConsiderationManager } from "@/components/candidate-role-consideration-manager";
import { CandidateProgressReport } from "@/components/candidate-progress-report";
import { CandidateWorkflowStateManager } from "@/components/candidate-workflow-state-manager";
import { CandidateDetailSectionMenu } from "@/components/candidate-detail-section-menu";
import { CandidateSelectorSidebar } from "@/components/candidate-selector-sidebar";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";
import { CandidateInsightExplorer } from "@/components/candidate-insight-explorer";
import { MentorReportMatchExplorer } from "@/components/mentor-report-match-explorer";
import { CandidateStrengthsUploadCard } from "@/components/candidate-strengths-upload-card";
import { GenerateMentorReportButton } from "@/components/generate-mentor-report-button";
import { InterviewScoreEntryPanel } from "@/components/interview-score-entry-panel";
import {
  isMissingCandidateGeneratedMentoringIdeaSetTableError,
  parseCandidateGeneratedMentoringIdeaSetRow,
} from "@/lib/candidate-generated-mentoring-idea-set";
import {
  formatFileSize,
  getCandidateSourceDocumentsBucket,
  getStrengthsUploadDocumentCategory,
} from "@/lib/candidate-source-documents";
import { hasOpenAIEnv } from "@/lib/env";
import {
  buildCompetencyAssessments,
  categorizeStrengths,
  computeOverallReadiness,
  computeRoleGoalReadiness,
  rankMentoringIdeasForCompetency,
  type DevelopmentProjectRecord,
} from "@/lib/fit-analysis";
import { computeCandidateAward } from "@/lib/candidate-awards";
import { isMissingLeadershipDevelopmentRecordTableError } from "@/lib/leadership-development-record";
import {
  getAccessibleCandidateIds,
  isAdminAppRole,
  isCandidateSelfAccess,
} from "@/lib/mentor-access";
import {
  buildRoleMatchesWeakestToStrongest,
  MentorReport,
} from "@/lib/mentor-report";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeAppText } from "@/lib/text-sanitizer";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type CandidateDetailPageProps = {
  params: Promise<{
    candidateId: string;
  }>;
  searchParams: Promise<{
    roleId?: string;
    section?: string;
  }>;
};

function getConsiderationStatusLabel(status: string) {
  return status === "on_hold" ? "On Hold" : "Active";
}

export default async function CandidateDetailPage({
  params,
  searchParams,
}: CandidateDetailPageProps) {
  const { candidateId } = await params;
  const { roleId: requestedRoleId, section: requestedSection } =
    await searchParams;
  const { account, profile, supabase } = await requirePaidWorkspaceProfile();
  const canGenerateReport = hasOpenAIEnv();
  const admin = createSupabaseAdminClient();

  const [
    candidateResult,
    organizationResult,
    considerationsResult,
    mentorAssignmentsResult,
    mentorProfilesResult,
    rolesResult,
    strengthsResult,
    sourceDocumentsResult,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, current_title, current_role_id, target_role_id, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", candidateId)
      .single(),
    supabase
      .from("organizations")
      .select("industry")
      .eq("id", profile.organization_id)
      .single(),
    supabase
      .from("candidate_role_considerations")
      .select("candidate_id, role_id, is_primary, status")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true }),
    supabase
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id, status, start_date, notes")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId),
    supabase
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("roles")
      .select("id, title, description")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("candidate_strengths")
      .select("theme_name, rank, domain")
      .eq("candidate_id", candidateId)
      .order("rank", { ascending: true }),
    supabase
      .from("candidate_source_documents")
      .select(
        "id, document_category, file_name, file_extension, mime_type, file_size_bytes, storage_bucket, storage_path, extracted_text, created_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("document_category", getStrengthsUploadDocumentCategory())
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [
    candidateResult,
    organizationResult,
    considerationsResult,
    mentorAssignmentsResult,
    mentorProfilesResult,
    rolesResult,
    strengthsResult,
    sourceDocumentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  if (!candidateResult.data) {
    throw new Error("Candidate could not be loaded.");
  }

  const candidate = {
    ...candidateResult.data,
    full_name: getCandidateDisplayName(candidateResult.data.full_name),
  };

  const considerations = considerationsResult.data ?? [];
  const mentorAssignments = mentorAssignmentsResult.data ?? [];
  const roleMap = new Map(
    (rolesResult.data ?? []).map((role) => [
      role.id,
      {
        ...role,
        title: canonicalizeRoleTitle(role.title),
      },
    ]),
  );
  const mentorMap = new Map(
    (mentorProfilesResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const displayableMentorAssignments = mentorAssignments.filter((assignment) =>
    mentorMap.has(assignment.mentor_profile_id),
  );

  const isAdmin = isAdminAppRole(profile.role);
  const canViewOwnCandidate = isCandidateSelfAccess(account, candidateId);
  const allCandidateRoleIds = Array.from(
    new Set([
      ...considerations.map((item) => item.role_id),
      ...(candidate.target_role_id ? [candidate.target_role_id] : []),
    ]),
  );
  const mentorAccessibleRoleIds = displayableMentorAssignments
    .filter(
      (assignment) =>
        assignment.mentor_profile_id === profile.id && assignment.status === "active",
    )
    .map((assignment) => assignment.role_id);
  const accessibleRoleIds =
    isAdmin || canViewOwnCandidate ? allCandidateRoleIds : mentorAccessibleRoleIds;

  if (!isAdmin && !canViewOwnCandidate && accessibleRoleIds.length === 0) {
    redirect("/candidates?message=You+do+not+have+access+to+that+candidate");
  }

  const sidebarMentorAssignmentsResult = isAdmin
    ? { data: [], error: null }
    : await supabase
        .from("mentor_role_assignments")
        .select("candidate_id, role_id, mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("mentor_profile_id", profile.id);

  if (sidebarMentorAssignmentsResult.error) {
    throw new Error(sidebarMentorAssignmentsResult.error.message);
  }

  const sidebarAccessibleCandidateIds = getAccessibleCandidateIds({
    profile,
    account,
    mentorAssignments: sidebarMentorAssignmentsResult.data ?? [],
  });
  const sidebarCandidateIds = Array.from(sidebarAccessibleCandidateIds ?? []);
  const sidebarCandidatesResult =
    !isAdmin && sidebarCandidateIds.length === 0
      ? { data: [], error: null }
      : isAdmin
        ? await supabase
            .from("candidates")
            .select("id, full_name, current_title, status")
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: true })
        : await supabase
            .from("candidates")
            .select("id, full_name, current_title, status")
            .eq("organization_id", profile.organization_id)
            .in("id", sidebarCandidateIds)
            .order("created_at", { ascending: true });

  if (sidebarCandidatesResult.error) {
    throw new Error(sidebarCandidatesResult.error.message);
  }

  const allowedRoleIds = new Set(accessibleRoleIds);
  const canManageCandidate = isAdmin || mentorAccessibleRoleIds.length > 0;
  const canManageStrengths = isAdmin;
  const primaryConsideration =
    considerations.find((item) => item.is_primary) ??
    considerations[0] ??
    (candidate.target_role_id
      ? {
          candidate_id: candidate.id,
          role_id: candidate.target_role_id,
          is_primary: true,
          status: "active",
        }
      : null);
  const activeRoleId =
    (requestedRoleId && allowedRoleIds.has(requestedRoleId) ? requestedRoleId : null) ??
    (primaryConsideration && allowedRoleIds.has(primaryConsideration.role_id)
      ? primaryConsideration.role_id
      : null) ??
    allowedRoleIds.values().next().value ??
    null;

  const [
    roleResult,
    competenciesResult,
    panelsResult,
    latestReportResult,
    strengthAssessmentsResult,
    projectsResult,
    savedIdeaSetsResult,
    developmentRecordsResult,
  ] =
    activeRoleId
      ? await Promise.all([
          supabase
            .from("roles")
            .select("id, title, description")
            .eq("organization_id", profile.organization_id)
            .eq("id", activeRoleId)
            .maybeSingle(),
          supabase
            .from("role_competencies")
            .select("id, name, target_score, weight")
            .eq("organization_id", profile.organization_id)
            .eq("role_id", activeRoleId)
            .order("created_at", { ascending: true }),
          supabase
            .from("interview_panels")
            .select("id, panel_name, date_completed, created_at")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId),
          supabase
            .from("mentor_reports")
            .select("id, version, created_at, report_json")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("candidate_role_strength_assessments")
            .select("competency_id, strength_score, supporting_strengths, rationale")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId),
          supabase
            .from("development_projects")
            .select(
              "title, description, difficulty, duration_days, industry, applicable_roles, competencies_developed, strengths_leveraged, expected_outcomes, mentor_questions, evidence_of_success",
            )
            .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`),
          supabase
            .from("candidate_generated_mentoring_idea_sets")
            .select(
              "competency_id, ideas_json, selected_idea_title, selected_project_assignment_id, selected_development_record_id, generated_at, updated_at",
            )
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId),
          supabase
            .from("development_records")
            .select("id, mentor_review_date")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId)
            .is("archived_at", null),
        ])
      : [
          { data: null, error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  for (const result of [
    roleResult,
    competenciesResult,
    panelsResult,
    latestReportResult,
    strengthAssessmentsResult,
    projectsResult,
    savedIdeaSetsResult,
  ] as const) {
    if (result.error) {
      if (
        result === savedIdeaSetsResult &&
        isMissingCandidateGeneratedMentoringIdeaSetTableError(result.error)
      ) {
        continue;
      }

      throw new Error(result.error.message);
    }
  }

  const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
  const scoresResult =
    panelIds.length > 0
      ? await supabase
          .from("interview_scores")
          .select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes")
          .in("panel_id", panelIds)
      : { data: [], error: null };

  if (scoresResult.error) {
    throw new Error(scoresResult.error.message);
  }

  const candidate360CyclesResult = isAdmin
    ? await supabase
        .from("review_360_cycles")
        .select("id, title, role_title, status, due_date, created_at")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (candidate360CyclesResult.error) {
    throw new Error(candidate360CyclesResult.error.message);
  }

  const [
    progressPanelsResult,
    progressMentorReportsResult,
    progressDevelopmentRecordsResult,
    progressMatchesResult,
    progressDecisionsResult,
  ] = await Promise.all([
    supabase
      .from("interview_panels")
      .select("id, role_id, panel_name, date_completed, created_at")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidate.id),
    supabase
      .from("mentor_reports")
      .select("created_at")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidate.id),
    supabase
      .from("development_records")
      .select(
        "role_id, status, experience_title, project_summary, date_assigned, updated_at, mentor_review_date",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidate.id)
      .is("archived_at", null),
    supabase
      .from("candidate_role_matches")
      .select("role_id, match_status, created_at")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidate.id),
    supabase
      .from("hiring_decisions")
      .select("role_id, decision, created_at")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidate.id),
  ]);

  for (const result of [
    progressPanelsResult,
    progressMentorReportsResult,
    progressMatchesResult,
    progressDecisionsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const progressDevelopmentRecords = progressDevelopmentRecordsResult.error
    ? isMissingLeadershipDevelopmentRecordTableError(
        progressDevelopmentRecordsResult.error,
      )
      ? []
      : (() => {
          throw new Error(progressDevelopmentRecordsResult.error.message);
        })()
    : (progressDevelopmentRecordsResult.data ?? []);
  const progressPanelIds = (progressPanelsResult.data ?? []).map((panel) => panel.id);
  const progressScoresResult =
    progressPanelIds.length > 0
      ? await supabase
          .from("interview_scores")
          .select("panel_id, score_numeric")
          .in("panel_id", progressPanelIds)
      : { data: [], error: null };

  if (progressScoresResult.error) {
    throw new Error(progressScoresResult.error.message);
  }

  const [latestMatchResult, latestDecisionResult] = activeRoleId
    ? await Promise.all([
        supabase
          .from("candidate_role_matches")
          .select("match_status, created_at")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", candidate.id)
          .eq("role_id", activeRoleId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("hiring_decisions")
          .select("decision, created_at")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", candidate.id)
          .eq("role_id", activeRoleId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
      ];

  if (latestMatchResult.error) {
    throw new Error(latestMatchResult.error.message);
  }
  if (latestDecisionResult.error) {
    throw new Error(latestDecisionResult.error.message);
  }

  const workflowRoleOptions = considerations
    .filter((consideration) => allowedRoleIds.has(consideration.role_id))
    .map((consideration) => ({
      id: consideration.role_id,
      title: canonicalizeRoleTitle(roleMap.get(consideration.role_id)?.title ?? "Role"),
    }));
  const latestStateByRoleId = Object.fromEntries(
    workflowRoleOptions.map((role) => {
      const latestMatch = (progressMatchesResult.data ?? [])
        .filter((match) => match.role_id === role.id)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
      const latestDecision = (progressDecisionsResult.data ?? [])
        .filter((decision) => decision.role_id === role.id)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];

      return [
        role.id,
        {
          match: latestMatch
            ? {
                status: latestMatch.match_status as "match" | "not_yet" | "not_recommended",
                createdAt: latestMatch.created_at,
              }
            : null,
          decision: latestDecision
            ? {
                decision: latestDecision.decision as "hire" | "continue_mentoring" | "decline",
                createdAt: latestDecision.created_at,
              }
            : null,
        },
      ];
    }),
  );

  let developmentRecords = developmentRecordsResult.data ?? [];

  if (developmentRecordsResult.error) {
    if (isMissingLeadershipDevelopmentRecordTableError(developmentRecordsResult.error)) {
      developmentRecords = [];
    } else {
      throw new Error(developmentRecordsResult.error.message);
    }
  }

  const strengthAssessments = (strengthAssessmentsResult.data ?? []).map((assessment) => ({
    competency_id: assessment.competency_id,
    strength_score: Number(assessment.strength_score),
    supporting_strengths: assessment.supporting_strengths as string[],
    rationale: assessment.rationale,
  }));

  const assessments = buildCompetencyAssessments(
    competenciesResult.data ?? [],
    scoresResult.data ?? [],
    strengthAssessments,
  );
  const existingPanels = [...(panelsResult.data ?? [])]
    .sort((left, right) => {
      const leftDate = left.date_completed ?? "";
      const rightDate = right.date_completed ?? "";

      if (leftDate !== rightDate) {
        return rightDate.localeCompare(leftDate);
      }

      const leftCreatedAt = left.created_at ?? "";
      const rightCreatedAt = right.created_at ?? "";

      if (leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt.localeCompare(leftCreatedAt);
      }

      return left.panel_name.localeCompare(right.panel_name);
    })
    .map((panel) => {
      const panelScores = (scoresResult.data ?? []).filter(
        (score) => score.panel_id === panel.id,
      );
      const averageScore =
        panelScores.length > 0
          ? panelScores.reduce((sum, score) => sum + score.score_numeric, 0) /
            panelScores.length
          : null;

      return {
        id: panel.id,
        panelName: panel.panel_name,
        dateCompleted: panel.date_completed,
        createdAt: panel.created_at,
        averageScore: averageScore !== null ? Number(averageScore.toFixed(2)) : null,
        scores: panelScores.map((score) => ({
          competencyId: score.competency_id,
          scoreNumeric: score.score_numeric,
          evidenceNotes: score.evidence_notes,
          concernNotes: score.concern_notes,
        })),
      };
    });
  const readiness = computeOverallReadiness(assessments);
  const roleGoalReadiness = computeRoleGoalReadiness(assessments);
  const roleMatchesWeakestToStrongest =
    buildRoleMatchesWeakestToStrongest(assessments);
  const strengthBuckets = categorizeStrengths(strengthsResult.data ?? []);
  const leverageStrengths = strengthBuckets.primary.map((strength) => strength.theme_name);
  const rankedStrengthThemeNames = (strengthsResult.data ?? []).map(
    (strength) => strength.theme_name,
  );
  const strengthsReferenceResult =
    rankedStrengthThemeNames.length > 0
      ? await supabase
          .from("strengths_library")
          .select(
            "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
          )
          .in("theme_name", rankedStrengthThemeNames)
      : { data: [], error: null };

  if (strengthsReferenceResult.error) {
    throw new Error(strengthsReferenceResult.error.message);
  }

  const developmentProjects = ((projectsResult.data ?? []) as DevelopmentProjectRecord[]).map(
    (project) => ({
      ...project,
      industry: project.industry ?? null,
      applicable_roles: (project.applicable_roles as string[]) ?? [],
      competencies_developed: (project.competencies_developed as string[]) ?? [],
      strengths_leveraged: (project.strengths_leveraged as string[]) ?? [],
      expected_outcomes: (project.expected_outcomes as string[]) ?? [],
      mentor_questions: (project.mentor_questions as string[]) ?? [],
      evidence_of_success: (project.evidence_of_success as string[]) ?? [],
    }),
  );
  const mentoringIdeasByCompetencyId = new Map(
    assessments.map((assessment) => [
      assessment.competencyId,
      rankMentoringIdeasForCompetency(developmentProjects, {
        roleTitle: canonicalizeRoleTitle(roleResult.data?.title ?? null),
        industry: organizationResult.data?.industry ?? null,
        competencyName: assessment.competencyName,
        supportingStrengths: assessment.supportingStrengths,
        leverageStrengths,
        readiness,
      }).slice(0, 4),
    ]),
  );

  const latestReport = (latestReportResult.data?.report_json ??
    null) as MentorReport | null;
  const savedGeneratedIdeasByCompetencyId = new Map(
    (savedIdeaSetsResult.data ?? []).map((row) => {
      const parsedRow = parseCandidateGeneratedMentoringIdeaSetRow({
        competency_id: row.competency_id,
        ideas_json: Array.isArray(row.ideas_json) ? row.ideas_json : [],
        selected_idea_title: row.selected_idea_title,
        selected_project_assignment_id: row.selected_project_assignment_id,
        selected_development_record_id: row.selected_development_record_id,
        generated_at: row.generated_at,
        updated_at: row.updated_at,
      });

      return [parsedRow.competency_id, parsedRow.ideas_json] as const;
    }),
  );
  const mentoringIdeasByCompetencyIdObject = Object.fromEntries(
    Array.from(mentoringIdeasByCompetencyId.entries()),
  );
  const savedGeneratedIdeasByCompetencyIdObject = Object.fromEntries(
    Array.from(savedGeneratedIdeasByCompetencyId.entries()),
  );

  const sourceDocuments = await Promise.all(
    (sourceDocumentsResult.data ?? []).map(async (document) => {
      const signedUrlResult = await admin.storage
        .from(document.storage_bucket || getCandidateSourceDocumentsBucket())
        .createSignedUrl(document.storage_path, 60 * 60);

      return {
        ...document,
        signedUrl: signedUrlResult.data?.signedUrl ?? null,
      };
    }),
  );
  const importedStrengthCount = (strengthsResult.data ?? []).length;
  const readableSourceDocumentCount = (sourceDocumentsResult.data ?? []).filter(
    (document) => (document.extracted_text ?? "").trim().length > 0,
  ).length;
  const topStrengthNames = (strengthsResult.data ?? [])
    .slice(0, 5)
    .map((strength) => strength.theme_name);
  const candidateStrengthsFilesHref = activeRoleId
    ? `/candidates/${candidate.id}?roleId=${activeRoleId}&section=strengths-files`
    : `/candidates/${candidate.id}?section=strengths-files`;
  const preferredActiveRoleMentorProfileId = activeRoleId
    ? displayableMentorAssignments.find(
        (assignment) =>
          assignment.role_id === activeRoleId &&
          assignment.status === "active" &&
          assignment.mentor_profile_id === profile.id,
      )?.mentor_profile_id ??
      displayableMentorAssignments.find(
        (assignment) =>
          assignment.role_id === activeRoleId &&
          assignment.status === "active" &&
          Boolean(assignment.mentor_profile_id),
      )?.mentor_profile_id ??
      null
    : null;
  const activeRoleTitle = canonicalizeRoleTitle(roleResult.data?.title ?? null);
  const hasActiveRoleMentorAssigned =
    activeRoleId !== null &&
    displayableMentorAssignments.some(
      (assignment) =>
        assignment.role_id === activeRoleId && assignment.status === "active",
    );
  const candidateAward = computeCandidateAward({
    readinessPercent: roleGoalReadiness.readinessPercent,
    hasMentorAssigned: hasActiveRoleMentorAssigned,
    hasDevelopmentRecord: developmentRecords.length > 0,
    hasCompletedMentorReview: developmentRecords.some((record) =>
      Boolean(record.mentor_review_date),
    ),
  });
  const progressInterviews = (progressPanelsResult.data ?? []).map((panel) => {
    const panelScores = (progressScoresResult.data ?? []).filter(
      (score) => score.panel_id === panel.id,
    );
    const averageScore =
      panelScores.length > 0
        ? panelScores.reduce((sum, score) => sum + score.score_numeric, 0) /
          panelScores.length
        : null;

    return {
      roleId: panel.role_id,
      panelName: panel.panel_name,
      occurredAt: panel.date_completed ?? panel.created_at,
      averageScore:
        averageScore === null ? null : Number(averageScore.toFixed(2)),
    };
  });
  const progressDecisionEvents = (progressDecisionsResult.data ?? []).map(
    (decision) => ({
      occurredAt: decision.created_at,
      label: "Leadership decision recorded",
      detail: `${roleMap.get(decision.role_id)?.title ?? "Role"} · ${decision.decision.replaceAll("_", " ")}.`,
    }),
  );
  const progressEvents = [
    ...progressInterviews.map((interview) => ({
      occurredAt: interview.occurredAt,
      label: "Interview completed",
      detail: `${interview.panelName} for ${roleMap.get(interview.roleId)?.title ?? "a role"}${interview.averageScore === null ? "" : ` · average score ${interview.averageScore.toFixed(1)} / 5`}.`,
    })),
    ...progressDevelopmentRecords.map((record) => ({
      occurredAt: record.updated_at ?? record.date_assigned,
      label: "Development record updated",
      detail: `${roleMap.get(record.role_id)?.title ?? "Role"} · ${record.status.replaceAll("_", " ")}${record.mentor_review_date ? " · mentor review completed" : ""}.`,
    })),
    ...(progressMentorReportsResult.data ?? []).map((report) => ({
      occurredAt: report.created_at,
      label: "Mentor report generated",
      detail: "Mentor observations and readiness recommendations were recorded.",
    })),
    ...(progressMatchesResult.data ?? []).map((match) => ({
      occurredAt: match.created_at,
      label: "Role-match assessment recorded",
      detail: `${roleMap.get(match.role_id)?.title ?? "Role"} · ${match.match_status.replaceAll("_", " ")}.`,
    })),
    ...progressDecisionEvents,
  ].filter((event) => Boolean(event.occurredAt));
  return (
    <main className="app-page">
      <div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <CandidateSelectorSidebar
            candidates={(sidebarCandidatesResult.data ?? []).map((sidebarCandidate) => ({
              id: sidebarCandidate.id,
              fullName: sidebarCandidate.full_name,
              currentTitle: sidebarCandidate.current_title,
              status: sidebarCandidate.status,
            }))}
            selectedCandidateId={candidate.id}
            selectedCandidateName={candidate.full_name}
            currentSectionId={requestedSection ?? "candidate-profile"}
            canCreateCandidates={isAdmin}
          />

          <div className="min-w-0">
            <CandidateDetailSectionMenu
              initialSectionId={requestedSection}
              sections={[
            {
              id: "candidate-profile",
              label: "Candidate Profile",
              summary:
                "Keep the candidate's position, assessments, 360 reviews, and strengths evidence together in one profile.",
              includeSectionIds: ["interview-scores", "360-reviews", "strengths-files"],
              content: (
                <section className="grid gap-6">
                  {isAdmin ? (
                    <CandidateRoleConsiderationManager
                      candidateId={candidate.id}
                      candidateName={candidate.full_name}
                      roles={(rolesResult.data ?? []).map((role) => ({
                        id: role.id,
                        title: canonicalizeRoleTitle(role.title),
                      }))}
                      considerations={considerations.map((consideration) => {
                        const role = roleMap.get(consideration.role_id);
                        const mentorNames = Array.from(
                          new Set(
                            displayableMentorAssignments
                              .filter(
                                (assignment) =>
                                  assignment.role_id === consideration.role_id,
                              )
                              .map(
                                (assignment) =>
                                  mentorMap.get(assignment.mentor_profile_id)?.full_name,
                              )
                              .filter(Boolean),
                          ),
                        ) as string[];

                        return {
                          roleId: consideration.role_id,
                          roleTitle: role?.title ?? "Unknown role",
                          status:
                            consideration.status === "on_hold"
                              ? ("on_hold" as const)
                              : ("active" as const),
                          isPrimary: consideration.is_primary,
                          mentorNames,
                        };
                      })}
                      currentRoleId={candidate.current_role_id}
                    />
                  ) : null}

                  {isAdmin && activeRoleId ? (
                    <CandidateWorkflowStateManager
                      candidateId={candidate.id}
                      roleId={activeRoleId}
                      roleOptions={workflowRoleOptions}
                      readinessScore={roleGoalReadiness.readinessPercent}
                      readinessRoleId={activeRoleId}
                      latestStateByRoleId={latestStateByRoleId}
                      latestMatch={
                        latestMatchResult.data
                          ? {
                              status: latestMatchResult.data.match_status as "match" | "not_yet" | "not_recommended",
                              createdAt: latestMatchResult.data.created_at,
                            }
                          : null
                      }
                      latestDecision={
                        latestDecisionResult.data
                          ? {
                              decision: latestDecisionResult.data.decision as "hire" | "continue_mentoring" | "decline",
                              createdAt: latestDecisionResult.data.created_at,
                            }
                          : null
                      }
                    />
                  ) : null}

                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Roles Under Consideration
                    </p>
                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                      {considerations.length > 0 ? (
                        considerations
                          .filter((item) => allowedRoleIds.has(item.role_id))
                          .map((consideration) => {
                            const role = roleMap.get(consideration.role_id);
                            const assignedMentors = Array.from(
                              new Set(
                                displayableMentorAssignments
                                  .filter(
                                    (assignment) =>
                                      assignment.role_id === consideration.role_id,
                                  )
                                  .map(
                                    (assignment) =>
                                      mentorMap.get(assignment.mentor_profile_id)?.full_name,
                                  )
                                  .filter(Boolean),
                              ),
                            );

                            return (
                              <Link
                                key={consideration.role_id}
                                href={`/candidates/${candidate.id}?roleId=${consideration.role_id}`}
                                className={`rounded-3xl border p-5 text-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${
                                  activeRoleId === consideration.role_id
                                    ? "border-teal-300 bg-teal-50"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="font-semibold text-slate-900">
                                    {role?.title ?? "Unknown role"}
                                  </p>
                                  {consideration.is_primary ? (
                                    <span className="rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-teal-900 uppercase">
                                      Primary
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-slate-600">
                                  Status: {getConsiderationStatusLabel(consideration.status)}
                                </p>
                                <p className="mt-2 text-slate-600">
                                  Mentors:{" "}
                                  {assignedMentors.length > 0
                                    ? assignedMentors.join(", ")
                                    : "Not assigned"}
                                </p>
                              </Link>
                            );
                          })
                      ) : (
                        <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600 lg:col-span-3">
                          No role considerations are attached to this candidate yet.
                        </article>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Active Mentors for This Role
                    </p>
                    <div className="mt-6 grid gap-3">
                      {activeRoleId &&
                      displayableMentorAssignments.filter(
                        (assignment) => assignment.role_id === activeRoleId,
                      ).length > 0 ? (
                        displayableMentorAssignments
                          .filter((assignment) => assignment.role_id === activeRoleId)
                          .map((assignment) => {
                            const mentor = mentorMap.get(assignment.mentor_profile_id);

                            return (
                              <article
                                key={`${assignment.role_id}-${assignment.mentor_profile_id}`}
                                className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700"
                              >
                                <p className="font-semibold text-slate-900">
                                  {mentor?.full_name}
                                </p>
                                <p className="mt-1 text-slate-600">
                                  {mentor?.position_title ?? "Position not entered"}
                                </p>
                                <p className="mt-1 text-slate-600">
                                  Start date: {assignment.start_date || "Not set"}
                                </p>
                              </article>
                            );
                          })
                      ) : (
                        <p className="text-sm leading-7 text-slate-600">
                          No mentors are assigned to this candidate for the selected
                          role yet.
                        </p>
                      )}
                    </div>
                  </section>
                </section>
              ),
            },
            {
              id: "progress-report",
              label: "Progress Report",
              summary:
                "Review year-to-date, program-to-date, and annual evidence of growth for this candidate.",
              content: (
                <CandidateProgressReport
                  candidateId={candidate.id}
                  candidateName={candidate.full_name}
                  roles={considerations
                    .filter((consideration) => allowedRoleIds.has(consideration.role_id))
                    .map((consideration) => ({
                      roleId: consideration.role_id,
                      roleTitle:
                        roleMap.get(consideration.role_id)?.title ?? "Unknown role",
                      status:
                        consideration.status === "on_hold" ? "on_hold" : "active",
                      isPrimary: consideration.is_primary,
                    }))}
                  interviews={progressInterviews}
                  developmentRecords={progressDevelopmentRecords.map((record) => ({
                    roleId: record.role_id,
                    roleTitle: roleMap.get(record.role_id)?.title ?? "Unknown role",
                    title: record.experience_title,
                    summary: record.project_summary,
                    status: record.status,
                    occurredAt: record.updated_at ?? record.date_assigned,
                    mentorReviewed: Boolean(record.mentor_review_date),
                  }))}
                  mentorReportDates={(progressMentorReportsResult.data ?? []).map(
                    (report) => report.created_at,
                  )}
                  events={progressEvents}
                  decisionEvents={progressDecisionEvents}
                />
              ),
            },
            {
              id: "interview-scores",
              label: "Interview Scores",
              summary:
                "Enter interviewer feedback, save decimal scores, and adjust target scores for each competency.",
              parentSectionId: "candidate-profile",
              content: (
                <InterviewScoreEntryPanel
                  candidateId={candidate.id}
                  roleId={activeRoleId}
                  roleTitle={activeRoleTitle || null}
                  readOnly={!canManageCandidate}
                  canEditTargetScores={canManageCandidate}
                  competencies={(competenciesResult.data ?? []).map((competency) => ({
                    id: competency.id,
                    name: competency.name,
                    targetScore: competency.target_score,
                  }))}
                  existingPanels={existingPanels}
                />
              ),
            },
            {
              id: "360-reviews",
              label: "360 Reviews",
              summary:
                "Create and manage confidential current-role feedback for this candidate.",
              parentSectionId: "candidate-profile",
              content: (
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                        360 Reviews
                      </p>
                      <h2 className="mt-3 font-display text-3xl text-slate-900">
                        Confidential feedback for the current role
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        Launch a review when this candidate has a current organizational role. Results remain confidential and are distinct from succession readiness.
                      </p>
                    </div>
                    {isAdmin ? (
                      <Link
                        href={`/360-review?candidateId=${candidate.id}`}
                        className="interactive-contrast shrink-0 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                      >
                        Start or manage 360 reviews
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-3">
                    {(candidate360CyclesResult.data ?? []).length > 0 ? (
                      (candidate360CyclesResult.data ?? []).map((cycle) => (
                        <article
                          key={cycle.id}
                          className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{cycle.title}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {cycle.role_title} · {cycle.status.replaceAll("_", " ")}
                              {cycle.due_date ? ` · Due ${cycle.due_date}` : ""}
                            </p>
                          </div>
                          <Link
                            href={`/360-review/${cycle.id}`}
                            className="text-sm font-semibold text-teal-800 transition hover:text-teal-950"
                          >
                            Manage review
                          </Link>
                        </article>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-600">
                        No 360 reviews have been created for this candidate yet.
                      </p>
                    )}
                  </div>
                </section>
              ),
            },
            {
              id: "strengths-files",
              label: "Strengths Files",
              summary:
                "Upload Gallup documents, review archived source files, and confirm whether readable strengths text is on record.",
              parentSectionId: "candidate-profile",
              content: (
                <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  {canManageStrengths ? (
                    <CandidateStrengthsUploadCard
                      candidateId={candidate.id}
                      candidateName={candidate.full_name}
                      importedStrengthCount={importedStrengthCount}
                      readableDocumentCount={readableSourceDocumentCount}
                      sourceDocumentCount={sourceDocuments.length}
                      topStrengthNames={topStrengthNames}
                    />
                  ) : (
                    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                        Strengths Documents
                      </p>
                      <h2 className="mt-3 font-display text-3xl text-slate-900">
                        Gallup files are managed by organization administrators
                      </h2>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                        Archived Gallup documents remain visible here, but only
                        organization administrators can upload new strengths files or
                        reimport them into this candidate record.
                      </p>
                    </section>
                  )}

                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Archived Files
                    </p>
                    <h2 className="mt-3 font-display text-3xl text-slate-900">
                      Keep the Gallup source documents in view
                    </h2>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                      Every uploaded Gallup file stays attached to this candidate so
                      strengths can be reimported later if a stronger text-based
                      report becomes available.
                    </p>

                    <div className="mt-6 grid gap-4">
                      {sourceDocuments.length > 0 ? (
                        sourceDocuments.map((document) => (
                          <article
                            key={document.id}
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900">
                                {document.file_name}
                              </p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
                                {(document.extracted_text ?? "").trim().length > 0
                                  ? "Readable text"
                                  : "Archive only"}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-600">
                              <p>
                                {document.file_extension?.toUpperCase() ?? "File"}{" "}
                                {document.file_size_bytes
                                  ? `• ${formatFileSize(document.file_size_bytes)}`
                                  : ""}
                              </p>
                              <p>
                                Added{" "}
                                {new Intl.DateTimeFormat("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }).format(new Date(document.created_at))}
                              </p>
                            </div>
                            {document.signedUrl ? (
                              <div className="mt-4">
                                <Link
                                  href={document.signedUrl}
                                  target="_blank"
                                  className="text-sm font-semibold text-teal-800 transition hover:text-teal-900"
                                >
                                  Open archived file
                                </Link>
                              </div>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                          No Gallup files are attached to this candidate yet.
                        </article>
                      )}
                    </div>
                  </section>
                </section>
              ),
            },
            {
              id: "role-fit",
              label: "Role Fit",
              summary:
                "Focus on the candidate’s role-fit competencies, top 5 strengths, and next 10 strengths one insight at a time.",
              content: (
                <section className="grid gap-6">
                  <section className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
                          Gallup Files
                        </p>
                        <h2 className="mt-3 font-display text-3xl text-[#183822]">
                          Keep strengths documents in view while reviewing role fit
                        </h2>
                        {importedStrengthCount > 0 ? (
                          <>
                            <p className="mt-4 text-sm leading-7 text-[#24512f]">
                              Gallup files are uploaded and {importedStrengthCount}{" "}
                              strengths are already available for this candidate.
                            </p>
                            {topStrengthNames.length > 0 ? (
                              <p className="mt-3 text-sm leading-7 text-[#24512f]">
                                Current top strengths: {topStrengthNames.join(", ")}.
                              </p>
                            ) : null}
                          </>
                        ) : sourceDocuments.length > 0 ? (
                          <>
                            <p className="mt-4 text-sm leading-7 text-[#24512f]">
                              Gallup files are on record for this candidate, but
                              strengths are not visible in the system yet.
                            </p>
                            <p className="mt-3 text-sm leading-7 text-[#486454]">
                              {readableSourceDocumentCount > 0
                                ? "At least one archived file has readable text, so you can open Strengths Files to retry the import."
                                : "The saved files do not currently contain machine-readable text, so a text-based Gallup file is still needed for strengths import."}
                            </p>
                          </>
                        ) : (
                          <p className="mt-4 text-sm leading-7 text-[#24512f]">
                            No Gallup files have been uploaded for this candidate
                            yet. Add them in Strengths Files so the role-fit view can
                            reflect the candidate&apos;s imported strengths.
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-[13rem] flex-col items-start gap-3">
                        <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#24512f] shadow-[inset_0_0_0_1px_rgba(82,140,94,0.18)]">
                          {importedStrengthCount > 0
                            ? "Uploaded"
                            : sourceDocuments.length > 0
                              ? "Files on record"
                              : "Not uploaded yet"}
                        </span>
                        <Link
                          href={candidateStrengthsFilesHref}
                          className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                        >
                          Open Strengths Files
                        </Link>
                      </div>
                    </div>
                  </section>

                  <CandidateInsightExplorer
                    assessments={assessments.map((assessment) => ({
                      ...assessment,
                      mentoringIdeas:
                        mentoringIdeasByCompetencyId.get(assessment.competencyId) ?? [],
                    }))}
                    strengths={strengthsResult.data ?? []}
                    references={strengthsReferenceResult.data ?? []}
                    canGenerateCandidateIdeas={
                      canManageCandidate && canGenerateReport && Boolean(activeRoleId)
                    }
                    candidateId={candidate.id}
                    candidateName={candidate.full_name}
                    roleId={activeRoleId ?? undefined}
                    mentorProfileId={preferredActiveRoleMentorProfileId ?? undefined}
                    savedGeneratedIdeasByCompetencyId={
                      savedGeneratedIdeasByCompetencyIdObject
                    }
                    award={candidateAward}
                  />
                </section>
              ),
            },
            {
              id: "mentor-report",
              label: "Mentor Report",
              summary:
                "Review the latest mentor-facing narrative, including strongest matches and development priorities.",
              content: (
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                        Mentor Report
                      </p>
                      <h2 className="mt-2 font-display text-4xl text-slate-900">
                        Latest mentor-facing development narrative
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        This report is built from the candidate&apos;s current
                        strengths data and the latest average interview scores saved
                        across the selected role&apos;s competencies.
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 md:items-end">
                      {latestReportResult.data ? (
                        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                          Version {latestReportResult.data.version}
                        </span>
                      ) : null}
                      {canManageCandidate ? (
                        <GenerateMentorReportButton
                          candidateId={candidate.id}
                          roleId={activeRoleId}
                          disabled={!canGenerateReport}
                          hasExistingReport={Boolean(latestReportResult.data)}
                        />
                      ) : (
                        <p className="max-w-sm text-sm leading-7 text-slate-600">
                          Assigned mentors and organization administrators can
                          refresh this report when new development information is
                          available.
                        </p>
                      )}
                    </div>
                  </div>

                  {latestReport ? (
                    <div className="mt-8 grid gap-6">
                      <article className="rounded-3xl bg-slate-50 p-6">
                        <h3 className="text-xl font-semibold text-slate-900">
                          Executive Summary
                        </h3>
                        <p className="mt-4 text-sm leading-7 text-slate-700">
                          {sanitizeAppText(latestReport.executive_summary)}
                        </p>
                      </article>

                      <MentorReportMatchExplorer
                        matches={roleMatchesWeakestToStrongest}
                        developmentPriorities={latestReport.development_priorities}
                        strengthsToLeverage={latestReport.strengths_to_leverage}
                        assessments={assessments}
                        libraryIdeasByCompetencyId={mentoringIdeasByCompetencyIdObject}
                        savedGeneratedIdeasByCompetencyId={
                          savedGeneratedIdeasByCompetencyIdObject
                        }
                        candidateId={candidate.id}
                        candidateName={candidate.full_name}
                        roleId={activeRoleId}
                        mentorProfileId={
                          preferredActiveRoleMentorProfileId ?? undefined
                        }
                        canGenerateCandidateIdeas={
                          canManageCandidate &&
                          canGenerateReport &&
                          Boolean(activeRoleId)
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                      No mentor report has been generated yet for this candidate and
                      role combination.
                    </div>
                  )}
                </section>
              ),
            },
              ]}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
