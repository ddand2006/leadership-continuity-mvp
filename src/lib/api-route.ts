import { NextResponse } from "next/server";
import {
  hasProductAccess,
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
  type SubscriptionProduct,
} from "@/lib/subscription";
import {
  canAccessLeadershipHelpPreview,
  getLeadershipHelpPreviewMessage,
} from "@/lib/leadership-help-preview";
import { syncOrganizationUserAccessOnLogin } from "@/lib/organization-user-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/mentor-access";
import { requireActiveOrganizationApiAccess } from "@/lib/organization-access";
import { ApiRouteError } from "@/lib/api-error";
import { getActivePlatformSupportOrganization } from "@/lib/platform-support";

function isRecoverableAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Invalid Refresh Token") ||
    error.message.includes("Refresh Token Not Found") ||
    error.message.includes("JWT")
  );
}

export { ApiRouteError } from "@/lib/api-error";

export function createApiErrorResponse(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof ApiRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requireApiWorkspaceProfile(options?: {
  requireAdmin?: boolean;
  requirePaid?: boolean;
  product?: SubscriptionProduct;
}) {
  const supabase = await createSupabaseServerClient();
  let user = null;
  let authError: Error | null = null;

  try {
    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;
    authError = authResult.error;
  } catch (error) {
    if (isRecoverableAuthError(error)) {
      throw new ApiRouteError("Unauthorized.", 401);
    }

    throw error;
  }

  if (authError || !user) {
    throw new ApiRouteError("Unauthorized.", 401);
  }

  const admin = createSupabaseAdminClient();
  const profileResult = await admin
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    throw new ApiRouteError(profileResult.error.message, 500);
  }

  if (!profileResult.data) {
    throw new ApiRouteError(
      "Initialize your workspace profile before using this feature.",
      403,
    );
  }

  const account = await syncOrganizationUserAccessOnLogin({
    admin,
    authUserId: user.id,
  });

  if (account?.status === "suspended") {
    throw new ApiRouteError("Your account is suspended.", 403);
  }

  if (account?.status === "archived") {
    throw new ApiRouteError("Your account is archived.", 403);
  }

  const supportOrganization = await getActivePlatformSupportOrganization(
    profileResult.data,
  );
  const profile = {
    ...profileResult.data,
    organization_id:
      supportOrganization?.id ?? profileResult.data.organization_id,
  };

  await requireActiveOrganizationApiAccess(profile.organization_id, {
    bypassForPlatformAdmin: profile.role === "system_admin",
  });

  const subscription = await loadOrganizationSubscription(
    admin as unknown as OrganizationSubscriptionClient,
    profile.organization_id,
  );

  const product = options?.product ?? "leadership_continuity";

  if (options?.requirePaid !== false && !hasProductAccess(subscription, product)) {
    throw new ApiRouteError(
      `Your ${product === "leadership_help" ? "Personal Development" : "Leadership Continuity System"} access is inactive. Visit /subscribe to restore access.`,
      402,
    );
  }

  if (
    product === "leadership_help" &&
    !canAccessLeadershipHelpPreview({
      email: user.email,
      organizationId: profile.organization_id,
      role: profile.role,
    })
  ) {
    throw new ApiRouteError(getLeadershipHelpPreviewMessage(), 403);
  }

  if (options?.requireAdmin && !ADMIN_ROLES.has(profile.role)) {
    throw new ApiRouteError("Only admins can use this feature.", 403);
  }

  return {
    admin,
    account,
    subscription,
    user,
    profile,
    supportOrganization,
  };
}
