import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  FOUNDATION_STRIPE_PRICE_ID,
  FIRST_SEAT_PACK_STRIPE_PRICE_ID,
  getStripe,
  getStripeBillingReturnUrl,
  hasStripeBillingConfiguration,
  VOLUME_SEAT_PACK_STRIPE_PRICE_ID,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  additionalSeatPacks: z.number().int().min(0).max(200).default(0),
});

export async function POST(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({
      requireAdmin: true,
      requirePaid: false,
    });

    if (!hasStripeBillingConfiguration() || !FOUNDATION_STRIPE_PRICE_ID) {
      throw new ApiRouteError("Stripe checkout is not configured yet.", 503);
    }

    const organizationResult = await context.admin
      .from("organizations")
      .select("name, billing_contact_email, hide_billing_controls, stripe_customer_id, stripe_subscription_id")
      .eq("id", context.profile.organization_id)
      .single();

    if (organizationResult.error) {
      throw new ApiRouteError(organizationResult.error.message, 500);
    }

    const organization = organizationResult.data;
    if (organization.hide_billing_controls) {
      throw new ApiRouteError("Billing is managed separately for this organization.", 403);
    }
    if (organization.stripe_subscription_id) {
      throw new ApiRouteError("This organization already has a Stripe subscription.", 409);
    }

    const body = await request.json().catch(() => ({}));
    const { additionalSeatPacks } = checkoutSchema.parse(body);
    const lineItems = [{ price: FOUNDATION_STRIPE_PRICE_ID, quantity: 1 }];
    if (additionalSeatPacks > 0 && FIRST_SEAT_PACK_STRIPE_PRICE_ID) {
      lineItems.push({ price: FIRST_SEAT_PACK_STRIPE_PRICE_ID, quantity: 1 });
    }
    if (additionalSeatPacks > 1 && VOLUME_SEAT_PACK_STRIPE_PRICE_ID) {
      lineItems.push({
        price: VOLUME_SEAT_PACK_STRIPE_PRICE_ID,
        quantity: additionalSeatPacks - 1,
      });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: organization.stripe_customer_id ?? undefined,
      customer_email: organization.stripe_customer_id
        ? undefined
        : organization.billing_contact_email ?? context.user.email,
      client_reference_id: context.profile.organization_id,
      line_items: lineItems,
      metadata: { organization_id: context.profile.organization_id },
      subscription_data: {
        metadata: { organization_id: context.profile.organization_id },
      },
      success_url: getStripeBillingReturnUrl("/subscribe?checkout=success"),
      cancel_url: getStripeBillingReturnUrl("/subscribe?checkout=canceled"),
    });

    if (!session.url) {
      throw new ApiRouteError("Stripe did not return a checkout link.", 502);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to start Stripe checkout.");
  }
}
