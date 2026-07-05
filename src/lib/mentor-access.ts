import type { OrganizationUserRecord } from "@/lib/organization-users";

export const ADMIN_ROLES = new Set(["system_admin", "hospital_admin"]);

type AccessProfile = {
  id: string;
  role: string;
};

type AccessAccount = Pick<
  OrganizationUserRecord,
  "candidate_id" | "is_candidate" | "is_mentor" | "admin_role"
> | null;

type MentorAssignmentAccessRecord = {
  candidate_id: string;
  role_id: string;
  mentor_profile_id: string;
  status?: string | null;
};

export function isAdminAppRole(role: string) {
  return ADMIN_ROLES.has(role);
}

export function isMentorAppUser(
  profile: AccessProfile,
  account: AccessAccount,
) {
  return profile.role === "mentor" || Boolean(account?.is_mentor);
}

export function isCandidateAppUser(account: AccessAccount) {
  return Boolean(account?.is_candidate && account.candidate_id);
}

export function isCandidateSelfAccess(
  account: AccessAccount,
  candidateId: string,
) {
  return Boolean(account?.is_candidate && account.candidate_id === candidateId);
}

export function isActiveMentorAssignmentStatus(status?: string | null) {
  return status === undefined || status === null || status === "active";
}

export function mentorHasCandidateAccess(options: {
  profileId: string;
  candidateId: string;
  roleId?: string;
  mentorAssignments: MentorAssignmentAccessRecord[];
}) {
  return options.mentorAssignments.some(
    (assignment) =>
      assignment.candidate_id === options.candidateId &&
      assignment.mentor_profile_id === options.profileId &&
      (!options.roleId || assignment.role_id === options.roleId) &&
      isActiveMentorAssignmentStatus(assignment.status),
  );
}

export function getAccessibleCandidateIds(options: {
  profile: AccessProfile;
  account: AccessAccount;
  mentorAssignments: MentorAssignmentAccessRecord[];
}) {
  if (isAdminAppRole(options.profile.role)) {
    return null;
  }

  const candidateIds = new Set<string>();

  if (options.account?.is_candidate && options.account.candidate_id) {
    candidateIds.add(options.account.candidate_id);
  }

  for (const assignment of options.mentorAssignments) {
    if (
      assignment.mentor_profile_id === options.profile.id &&
      isActiveMentorAssignmentStatus(assignment.status)
    ) {
      candidateIds.add(assignment.candidate_id);
    }
  }

  return candidateIds;
}
