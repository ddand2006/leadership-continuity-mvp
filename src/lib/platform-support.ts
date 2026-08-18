import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const PLATFORM_SUPPORT_ORGANIZATION_COOKIE =
  "lc_platform_support_organization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SystemAdminProfile = {
  role: string;
};

export type PlatformSupportOrganization = {
  id: string;
  name: string;
};

/**
 * Resolves the organization selected through the audited support-workspace
 * action. The cookie is intentionally ignored for every non-system admin.
 */
export async function getActivePlatformSupportOrganization(
  profile: SystemAdminProfile,
): Promise<PlatformSupportOrganization | null> {
  if (profile.role !== "system_admin") {
    return null;
  }

  const organizationId = (await cookies()).get(
    PLATFORM_SUPPORT_ORGANIZATION_COOKIE,
  )?.value;

  if (!organizationId || !UUID_PATTERN.test(organizationId)) {
    return null;
  }

  const result = await createSupabaseAdminClient()
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? null;
}
