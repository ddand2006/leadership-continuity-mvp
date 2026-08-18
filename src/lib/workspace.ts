import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import {
  canAccessLeadershipHelpPreview,
  getLeadershipHelpPreviewMessage,
} from "./leadership-help-preview";
import { syncOrganizationUserAccessOnLogin } from "./organization-user-admin";
import type { OrganizationUserRecord } from "./organization-users";
import {
  hasProductAccess,
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
  type SubscriptionProduct,
} from "./subscription";
import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";
import { requireActiveOrganizationAccess } from "./organization-access";
import { getActivePlatformSupportOrganization } from "./platform-support";

export type WorkspaceProfile = {
  id: string;
  organization_id: string;
  full_name: string;
  role: string;
};

export type WorkspaceAccount = OrganizationUserRecord | null;

export const getWorkspaceContext = cache(async () => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const profileResult = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  const account = await syncOrganizationUserAccessOnLogin({
    admin,
    authUserId: user.id,
  });

  if (account?.status === "suspended") {
    redirect(
      `/auth/reset-session?message=${encodeURIComponent(
        "Your account is suspended. Contact your organization administrator.",
      )}`,
    );
  }

  if (account?.status === "archived") {
    redirect(
      `/auth/reset-session?message=${encodeURIComponent(
        "Your account has been archived and can no longer access the system.",
      )}`,
    );
  }

  const supportOrganization = profileResult.data
    ? await getActivePlatformSupportOrganization(profileResult.data)
    : null;
  const profile = profileResult.data
    ? {
        ...profileResult.data,
        organization_id:
          supportOrganization?.id ?? profileResult.data.organization_id,
      }
    : null;

  if (profile) {
    await requireActiveOrganizationAccess(profile.organization_id, {
      bypassForPlatformAdmin: profile.role === "system_admin",
    });
  }

  return {
    user,
    // Platform support mode is only available to the sole system administrator.
    // It uses the service client after the server-side, HTTP-only cookie has been
    // validated above, so normal workspace pages operate on the selected org.
    supabase: supportOrganization ? admin : supabase,
    account,
    profile: profile as WorkspaceProfile | null,
    supportOrganization,
  };
});

export async function requireWorkspaceProfile() {
  const context = await getWorkspaceContext();

  if (!context.profile) {
    redirect("/dashboard?message=Initialize+your+workspace+before+opening+other+pages");
  }

  return {
    ...context,
    profile: context.profile,
  };
}

export async function requirePaidWorkspaceProfile(options?: {
  product?: SubscriptionProduct;
}) {
  const context = await requireWorkspaceProfile();
  const subscription = await loadOrganizationSubscription(
    context.supabase as unknown as OrganizationSubscriptionClient,
    context.profile.organization_id,
  );
  const product = options?.product ?? "leadership_continuity";

  if (!hasProductAccess(subscription, product)) {
    redirect("/subscribe");
  }

  if (
    product === "leadership_help" &&
    !canAccessLeadershipHelpPreview({
      email: context.user.email,
      organizationId: context.profile.organization_id,
      role: context.profile.role,
    })
  ) {
    redirect(
      `/dashboard?message=${encodeURIComponent(getLeadershipHelpPreviewMessage())}`,
    );
  }

  return {
    ...context,
    profile: context.profile,
    subscription,
  };
}
