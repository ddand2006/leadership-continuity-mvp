import { z } from "zod";

export const ORGANIZATION_USER_ADMIN_ROLES = [
  "none",
  "ceo_admin",
  "manager_admin",
] as const;

export const ORGANIZATION_USER_STATUSES = [
  "invited",
  "active",
  "suspended",
  "archived",
] as const;

export type OrganizationUserAdminRole =
  (typeof ORGANIZATION_USER_ADMIN_ROLES)[number];
export type OrganizationUserStatus = (typeof ORGANIZATION_USER_STATUSES)[number];

export type OrganizationUserRecord = {
  id: string;
  organization_id: string;
  auth_user_id: string | null;
  profile_id: string | null;
  candidate_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  is_candidate: boolean;
  is_mentor: boolean;
  admin_role: OrganizationUserAdminRole;
  status: OrganizationUserStatus;
  invited_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  archived_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

const nameSchema = z.string().trim().min(1).max(80);

export const organizationUserInputBaseSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().trim().email().max(320),
  isCandidate: z.boolean(),
  isMentor: z.boolean(),
  adminRole: z.enum(ORGANIZATION_USER_ADMIN_ROLES),
  status: z.enum(ORGANIZATION_USER_STATUSES),
});

export const organizationUserInputSchema = organizationUserInputBaseSchema
  .refine(
    (value) => value.isCandidate || value.isMentor || value.adminRole !== "none",
    {
      message: "Choose at least one user type or an admin role.",
      path: ["adminRole"],
    },
  );

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function hasAdminAccountRole(adminRole: OrganizationUserAdminRole) {
  return adminRole === "ceo_admin" || adminRole === "manager_admin";
}

export function getOrganizationUserLegacyRole(input: {
  isCandidate: boolean;
  isMentor: boolean;
  adminRole: OrganizationUserAdminRole;
}) {
  if (input.adminRole === "ceo_admin" || input.adminRole === "manager_admin") {
    return "hospital_admin";
  }

  if (input.isMentor) {
    return "mentor";
  }

  if (input.isCandidate) {
    return "candidate";
  }

  return "candidate";
}

export function getCandidateProgramStatus(status: OrganizationUserStatus) {
  switch (status) {
    case "suspended":
    case "archived":
      return "on_hold";
    default:
      return "active";
  }
}

export function getAdminRoleLabel(adminRole: OrganizationUserAdminRole) {
  switch (adminRole) {
    case "ceo_admin":
      return "CEO Admin";
    case "manager_admin":
      return "Manager Admin";
    default:
      return "None";
  }
}

export function getStatusLabel(status: OrganizationUserStatus) {
  switch (status) {
    case "invited":
      return "Invited";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "archived":
      return "Archived";
  }
}

export function getUserTypeLabel(input: {
  isCandidate: boolean;
  isMentor: boolean;
}) {
  if (input.isCandidate && input.isMentor) {
    return "Candidate + Mentor";
  }

  if (input.isCandidate) {
    return "Candidate";
  }

  if (input.isMentor) {
    return "Mentor";
  }

  return "Admin Only";
}
