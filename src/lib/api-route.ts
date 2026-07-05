import { NextResponse } from "next/server";
import {
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
} from "@/lib/subscription";
import { syncOrganizationUserAccessOnLogin } from "@/lib/organization-user-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/mentor-access";

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

export class ApiRouteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

  const subscription = await loadOrganizationSubscription(
    admin as unknown as OrganizationSubscriptionClient,
    profileResult.data.organization_id,
  );

  if (options?.requirePaid !== false && !subscription.hasAccess) {
    throw new ApiRouteError(
      "Your Leadership Continuity System access is inactive. Visit /subscribe to restore access.",
      402,
    );
  }

  if (options?.requireAdmin && !ADMIN_ROLES.has(profileResult.data.role)) {
    throw new ApiRouteError("Only admins can use this feature.", 403);
  }

  return {
    admin,
    account,
    subscription,
    user,
    profile: profileResult.data,
  };
}
