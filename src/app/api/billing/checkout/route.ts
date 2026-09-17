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
    // Only the server-configured workspace can use the private live verification.
    // Never accept a coupon or workspace override from the request body.
    const verificationOrganizationId = process.env.STRIPE_VERIFICATION_ORGANIZATION_ID?.trim();
    const isVerification = Boolean(verificationOrganizationId)
      && context.profile.organization_id === verificationOrganizationId;
    const verificationCouponId = process.env.STRIPE_VERIFICATION_COUPON_ID?.trim();
    if (isVerification) {
      if (!verificationCouponId) {
        throw new ApiRouteError("Private verification discount is not configured.", 503);
      }
      const coupon = await stripe.coupons.retrieve(verificationCouponId);
      if (!coupon.valid || coupon.percent_off !== 100 || coupon.duration !== "forever"
        || coupon.applies_to?.products?.length || coupon.max_redemptions !== 1) {
        throw new ApiRouteError("Private verification requires a valid single-use, 100% forever discount for all products.", 503);
      }
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(isVerification ? {
        discounts: [{ coupon: verificationCouponId }],
        payment_method_collection: "if_required" as const,
      } : {}),
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

    if (isVerification && session.amount_total !== 0) {
      await stripe.checkout.sessions.expire(session.id);
      throw new ApiRouteError("Private verification checkout must total $0.", 502);
    }

    if (!session.url) {
      throw new ApiRouteError("Stripe did not return a checkout link.", 502);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to start Stripe checkout.");
  }
}
