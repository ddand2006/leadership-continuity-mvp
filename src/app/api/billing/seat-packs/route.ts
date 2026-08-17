import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { getOrganizationSeatLimit } from "@/lib/billing";
import {
  countSeatPacks,
  getSeatPackPriceId,
  getStripe,
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
      .select("hide_billing_controls, included_seats, additional_seat_packs, stripe_subscription_id")
      .eq("id", context.profile.organization_id)
      .single();
    if (organizationResult.error) {
      throw new ApiRouteError(organizationResult.error.message, 500);
    }
    const organization = organizationResult.data;
    if (organization.hide_billing_controls) {
      throw new ApiRouteError("Billing is managed separately for this organization.", 403);
    }
    if (!organization.stripe_subscription_id) {
      throw new ApiRouteError("Start the Foundation subscription before adding seats.", 409);
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(organization.stripe_subscription_id);
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new ApiRouteError("The Stripe subscription must be active before adding seats.", 409);
    }

    const existingSeatPacks = Math.max(
      organization.additional_seat_packs ?? 0,
      countSeatPacks(subscription),
    );
    await stripe.subscriptions.update(subscription.id, {
      items: [{ price: getSeatPackPriceId(existingSeatPacks), quantity: 1 }],
      payment_behavior: "error_if_incomplete",
      proration_behavior: "always_invoice",
    });

    const nextSeatPackCount = existingSeatPacks + 1;
    const updateResult = await context.admin
      .from("organizations")
      .update({ additional_seat_packs: nextSeatPackCount })
      .eq("id", context.profile.organization_id);
    if (updateResult.error) {
      throw new ApiRouteError(updateResult.error.message, 500);
    }

    const nextSeatLimit = getOrganizationSeatLimit({
      included_seats: organization.included_seats,
      additional_seat_packs: nextSeatPackCount,
    });
    return NextResponse.json({
      message: `Added five internal seats. Your organization now has ${nextSeatLimit} seats.`,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to add a seat pack.");
  }
}
