import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AffiliateMemberRole = "owner" | "admin" | "finance" | "member";
export const canManagePartner = (role: AffiliateMemberRole) => role === "owner" || role === "admin";
export const canViewPartnerFinance = (role: AffiliateMemberRole) => role !== "member";

// Membership grants partner access only; workspace and coaching permissions are separate.
export async function getAffiliateMemberRole(affiliateId: string, userId: string) {
  const result = await createSupabaseAdminClient().rpc("affiliate_member_role", { affiliate: affiliateId, actor: userId });
  if (result.error) throw new Error(result.error.message);
  return result.data as AffiliateMemberRole | null;
}

export async function getOwnedAffiliates(user: { id?: string; email_confirmed_at?: string } | null) {
  if (!user?.id || !user.email_confirmed_at) return [];
  const admin = createSupabaseAdminClient();
  const memberships = await admin.from("affiliate_memberships").select("affiliate_id,role")
    .eq("user_id", user.id).eq("status", "active");
  if (memberships.error) throw new Error(memberships.error.message);
  if (!memberships.data?.length) return [];
  const result = await admin.from("affiliates").select("id,name,slug,published_branding")
    .in("id", memberships.data.map(m => m.affiliate_id)).eq("is_sandbox", false).order("name");
  if (result.error) throw new Error(result.error.message);
  const rows = await Promise.all((result.data ?? []).map(async affiliate => {
    const role = await getAffiliateMemberRole(affiliate.id, user.id!);
    return role ? { ...affiliate, memberRole: role } : null;
  }));
  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
}
