export const ADMIN_ROLES = new Set(["system_admin", "hospital_admin"]);

export function isAdminAppRole(role: string) {
  return ADMIN_ROLES.has(role);
}

