import { NextResponse } from "next/server";
import Stripe from "stripe";
import { hasResendEnv } from "@/lib/env";
import { sendResendEmail } from "@/lib/resend";
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

function formatCurrency(amountInCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/Denver",
  }).format(new Date(timestamp * 1000));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '\"': "&quot;",
    };

    return entities[character];
  });
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id ?? null;
}

async function getInvoiceOrganization(invoice: Stripe.Invoice) {
  const admin = createSupabaseAdminClient();
  const organizationId = invoice.parent?.subscription_details?.metadata?.organization_id?.trim();

  if (organizationId) {
    const byId = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();
    if (byId.error) throw new Error(byId.error.message);
    if (byId.data) return byId.data;
  }

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return null;

  const bySubscription = await admin
    .from("organizations")
    .select("id, name")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (bySubscription.error) throw new Error(bySubscription.error.message);

  return bySubscription.data;
}

type BillingAlertKind = "upcoming" | "paid" | "failed";

async function sendBillingAlert({
  event,
  invoice,
  kind,
}: {
  event: Stripe.Event;
  invoice: Stripe.Invoice;
  kind: BillingAlertKind;
}) {
  if (!hasResendEnv()) return;

  const admin = createSupabaseAdminClient();
  const settings = await admin
    .from("platform_settings")
    .select("sales_notification_email, reminders_enabled")
    .eq("id", true)
    .maybeSingle();
  if (settings.error) throw new Error(settings.error.message);
  if (!settings.data?.reminders_enabled || !settings.data.sales_notification_email) return;

  const organization = await getInvoiceOrganization(invoice);
  if (!organization) return;

  const amount = formatCurrency(invoice.amount_due, invoice.currency);
  const organizationName = escapeHtml(organization.name);
  const renewalDate = formatDate(
    invoice.next_payment_attempt ?? invoice.due_date ?? invoice.period_end,
  );
  const invoiceLink = invoice.hosted_invoice_url
    ? `<p><a href="${invoice.hosted_invoice_url}">Open the Stripe invoice</a></p>`
    : "";

  const messageByKind = {
    upcoming: {
      subject: `Upcoming Stripe charge: ${organization.name}`,
      text: `${organization.name} is expected to be charged ${amount}${renewalDate ? ` on ${renewalDate}` : ""}.`,
      html: `<p><strong>${organizationName}</strong> is expected to be charged <strong>${amount}</strong>${renewalDate ? ` on ${renewalDate}` : ""}.</p>${invoiceLink}`,
    },
    paid: {
      subject: `Stripe payment received: ${organization.name}`,
      text: `Stripe received ${amount} from ${organization.name}.`,
      html: `<p>Stripe received <strong>${amount}</strong> from <strong>${organizationName}</strong>.</p>${invoiceLink}`,
    },
    failed: {
      subject: `Action needed: Stripe payment failed for ${organization.name}`,
      text: `Stripe could not collect ${amount} from ${organization.name}. Review the subscription and payment method in Stripe.`,
      html: `<p>Stripe could not collect <strong>${amount}</strong> from <strong>${organizationName}</strong>. Review the subscription and payment method in Stripe.</p>${invoiceLink}`,
    },
  } satisfies Record<BillingAlertKind, { subject: string; text: string; html: string }>;

  const message = messageByKind[kind];
  await sendResendEmail({
    to: settings.data.sales_notification_email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    idempotencyKey: `stripe-billing-alert-${event.id}`,
  });
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

    if (
      event.type === "invoice.upcoming" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);

      if (subscriptionId && event.type !== "invoice.upcoming") {
        await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId));
      }

      const kind: BillingAlertKind =
        event.type === "invoice.upcoming"
          ? "upcoming"
          : event.type === "invoice.payment_succeeded"
            ? "paid"
            : "failed";

      try {
        await sendBillingAlert({ event, invoice, kind });
      } catch (error) {
        // Billing state remains synchronized even if the optional owner email cannot be delivered.
        console.error("Unable to send Stripe billing alert", error);
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
