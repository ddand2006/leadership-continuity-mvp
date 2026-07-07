import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { normalizeEmail } from "@/lib/organization-users";
import {
  ORGANIZATION_SUBSCRIPTION_STATUSES,
  type OrganizationSubscriptionStatus,
} from "@/lib/subscription";

const organizationStatusSchema = z.enum(ORGANIZATION_SUBSCRIPTION_STATUSES);

const baseOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  industryName: z.string().trim().min(2).max(160),
  billingContactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .optional()
    .or(z.literal("")),
  subscriptionStatus: organizationStatusSchema,
  leadershipContinuityEnabled: z.boolean(),
  leadershipContinuityTier: z.string().trim().min(1).max(80),
  leadershipHelpEnabled: z.boolean(),
  leadershipHelpTier: z.string().trim().min(1).max(80),
});

const createOrganizationSchema = baseOrganizationSchema;

const updateOrganizationSchema = baseOrganizationSchema.extend({
  organizationId: z.string().uuid(),
});

function assertSystemAdmin(role: string) {
  if (role !== "system_admin") {
    throw new ApiRouteError(
      "Only system administrators can manage organizations across the system.",
      403,
    );
  }
}

function buildOrganizationPayload(payload: {
  organizationName: string;
  industryName: string;
  billingContactEmail?: string;
  subscriptionStatus: OrganizationSubscriptionStatus;
  leadershipContinuityEnabled: boolean;
  leadershipContinuityTier: string;
  leadershipHelpEnabled: boolean;
  leadershipHelpTier: string;
}) {
  return {
    billing_contact_email: payload.billingContactEmail?.trim()
      ? normalizeEmail(payload.billingContactEmail)
      : null,
    name: payload.organizationName.trim(),
    industry: payload.industryName.trim(),
    subscription_status: payload.subscriptionStatus,
    leadership_continuity_enabled: payload.leadershipContinuityEnabled,
    leadership_continuity_tier: payload.leadershipContinuityTier.trim(),
    leadership_help_enabled: payload.leadershipHelpEnabled,
    leadership_help_tier: payload.leadershipHelpTier.trim(),
    subscription_tier: payload.leadershipContinuityTier.trim(),
    trial_ends_at:
      payload.subscriptionStatus === "trialing"
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null,
  };
}

export async function POST(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });
    assertSystemAdmin(context.profile.role);

    const payload = createOrganizationSchema.parse(await request.json());
    const existingOrganizationResult = await context.admin
      .from("organizations")
      .select("id")
      .eq("name", payload.organizationName.trim())
      .maybeSingle();

    if (existingOrganizationResult.error) {
      throw new ApiRouteError(existingOrganizationResult.error.message, 500);
    }

    if (existingOrganizationResult.data) {
      throw new ApiRouteError("An organization with that name already exists.", 409);
    }

    const insertResult = await context.admin
      .from("organizations")
      .insert(buildOrganizationPayload(payload))
      .select("id, name")
      .single();

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Created ${insertResult.data.name}.`,
      organizationId: insertResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to create the organization.");
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });
    assertSystemAdmin(context.profile.role);

    const payload = updateOrganizationSchema.parse(await request.json());
    const updateResult = await context.admin
      .from("organizations")
      .update(buildOrganizationPayload(payload))
      .eq("id", payload.organizationId)
      .select("id, name")
      .maybeSingle();

    if (updateResult.error) {
      throw new ApiRouteError(updateResult.error.message, 500);
    }

    if (!updateResult.data) {
      throw new ApiRouteError("That organization could not be found.", 404);
    }

    return NextResponse.json({
      message: `Updated ${updateResult.data.name}.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to update the organization.");
  }
}
