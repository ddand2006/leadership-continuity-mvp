import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCandidateAward } from "@/lib/candidate-awards";
import { buildCompetencyAssessments, computeRoleGoalReadiness } from "@/lib/fit-analysis";
import { isActiveMentorAssignmentStatus } from "@/lib/mentor-access";
import { computeOrganizationAward } from "@/lib/organization-awards";

const trackKey = (candidateId: string, roleId: string) => `${candidateId}:${roleId}`;

export async function loadOrganizationAwardSummary(options: {
  admin: SupabaseClient;
  organizationId: string;
}) {
  const [rolesResult, candidatesResult, considerationsResult, assignmentsResult, competenciesResult, panelsResult, scoresResult, developmentRecordsResult] = await Promise.all([
    options.admin.from("roles").select("id, title").eq("organization_id", options.organizationId).is("deleted_at", null).order("created_at"),
    options.admin.from("candidates").select("id, target_role_id, status").eq("organization_id", options.organizationId).is("deleted_at", null),
    options.admin.from("candidate_role_considerations").select("candidate_id, role_id, status").eq("organization_id", options.organizationId),
    options.admin.from("mentor_role_assignments").select("candidate_id, role_id, status").eq("organization_id", options.organizationId),
    options.admin.from("role_competencies").select("id, role_id, name, target_score, weight").eq("organization_id", options.organizationId).is("deleted_at", null),
    options.admin.from("interview_panels").select("id, candidate_id, role_id").eq("organization_id", options.organizationId),
    options.admin.from("interview_scores").select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes").eq("organization_id", options.organizationId),
    options.admin.from("development_records").select("candidate_id, role_id, mentor_review_date").eq("organization_id", options.organizationId),
  ]);
  for (const result of [rolesResult, candidatesResult, considerationsResult, assignmentsResult, competenciesResult, panelsResult, scoresResult, developmentRecordsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const roles = rolesResult.data ?? [];
  const considerationsByCandidate = new Map<string, Set<string>>();
  for (const consideration of considerationsResult.data ?? []) {
    if (consideration.status !== "active") continue;
    const roleIds = considerationsByCandidate.get(consideration.candidate_id) ?? new Set<string>();
    roleIds.add(consideration.role_id);
    considerationsByCandidate.set(consideration.candidate_id, roleIds);
  }
  const activeMentorTracks = new Set((assignmentsResult.data ?? []).filter((assignment) => isActiveMentorAssignmentStatus(assignment.status)).map((assignment) => trackKey(assignment.candidate_id, assignment.role_id)));
  const competenciesByRole = new Map<string, typeof competenciesResult.data>();
  for (const competency of competenciesResult.data ?? []) {
    const current = competenciesByRole.get(competency.role_id) ?? [];
    current.push(competency);
    competenciesByRole.set(competency.role_id, current);
  }
  const panelById = new Map((panelsResult.data ?? []).map((panel) => [panel.id, panel]));
  const scoresByTrack = new Map<string, typeof scoresResult.data>();
  for (const score of scoresResult.data ?? []) {
    const panel = panelById.get(score.panel_id);
    if (!panel) continue;
    const key = trackKey(panel.candidate_id, panel.role_id);
    const current = scoresByTrack.get(key) ?? [];
    current.push(score);
    scoresByTrack.set(key, current);
  }
  const recordsByTrack = new Map<string, typeof developmentRecordsResult.data>();
  for (const record of developmentRecordsResult.data ?? []) {
    const key = trackKey(record.candidate_id, record.role_id);
    const current = recordsByTrack.get(key) ?? [];
    current.push(record);
    recordsByTrack.set(key, current);
  }

  return computeOrganizationAward({
    roles,
    roleBench: roles.map((role) => {
      const awards = (candidatesResult.data ?? []).flatMap((candidate) => {
        if (candidate.status === "on_hold") return [];
        const roleIds = new Set(considerationsByCandidate.get(candidate.id) ?? []);
        if (candidate.target_role_id) roleIds.add(candidate.target_role_id);
        if (!roleIds.has(role.id)) return [];
        const key = trackKey(candidate.id, role.id);
        const readinessPercent = computeRoleGoalReadiness(buildCompetencyAssessments(competenciesByRole.get(role.id) ?? [], scoresByTrack.get(key) ?? [])).readinessPercent;
        const records = recordsByTrack.get(key) ?? [];
        return [computeCandidateAward({ readinessPercent, hasMentorAssigned: activeMentorTracks.has(key), hasDevelopmentRecord: records.length > 0, hasCompletedMentorReview: records.some((record) => Boolean(record.mentor_review_date)) })];
      });
      return {
        roleId: role.id,
        successorCount: awards.length,
        coveredSuccessorCount: awards.filter((award) => award.tier === "silver" || award.tier === "gold" || award.tier === "platinum").length,
        goldReadySuccessorCount: awards.filter((award) => award.tier === "gold" || award.tier === "platinum").length,
      };
    }),
  });
}
