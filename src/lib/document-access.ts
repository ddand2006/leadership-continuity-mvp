import { getAccessibleCandidateIds } from "@/lib/mentor-access";
import type { OrganizationUserRecord } from "@/lib/organization-users";

type AccessProfile = { id: string; role: string };
type AccessAccount = Pick<
  OrganizationUserRecord,
  "candidate_id" | "is_candidate" | "is_mentor" | "admin_role"
> | null;

type CandidateScopedDocument = { candidate_id: string };

export function getRepositoryAccess(options: {
  profile: AccessProfile;
  account: AccessAccount;
  mentorAssignments: { candidate_id: string; role_id: string; mentor_profile_id: string; status?: string | null }[];
}) {
  const candidateIds = getAccessibleCandidateIds(options);
  return {
    candidateIds,
    isOrganizationAdministrator: new Set(["system_admin", "hospital_admin"]).has(options.profile.role),
    isCandidate: Boolean(options.account?.is_candidate && options.account.candidate_id),
    isMentor: Boolean(options.profile.role === "mentor" || options.account?.is_mentor),
  };
}

export function filterCandidateDocuments<T extends CandidateScopedDocument>(
  documents: T[],
  candidateIds: Set<string> | null,
) {
  if (candidateIds === null) return documents;
  return documents.filter((document) => candidateIds.has(document.candidate_id));
}

export function getRepositoryVisibilityNote(options: {
  isOrganizationAdministrator: boolean;
  isCandidate: boolean;
  isMentor: boolean;
}) {
  if (options.isOrganizationAdministrator) {
    return "Organization-wide view. Restricted documents still follow their document-level permissions.";
  }
  if (options.isCandidate) {
    return "Candidate view. You can see your approved progress records and documents only.";
  }
  if (options.isMentor) {
    return "Mentor view. You can see documents for candidates assigned to you.";
  }
  return "This repository view is limited to records assigned or explicitly shared with you.";
}
