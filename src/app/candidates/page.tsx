import Link from "next/link";
import { CandidateFlowPanel } from "@/components/candidate-flow-panel";
import { CandidateFocusSelector } from "@/components/candidate-focus-selector";
import { CandidateManagementPanel } from "@/components/candidate-management-panel";
import {
  buildCompetencyAssessments,
  computeOverallReadiness,
} from "@/lib/fit-analysis";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requireWorkspaceProfile } from "@/lib/workspace";

type CandidatesPageProps = {
  searchParams: Promise<{
    candidateId?: string;
    mode?: string;
  }>;
};

export default async function CandidatesPage({
  searchParams,
}: CandidatesPageProps) {
  const { candidateId: requestedCandidateId, mode: requestedMode } =
    await searchParams;
  const { profile, supabase } = await requireWorkspaceProfile();
  const [
    candidatesResult,
    rolesResult,
    strengthsResult,
    competenciesResult,
    panelsResult,
    scoresResult,
    considerationsResult,
    mentorAssignmentsResult,
    strengthAssessmentsResult,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, current_title, target_role_id, status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("roles")
      .select("id, title")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("candidate_strengths")
      .select("candidate_id, theme_name, rank, domain")
      .eq("organization_id", profile.organization_id)
      .order("rank", { ascending: true }),
    supabase
      .from("role_competencies")
      .select("id, role_id, name, target_score, weight")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("interview_panels")
      .select("id, candidate_id, role_id")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("interview_scores")
      .select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("candidate_role_considerations")
      .select("candidate_id, role_id, is_primary")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("candidate_role_strength_assessments")
      .select("candidate_id, role_id, competency_id, strength_score, supporting_strengths, rationale")
      .eq("organization_id", profile.organization_id),
  ]);

  for (const result of [
    candidatesResult,
    rolesResult,
    strengthsResult,
    competenciesResult,
    panelsResult,
    scoresResult,
    considerationsResult,
    mentorAssignmentsResult,
    strengthAssessmentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const roleMap = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
  const strengthsByCandidate = new Map<string, typeof strengthsResult.data>();
  const panelIdsByCandidateAndRole = new Map<string, string[]>();
  const considerationsByCandidate = new Map<
    string,
    { candidate_id: string; role_id: string; is_primary: boolean }[]
  >();
  const mentorAssignmentsByCandidate = new Map<
    string,
    { candidate_id: string; role_id: string; mentor_profile_id: string }[]
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

  const accessibleCandidateIds = isAdminAppRole(profile.role)
    ? null
    : new Set(
        (mentorAssignmentsResult.data ?? [])
          .filter((assignment) => assignment.mentor_profile_id === profile.id)
          .map((assignment) => assignment.candidate_id),
      );

  const visibleCandidates = (candidatesResult.data ?? []).filter((candidate) =>
    accessibleCandidateIds ? accessibleCandidateIds.has(candidate.id) : true,
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
    const topGap = assessments[0];

    return {
      id: candidate.id,
      fullName: candidate.full_name,
      currentTitle: candidate.current_title,
      primaryRoleTitle: primaryRole?.title ?? "No target role yet",
      primaryRoleId: primaryRole?.id ?? null,
      status: candidate.status,
      readiness,
      topGap: topGap?.competencyName ?? "None",
    };
  });

  const selectedMode: "flow" | "create" =
    requestedMode === "create" ? "create" : "flow";
  const selectedCandidateId =
    requestedCandidateId &&
    candidateSummaries.some((candidate) => candidate.id === requestedCandidateId)
      ? requestedCandidateId
      : null;
  const canCreateCandidates = isAdminAppRole(profile.role);

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <CandidateFocusSelector
            candidates={candidateSummaries.map((candidate) => ({
              id: candidate.id,
              fullName: candidate.fullName,
            }))}
            selectedCandidateId={selectedCandidateId}
            selectedMode={selectedMode}
            canCreateCandidates={canCreateCandidates}
          />

          <div className="grid gap-6">
            {selectedMode === "create" && canCreateCandidates ? (
              <CandidateManagementPanel
                roles={(rolesResult.data ?? []).map((role) => ({
                  id: role.id,
                  title: role.title,
                }))}
                showPipelineHeader
              />
            ) : (
              <CandidateFlowPanel
                candidates={candidateSummaries.map((candidate) => ({
                  id: candidate.id,
                  fullName: candidate.fullName,
                  currentTitle: candidate.currentTitle,
                  primaryRoleTitle: candidate.primaryRoleTitle,
                  primaryRoleId: candidate.primaryRoleId,
                  readiness: candidate.readiness,
                }))}
                selectedCandidateId={selectedCandidateId}
                canCreateCandidates={canCreateCandidates}
              />
            )}

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Candidates In The System
              </p>
              <h2 className="mt-3 font-display text-3xl text-slate-900">
                Candidate list and scores
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Open any candidate to go deeper, upload Gallup strengths documents,
                and review the full role-fit and mentor report workflow.
              </p>

              {candidateSummaries.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                  {canCreateCandidates
                    ? "No candidates exist yet in this workspace. Create one on the left to begin."
                    : "No candidates are assigned to you yet for mentoring."}
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                  <div className="hidden grid-cols-[1.3fr_1.1fr_0.8fr_1fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase md:grid">
                    <span>Candidate</span>
                    <span>Role</span>
                    <span>Readiness</span>
                    <span>Biggest Gap</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {candidateSummaries.map((candidate) => (
                      <Link
                        key={candidate.id}
                        href={`/candidates/${candidate.id}`}
                        className="block transition hover:bg-slate-50"
                      >
                        <div className="grid gap-2 px-4 py-4 md:grid-cols-[1.3fr_1.1fr_0.8fr_1fr_0.8fr] md:items-center md:gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {candidate.fullName}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {candidate.currentTitle}
                            </p>
                          </div>
                          <p className="truncate text-sm text-slate-700">
                            {candidate.primaryRoleTitle}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {candidate.readiness.toFixed(2)} / 5
                          </p>
                          <p className="truncate text-sm text-slate-700">
                            {candidate.topGap}
                          </p>
                          <p className="text-sm text-slate-700 capitalize">
                            {candidate.status.replaceAll("_", " ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
