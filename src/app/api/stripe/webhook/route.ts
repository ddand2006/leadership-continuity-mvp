import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  countSeatPacks,
  getOrganizationIdFromStripeSubscription,
  getStripe,
} from "@/lib/stripe-billing";

export const runtime = "nodejs";

function getOrganizationSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    default:
      return "canceled";
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const organizationId = getOrganizationIdFromStripeSubscription(subscription);
  const admin = createSupabaseAdminClient();
  const status = getOrganizationSubscriptionStatus(subscription.status);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const update = {
    additional_seat_packs: countSeatPacks(subscription),
    billing_provider: "stripe",
    leadership_continuity_enabled: status === "active" || status === "trialing",
    leadership_continuity_tier: "foundation",
    stripe_customer_id: customerId,
    stripe_price_id: subscription.items.data[0]?.price.id ?? null,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_tier: "foundation",
    trial_ends_at:
      subscription.trial_end === null
        ? null
        : new Date(subscription.trial_end * 1000).toISOString(),
  };

  const result = organizationId
    ? await admin.from("organizations").update(update).eq("id", organizationId)
    : await admin
        .from("organizations")
        .update(update)
        .eq("stripe_subscription_id", subscription.id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        await syncSubscription(await getStripe().subscriptions.retrieve(session.subscription));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to synchronize Stripe." },
      { status: 500 },
    );
  }
}
