import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  getStripe,
  getStripeBillingReturnUrl,
  hasStripeBillingConfiguration,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

export async function POST() {
  try {
    const context = await requireApiWorkspaceProfile({ requireAdmin: true });
    if (!hasStripeBillingConfiguration()) {
      throw new ApiRouteError("Stripe billing is not configured yet.", 503);
    }
    const organizationResult = await context.admin
      .from("organizations")
      .select("hide_billing_controls, stripe_customer_id")
      .eq("id", context.profile.organization_id)
      .single();
    if (organizationResult.error) {
      throw new ApiRouteError(organizationResult.error.message, 500);
    }
    if (organizationResult.data.hide_billing_controls) {
      throw new ApiRouteError("Billing is managed separately for this organization.", 403);
    }
    if (!organizationResult.data.stripe_customer_id) {
      throw new ApiRouteError("Start the Foundation subscription before opening billing management.", 409);
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: organizationResult.data.stripe_customer_id,
      return_url: getStripeBillingReturnUrl("/subscribe"),
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to open Stripe billing management.");
  }
}
