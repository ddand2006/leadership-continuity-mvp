import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { getStripe, hasStripeBillingConfiguration } from "@/lib/stripe-billing";

export const runtime = "nodejs";

function formatCancellationDate(subscription: Stripe.Subscription) {
  const periodEnd = Math.max(
    ...subscription.items.data.map((item) => item.current_period_end),
  );

  if (!Number.isFinite(periodEnd)) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/Denver",
  }).format(new Date(periodEnd * 1000));
}

export async function POST() {
  try {
    const context = await requireApiWorkspaceProfile({ requireAdmin: true });
    if (!hasStripeBillingConfiguration()) {
      throw new ApiRouteError("Stripe billing is not configured yet.", 503);
    }

    const organizationResult = await context.admin
      .from("organizations")
      .select("hide_billing_controls, stripe_subscription_id")
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
      throw new ApiRouteError("There is no active Stripe subscription to cancel.", 409);
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(organization.stripe_subscription_id);
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new ApiRouteError("The Stripe subscription is not active.", 409);
    }

    const scheduledSubscription = subscription.cancel_at_period_end
      ? subscription
      : await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
        });
    const cancellationDate = formatCancellationDate(scheduledSubscription);

    return NextResponse.json({
      message: cancellationDate
        ? `Cancellation is scheduled for ${cancellationDate}. Your team will keep access until then, and saved data will remain available when you reactivate.`
        : "Cancellation is scheduled for the end of the current term. Your team will keep access until then, and saved data will remain available when you reactivate.",
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to schedule cancellation.");
  }
}
