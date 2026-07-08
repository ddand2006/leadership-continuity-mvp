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

  return {
    user,
    supabase,
    account,
    profile: profileResult.data as WorkspaceProfile | null,
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
