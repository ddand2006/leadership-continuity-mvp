import "server-only";
import { requireUser } from "@/lib/auth";
import { ApiRouteError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canManagePartner, getAffiliateMemberRole, getOwnedAffiliates, type AffiliateMemberRole } from "@/lib/affiliate-access";

export async function loadPartnerContext() {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();
  const owned = await admin.from("partner_applications").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (owned.error) throw new Error(owned.error.message);
  if (owned.data) {
    const role = owned.data.status === "approved" && owned.data.affiliate_id
      ? await getAffiliateMemberRole(owned.data.affiliate_id, user.id) : "owner" as AffiliateMemberRole;
    return role ? { user, admin, application: owned.data, role } : null;
  }
  const affiliates = await getOwnedAffiliates(user);
  if (!affiliates.length) return null;
  const app = await admin.from("partner_applications").select("*").in("affiliate_id", affiliates.map(a => a.id))
    .eq("status", "approved").order("created_at").limit(1).maybeSingle();
  if (app.error) throw new Error(app.error.message);
  if (!app.data) return null;
  return { user, admin, application: app.data, role: affiliates.find(a => a.id === app.data.affiliate_id)!.memberRole };
}

export async function requirePartnerContext(manage = false) {
  const context = await loadPartnerContext();
  if (!context) throw new ApiRouteError("Partner account not found.", 404);
  if (!context.user.email_confirmed_at || context.application.status !== "approved") {
    throw new ApiRouteError("An approved partner account and verified email are required.", 403);
  }
  if (manage && !canManagePartner(context.role)) throw new ApiRouteError("Partner owner or administrator access required.", 403);
  return context;
}

export async function resolvePartnerInvitee(email: string, next: string, name: string) {
  const admin = createSupabaseAdminClient();
  const address = email.trim().toLowerCase();
  const lookup = async () => {
    const found = await admin.rpc("partner_user_for_email", { address });
    if (found.error) throw new Error(found.error.message);
    return found.data as string | null;
  };
  const existing = await lookup();
  if (existing) return { userId: existing, invitationSent: false };
  const invite = await admin.auth.admin.inviteUserByEmail(address, {
    data: { full_name: name },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "http://localhost:3000"}/auth/confirm?mode=invite&next=${encodeURIComponent(next)}`,
  });
  // Resolve a concurrent signup/invitation by verified server lookup, not error text.
  if (invite.error) {
    const raced = await lookup();
    if (raced) return { userId: raced, invitationSent: false };
    throw new ApiRouteError(invite.error.message, 400);
  }
  if (!invite.data.user) throw new Error("The invitation did not return an account.");
  return { userId: invite.data.user.id, invitationSent: true };
}
