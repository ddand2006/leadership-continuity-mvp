import { ADMIN_ROLES } from "@/lib/mentor-access";
import { normalizeEmail } from "@/lib/organization-users";

type LeadershipHelpPreviewAccessInput = {
  email?: string | null;
  organizationId: string;
  role: string;
};

function parseCsvEnv(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function isLeadershipHelpPreviewModeEnabled() {
  return process.env.LEADERSHIP_HELP_PREVIEW_MODE === "true";
}

export function canAccessLeadershipHelpPreview(
  input: LeadershipHelpPreviewAccessInput,
) {
  if (input.role === "system_admin") {
    return true;
  }

  if (!isLeadershipHelpPreviewModeEnabled()) {
    return true;
  }

  if (!ADMIN_ROLES.has(input.role)) {
    return false;
  }

  const allowedOrganizationIds = parseCsvEnv(
    process.env.LEADERSHIP_HELP_PREVIEW_ORGANIZATION_IDS,
  );

  if (allowedOrganizationIds.has(input.organizationId)) {
    return true;
  }

  const allowedEmails = parseCsvEnv(process.env.LEADERSHIP_HELP_PREVIEW_EMAILS);
  const normalizedEmail = input.email ? normalizeEmail(input.email) : "";

  return normalizedEmail ? allowedEmails.has(normalizedEmail) : false;
}

export function getLeadershipHelpPreviewMessage() {
  return "Leadership Help is currently limited to selected preview admins.";
}
