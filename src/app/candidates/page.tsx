import { CandidateManagementPanel } from "@/components/candidate-management-panel";
import { CandidateSelectorSidebar } from "@/components/candidate-selector-sidebar";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";
import {
  buildCompetencyAssessments,
  computeOverallReadiness,
  computeRoleGoalReadiness,
} from "@/lib/fit-analysis";
import { computeCandidateAward } from "@/lib/candidate-awards";
import { isMissingLeadershipDevelopmentRecordTableError } from "@/lib/leadership-development-record";
import { getAccessibleCandidateIds, isAdminAppRole } from "@/lib/mentor-access";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

export default async function CandidatesPage() {
  const { account, profile, supabase } = await requirePaidWorkspaceProfile();
  const isAdmin = isAdminAppRole(profile.role);
  const accessibleCandidateIds = new Set<string>();

  if (account?.is_candidate && account.candidate_id) {
    accessibleCandidateIds.add(account.candidate_id);
  }

  const mentorAssignmentsAccessResult = isAdmin
    ? { data: [], error: null }
    : await supabase
        .from("mentor_role_assignments")
        .select("candidate_id, role_id, mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("mentor_profile_id", profile.id);

  if (mentorAssignmentsAccessResult.error) {
    throw new Error(mentorAssignmentsAccessResult.error.message);
  }

  const mentorAssignmentsForAccess = mentorAssignmentsAccessResult.data ?? [];
  const resolvedAccessibleCandidateIds = getAccessibleCandidateIds({
    profile,
    account,
    mentorAssignments: mentorAssignmentsForAccess,
  });

  for (const candidateId of resolvedAccessibleCandidateIds ?? []) {
    accessibleCandidateIds.add(candidateId);
  }

  const candidateIdFilter = Array.from(accessibleCandidateIds);

  const candidatesResult =
    !isAdmin && candidateIdFilter.length === 0
      ? { data: [], error: null }
      : isAdmin
        ? await supabase
            .from("candidates")
            .select("id, full_name, current_title, target_role_id, status")
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: true })
        : await supabase
            .from("candidates")
            .select("id, full_name, current_title, target_role_id, status")
            .eq("organization_id", profile.organization_id)
            .in("id", candidateIdFilter)
            .order("created_at", { ascending: true });

  if (candidatesResult.error) {
    throw new Error(candidatesResult.error.message);
  }

  const visibleCandidateIds = (candidatesResult.data ?? []).map(
    (candidate) => candidate.id,
  );
  const hasVisibleCandidates = visibleCandidateIds.length > 0;

  const [
    rolesResult,
    strengthsResult,
    considerationsResult,
    mentorAssignmentsResult,
    panelsResult,
    strengthAssessmentsResult,
    developmentRecordsResult,
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id, title")
      .eq("organization_id", profile.organization_id),
    hasVisibleCandidates
      ? supabase
          .from("candidate_strengths")
          .select("candidate_id, theme_name, rank, domain")
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
          .order("rank", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    hasVisibleCandidates
      ? supabase
          .from("candidate_role_considerations")
          .select("candidate_id, role_id, is_primary")
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    hasVisibleCandidates
      ? supabase
          .from("mentor_role_assignments")
          .select("candidate_id, role_id, mentor_profile_id, status")
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    hasVisibleCandidates
      ? supabase
          .from("interview_panels")
          .select("id, candidate_id, role_id")
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    hasVisibleCandidates
      ? supabase
          .from("candidate_role_strength_assessments")
          .select(
            "candidate_id, role_id, competency_id, strength_score, supporting_strengths, rationale",
          )
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
      : Promise.resolve({ data: [], error: null }),
    hasVisibleCandidates
      ? supabase
          .from("development_records")
          .select("candidate_id, role_id, mentor_review_date")
          .eq("organization_id", profile.organization_id)
          .in("candidate_id", visibleCandidateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [
    rolesResult,
    strengthsResult,
    considerationsResult,
    mentorAssignmentsResult,
    panelsResult,
    strengthAssessmentsResult,
  ] as const) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  let developmentRecords = developmentRecordsResult.data ?? [];

  if (developmentRecordsResult.error) {
    if (isMissingLeadershipDevelopmentRecordTableError(developmentRecordsResult.error)) {
      developmentRecords = [];
    } else {
      throw new Error(developmentRecordsResult.error.message);
    }
  }

  const relevantRoleIds = Array.from(
    new Set([
      ...((candidatesResult.data ?? [])
        .map((candidate) => candidate.target_role_id)
        .filter(Boolean) as string[]),
      ...((considerationsResult.data ?? []).map((item) => item.role_id) as string[]),
      ...((mentorAssignmentsResult.data ?? []).map((item) => item.role_id) as string[]),
      ...((panelsResult.data ?? []).map((item) => item.role_id) as string[]),
      ...((strengthAssessmentsResult.data ?? []).map((item) => item.role_id) as string[]),
    ]),
  );

  const competenciesResult =
    relevantRoleIds.length > 0
      ? await supabase
          .from("role_competencies")
          .select("id, role_id, name, target_score, weight")
          .eq("organization_id", profile.organization_id)
          .in("role_id", relevantRoleIds)
      : { data: [], error: null };

  if (competenciesResult.error) {
    throw new Error(competenciesResult.error.message);
  }

  const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
  const scoresResult =
    panelIds.length > 0
      ? await supabase
          .from("interview_scores")
          .select(
            "panel_id, competency_id, score_numeric, evidence_notes, concern_notes",
          )
          .in("panel_id", panelIds)
      : { data: [], error: null };

  if (scoresResult.error) {
    throw new Error(scoresResult.error.message);
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
  const strengthsByCandidate = new Map<string, typeof strengthsResult.data>();
  const panelIdsByCandidateAndRole = new Map<string, string[]>();
  const considerationsByCandidate = new Map<
    string,
    { candidate_id: string; role_id: string; is_primary: boolean }[]
  >();
  const mentorAssignmentsByCandidate = new Map<
    string,
    {
      candidate_id: string;
      role_id: string;
      mentor_profile_id: string;
      status: string | null;
    }[]
  >();
  const developmentRecordsByCandidateAndRole = new Map<
    string,
    { candidate_id: string; role_id: string; mentor_review_date: string | null }[]
  >();
  const strengthAssessmentsByCandidateAndRole = new Map<
    string,
    {
      candidate_id: string;
      role_id: string;
      competency_id: string;
      strength_score: number;
      supporting_strengths: string[] | null;
      rationale: string | null;
    }[]
  >();

  for (const strength of strengthsResult.data ?? []) {
    const current = strengthsByCandidate.get(strength.candidate_id) ?? [];
    current.push(strength);
    strengthsByCandidate.set(strength.candidate_id, current);
  }

  for (const panel of panelsResult.data ?? []) {
    const key = `${panel.candidate_id}:${panel.role_id}`;
    const current = panelIdsByCandidateAndRole.get(key) ?? [];
    current.push(panel.id);
    panelIdsByCandidateAndRole.set(key, current);
  }

  for (const consideration of considerationsResult.data ?? []) {
    const current = considerationsByCandidate.get(consideration.candidate_id) ?? [];
    current.push(consideration);
    considerationsByCandidate.set(consideration.candidate_id, current);
  }

  for (const assignment of mentorAssignmentsResult.data ?? []) {
    const current = mentorAssignmentsByCandidate.get(assignment.candidate_id) ?? [];
    current.push(assignment);
    mentorAssignmentsByCandidate.set(assignment.candidate_id, current);
  }

  for (const record of developmentRecords) {
    const key = `${record.candidate_id}:${record.role_id}`;
    const current = developmentRecordsByCandidateAndRole.get(key) ?? [];
    current.push(record);
    developmentRecordsByCandidateAndRole.set(key, current);
  }

  for (const assessment of strengthAssessmentsResult.data ?? []) {
    const key = `${assessment.candidate_id}:${assessment.role_id}`;
    const current = strengthAssessmentsByCandidateAndRole.get(key) ?? [];
    current.push({
      ...assessment,
      strength_score: Number(assessment.strength_score),
      supporting_strengths: assessment.supporting_strengths as string[] | null,
    });
    strengthAssessmentsByCandidateAndRole.set(key, current);
  }

  const visibleCandidates = (candidatesResult.data ?? []).filter((candidate) =>
    resolvedAccessibleCandidateIds
      ? resolvedAccessibleCandidateIds.has(candidate.id)
      : true,
  );

  const candidateSummaries = visibleCandidates.map((candidate) => {
    const consideredRoles = considerationsByCandidate.get(candidate.id) ?? [];
    const primaryConsideration =
      consideredRoles.find((item) => item.is_primary) ??
      consideredRoles[0] ??
      (candidate.target_role_id
        ? {
            candidate_id: candidate.id,
            role_id: candidate.target_role_id,
            is_primary: true,
          }
        : null);
    const primaryRole = primaryConsideration
      ? roleMap.get(primaryConsideration.role_id)
      : null;
    const competencies = primaryConsideration
      ? (competenciesResult.data ?? []).filter(
          (competency) => competency.role_id === primaryConsideration.role_id,
        )
      : [];
    const panelIds = primaryConsideration
      ? panelIdsByCandidateAndRole.get(
          `${candidate.id}:${primaryConsideration.role_id}`,
        ) ?? []
      : [];
    const candidateScores = (scoresResult.data ?? []).filter((score) =>
      panelIds.includes(score.panel_id),
    );
    const strengthAssessments = primaryConsideration
      ? strengthAssessmentsByCandidateAndRole.get(
          `${candidate.id}:${primaryConsideration.role_id}`,
        ) ?? []
      : [];
    const assessments = buildCompetencyAssessments(
      competencies,
      candidateScores,
      strengthAssessments,
    );
    const readiness = computeOverallReadiness(assessments);
    const roleGoalReadiness = computeRoleGoalReadiness(assessments);
    const mentorAssignments =
      mentorAssignmentsByCandidate.get(candidate.id)?.filter(
        (assignment) =>
          primaryConsideration &&
          assignment.role_id === primaryConsideration.role_id &&
          assignment.status === "active",
      ) ?? [];
    const roleDevelopmentRecords = primaryConsideration
      ? developmentRecordsByCandidateAndRole.get(
          `${candidate.id}:${primaryConsideration.role_id}`,
        ) ?? []
      : [];
    const award = computeCandidateAward({
      readinessPercent: roleGoalReadiness.readinessPercent,
      hasMentorAssigned: mentorAssignments.length > 0,
      hasDevelopmentRecord: roleDevelopmentRecords.length > 0,
      hasCompletedMentorReview: roleDevelopmentRecords.some((record) =>
        Boolean(record.mentor_review_date),
      ),
    });
    const topGap = assessments[0];

    return {
      id: candidate.id,
      fullName: getCandidateDisplayName(candidate.full_name),
      currentTitle: candidate.current_title,
      primaryRoleTitle: primaryRole?.title ?? "No target role yet",
      primaryRoleId: primaryRole?.id ?? null,
      status: candidate.status,
      readiness,
      roleGoalReadinessPercent: roleGoalReadiness.readinessPercent,
      award,
      topGap: topGap?.competencyName ?? "None",
    };
  });

  const selectedMode = "create" as const;
  const canCreateCandidates = isAdmin;

  return (
    <main className="app-page">
      <div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <CandidateSelectorSidebar
            candidates={candidateSummaries.map((candidate) => ({
              id: candidate.id,
              fullName: candidate.fullName,
              currentTitle: candidate.currentTitle,
              status: candidate.status,
            }))}
            canCreateCandidates={canCreateCandidates}
            isCreatingCandidate={selectedMode === "create"}
          />

          <div className="grid min-w-0 gap-6">
            {canCreateCandidates ? (
              <>
                <section className="theme-panel-strong rounded-[2rem] p-8">
                  <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                    Candidate Pipeline
                  </p>
                  <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
                    Build Your Leadership Bench
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                    Add a candidate, capture their current role and target role, then
                    use their workspace to review role context, interview scores,
                    strengths, role fit, and mentor reporting.
                  </p>
                </section>
              <CandidateManagementPanel
                roles={(rolesResult.data ?? []).map((role) => ({
                  id: role.id,
                  title: role.title,
                }))}
              />
              </>
            ) : (
              <section className="theme-panel-strong rounded-[2rem] p-8">
                <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                  Candidate Workspace
                </p>
                <h1 className="mt-3 font-display text-4xl text-slate-900">
                  Select a candidate to begin
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  Choose a candidate from the left to review their role context,
                  interview scores, strengths, role fit, and mentor report.
                </p>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
