import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  createManagedUser,
  deleteManagedUser,
  inviteManagedUser,
  resetManagedUserPassword,
  updateManagedUser,
  updateManagedUserStatus,
} from "@/lib/organization-user-admin";
import { ORGANIZATION_USER_STATUSES } from "@/lib/organization-users";

function resolveOrganizationId(options: {
  fallbackOrganizationId: string;
  requestedOrganizationId?: unknown;
  role: string;
}) {
  if (typeof options.requestedOrganizationId !== "string" || !options.requestedOrganizationId) {
    return options.fallbackOrganizationId;
  }

  if (
    options.requestedOrganizationId !== options.fallbackOrganizationId &&
    options.role !== "system_admin"
  ) {
    throw new ApiRouteError(
      "Only system administrators can manage a different organization.",
      403,
    );
  }

  return options.requestedOrganizationId;
}

export async function POST(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });
    const body = (await request.json()) as {
      mode?: "create" | "invite";
      organizationId?: string;
      [key: string]: unknown;
    };
    const organizationId = resolveOrganizationId({
      fallbackOrganizationId: context.profile.organization_id,
      requestedOrganizationId: body.organizationId,
      role: context.profile.role,
    });

    if (body.mode === "invite") {
      const result = await inviteManagedUser({
        admin: context.admin,
        organizationId,
        actorProfileId: context.profile.id,
        input: body,
      });

      return NextResponse.json(result);
    }

    if (body.mode === "create") {
      const result = await createManagedUser({
        admin: context.admin,
        organizationId,
        actorProfileId: context.profile.id,
        input: body,
      });

      return NextResponse.json(result);
    }

    throw new ApiRouteError("Unsupported admin user action.", 400);
  } catch (error) {
    return createApiErrorResponse(error, "Unable to manage user.");
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });
    const body = (await request.json()) as {
      action?: "edit" | "status" | "reset_password";
      userId?: string;
      organizationId?: string;
      status?: string;
      [key: string]: unknown;
    };
    const organizationId = resolveOrganizationId({
      fallbackOrganizationId: context.profile.organization_id,
      requestedOrganizationId: body.organizationId,
      role: context.profile.role,
    });

    if (!body.userId) {
      throw new ApiRouteError("User id is required.", 400);
    }

    if (body.action === "edit") {
      const result = await updateManagedUser({
        admin: context.admin,
        organizationId,
        actorProfileId: context.profile.id,
        userId: body.userId,
        input: body,
      });

      return NextResponse.json(result);
    }

    if (body.action === "status") {
      if (!body.status || !ORGANIZATION_USER_STATUSES.includes(body.status as never)) {
        throw new ApiRouteError("A valid status is required.", 400);
      }

      const result = await updateManagedUserStatus({
        admin: context.admin,
        organizationId,
        actorProfileId: context.profile.id,
        actorAuthUserId: context.user.id,
        userId: body.userId,
        status: body.status as (typeof ORGANIZATION_USER_STATUSES)[number],
      });

      return NextResponse.json(result);
    }

    if (body.action === "reset_password") {
      const result = await resetManagedUserPassword({
        admin: context.admin,
        organizationId,
        actorProfileId: context.profile.id,
        input: body,
      });

      return NextResponse.json(result);
    }

    throw new ApiRouteError("Unsupported admin user update action.", 400);
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update user.");
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const requestedOrganizationId = searchParams.get("organizationId");
    const organizationId = resolveOrganizationId({
      fallbackOrganizationId: context.profile.organization_id,
      requestedOrganizationId,
      role: context.profile.role,
    });

    if (!userId) {
      throw new ApiRouteError("User id is required.", 400);
    }

    const result = await deleteManagedUser({
      admin: context.admin,
      organizationId,
      actorAuthUserId: context.user.id,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createApiErrorResponse(error, "Unable to delete user.");
  }
}
