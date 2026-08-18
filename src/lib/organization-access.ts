import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ApiRouteError } from "@/lib/api-error";

export type OrganizationAccessStatus = "active" | "payment_hold";

export async function getOrganizationAccessStatus(organizationId: string) {
  const result = await createSupabaseAdminClient()
    .from("organizations")
    .select("manual_access_status")
    .eq("id", organizationId)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return (result.data?.manual_access_status ?? "active") as OrganizationAccessStatus;
}

export async function requireActiveOrganizationAccess(organizationId: string) {
  const status = await getOrganizationAccessStatus(organizationId);
  if (status === "payment_hold") {
    redirect(
      `/auth/reset-session?message=${encodeURIComponent("Your organization is temporarily unavailable while account access is reviewed. Contact your organization administrator.")}`,
    );
  }
}

export async function requireActiveOrganizationApiAccess(organizationId: string) {
  const status = await getOrganizationAccessStatus(organizationId);
  if (status === "payment_hold") {
    throw new ApiRouteError(
      "Your organization is temporarily unavailable while account access is reviewed. Contact your organization administrator.",
      402,
    );
  }
}
