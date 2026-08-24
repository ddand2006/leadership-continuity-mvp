import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCandidateAward } from "@/lib/candidate-awards";
import {
  buildCompetencyAssessments,
  computeRoleGoalReadiness,
} from "@/lib/fit-analysis";
import { isActiveMentorAssignmentStatus } from "@/lib/mentor-access";
import { computeOrganizationAward, type OrganizationAwardTier } from "@/lib/organization-awards";

export type PlatformAwardNotification = {
  id: string;
  organizationId: string;
  organizationName: string;
  tier: OrganizationAwardTier;
  reachedAt: string;
};

type Organization = { id: string; name: string };
type Role = { id: string; organization_id: string; title: string; created_at: string };
type Candidate = { id: string; organization_id: string; target_role_id: string | null; status: string };
type Consideration = { candidate_id: string; role_id: string; status: string };
type MentorAssignment = { candidate_id: string; role_id: string; status: string | null };
type Competency = { id: string; role_id: string; target_score: number; weight: number; name: string };
type Panel = { id: string; candidate_id: string; role_id: string };
type Score = { panel_id: string; competency_id: string; score_numeric: number; evidence_notes: string | null; concern_notes: string | null };
type DevelopmentRecord = { candidate_id: string; role_id: string; mentor_review_date: string | null };

function isAwardTier(value: unknown): value is OrganizationAwardTier {
  return value === "bronze" || value === "silver" || value === "gold" || value === "platinum";
}

function trackKey(candidateId: string, roleId: string) {
  return `${candidateId}:${roleId}`;
}

export async function syncPlatformAwardNotifications(options: {
  admin: SupabaseClient;
  actorProfileId: string;
}) {
  const [organizationsResult, rolesResult, candidatesResult, considerationsResult, assignmentsResult, competenciesResult, panelsResult, scoresResult, developmentRecordsResult, eventsResult] = await Promise.all([
    options.admin.from("organizations").select("id, name").order("name"),
    options.admin.from("roles").select("id, organization_id, title, created_at").order("created_at"),
    options.admin.from("candidates").select("id, organization_id, target_role_id, status"),
    options.admin.from("candidate_role_considerations").select("candidate_id, role_id, status"),
    options.admin.from("mentor_role_assignments").select("candidate_id, role_id, status"),
    options.admin.from("role_competencies").select("id, role_id, target_score, weight, name"),
    options.admin.from("interview_panels").select("id, candidate_id, role_id"),
    options.admin.from("interview_scores").select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes"),
    options.admin.from("development_records").select("candidate_id, role_id, mentor_review_date"),
    options.admin.from("platform_audit_events").select("organization_id, details").eq("event_type", "organization_award_reached"),
  ]);

  for (const result of [organizationsResult, rolesResult, candidatesResult, considerationsResult, assignmentsResult, competenciesResult, panelsResult, scoresResult, developmentRecordsResult, eventsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const organizations = (organizationsResult.data ?? []) as Organization[];
  const roles = (rolesResult.data ?? []) as Role[];
  const candidates = (candidatesResult.data ?? []) as Candidate[];
  const considerations = (considerationsResult.data ?? []) as Consideration[];
  const assignments = (assignmentsResult.data ?? []) as MentorAssignment[];
  const competencies = (competenciesResult.data ?? []) as Competency[];
  const panels = (panelsResult.data ?? []) as Panel[];
  const scores = (scoresResult.data ?? []) as Score[];
  const developmentRecords = (developmentRecordsResult.data ?? []) as DevelopmentRecord[];

  const considerationsByCandidate = new Map<string, Set<string>>();
  for (const consideration of considerations) {
    if (consideration.status !== "active") continue;
    const current = considerationsByCandidate.get(consideration.candidate_id) ?? new Set<string>();
    current.add(consideration.role_id);
    considerationsByCandidate.set(consideration.candidate_id, current);
  }
  const activeMentorTracks = new Set(
    assignments
      .filter((assignment) => isActiveMentorAssignmentStatus(assignment.status))
      .map((assignment) => trackKey(assignment.candidate_id, assignment.role_id)),
  );
  const developmentRecordsByTrack = new Map<string, DevelopmentRecord[]>();
  for (const record of developmentRecords) {
    const key = trackKey(record.candidate_id, record.role_id);
    const current = developmentRecordsByTrack.get(key) ?? [];
    current.push(record);
    developmentRecordsByTrack.set(key, current);
  }
  const competenciesByRole = new Map<string, Competency[]>();
  for (const competency of competencies) {
    const current = competenciesByRole.get(competency.role_id) ?? [];
    current.push(competency);
    competenciesByRole.set(competency.role_id, current);
  }
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const scoresByTrack = new Map<string, Score[]>();
  for (const score of scores) {
    const panel = panelById.get(score.panel_id);
    if (!panel) continue;
    const key = trackKey(panel.candidate_id, panel.role_id);
    const current = scoresByTrack.get(key) ?? [];
    current.push(score);
    scoresByTrack.set(key, current);
  }
  const seenAwards = new Set(
    (eventsResult.data ?? []).flatMap((event) => {
      const details = event.details as { award_tier?: unknown } | null;
      return event.organization_id && isAwardTier(details?.award_tier)
        ? [`${event.organization_id}:${details.award_tier}`]
        : [];
    }),
  );
  const newNotifications: Array<Omit<PlatformAwardNotification, "id" | "reachedAt">> = [];

  for (const organization of organizations) {
    const organizationRoles = roles.filter((role) => role.organization_id === organization.id);
    const roleBench = organizationRoles.map((role) => {
      const candidateAwards = candidates.flatMap((candidate) => {
        if (candidate.organization_id !== organization.id || candidate.status === "on_hold") return [];
        const candidateRoleIds = new Set(considerationsByCandidate.get(candidate.id) ?? []);
        if (candidate.target_role_id) candidateRoleIds.add(candidate.target_role_id);
        if (!candidateRoleIds.has(role.id)) return [];
        const key = trackKey(candidate.id, role.id);
        const roleCompetencies = competenciesByRole.get(role.id) ?? [];
        const readiness = computeRoleGoalReadiness(
          buildCompetencyAssessments(
            roleCompetencies,
            scoresByTrack.get(key) ?? [],
          ),
        ).readinessPercent;
        const records = developmentRecordsByTrack.get(key) ?? [];
        const award = computeCandidateAward({
          readinessPercent: readiness,
          hasMentorAssigned: activeMentorTracks.has(key),
          hasDevelopmentRecord: records.length > 0,
          hasCompletedMentorReview: records.some((record) => Boolean(record.mentor_review_date)),
        });
        return [{ candidate, award }];
      });
      const coveredSuccessorCount = candidateAwards.filter(({ award }) => award.tier === "silver" || award.tier === "gold" || award.tier === "platinum").length;
      const goldReadySuccessorCount = candidateAwards.filter(({ award }) => award.tier === "gold" || award.tier === "platinum").length;
      return { roleId: role.id, successorCount: candidateAwards.length, coveredSuccessorCount, goldReadySuccessorCount };
    });
    const award = computeOrganizationAward({ roles: organizationRoles.map((role) => ({ id: role.id, title: role.title })), roleBench });
    if (award.tier && !seenAwards.has(`${organization.id}:${award.tier}`)) {
      newNotifications.push({ organizationId: organization.id, organizationName: organization.name, tier: award.tier });
    }
  }

  if (!newNotifications.length) return [] as PlatformAwardNotification[];
  const now = new Date().toISOString();
  const inserted = await options.admin.from("platform_audit_events").insert(
    newNotifications.map((notification) => ({
      actor_profile_id: options.actorProfileId,
      organization_id: notification.organizationId,
      event_type: "organization_award_reached",
      details: { award_tier: notification.tier, organization_name: notification.organizationName },
    })),
  ).select("id, organization_id, details, created_at");
  if (inserted.error) throw new Error(inserted.error.message);
  return (inserted.data ?? []).flatMap((event) => {
    const details = event.details as { award_tier?: unknown; organization_name?: unknown } | null;
    return event.organization_id && isAwardTier(details?.award_tier) && typeof details?.organization_name === "string"
      ? [{ id: event.id, organizationId: event.organization_id, organizationName: details.organization_name, tier: details.award_tier, reachedAt: event.created_at ?? now }]
      : [];
  });
}
