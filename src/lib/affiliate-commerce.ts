import "server-only";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe, FOUNDATION_STRIPE_PRICE_ID, FIRST_SEAT_PACK_STRIPE_PRICE_ID, VOLUME_SEAT_PACK_STRIPE_PRICE_ID } from "@/lib/stripe-billing";
import { calculateAffiliateCommission } from "@/lib/affiliate-commission";
export async function recordAffiliateInvoice(invoiceId: string) {
 const stripe = getStripe();
 const invoice = await stripe.invoices.retrieve(invoiceId);
 const ref = invoice.parent?.subscription_details?.subscription;
 const subscriptionId = typeof ref === "string" ? ref : ref?.id;
 if (!subscriptionId) return;
 if (!invoice.livemode) throw new Error("Test invoices cannot enter the live affiliate ledger.");
 const subscription = await stripe.subscriptions.retrieve(subscriptionId);
 const orgId = subscription.metadata.organization_id;
 if (!orgId) return;
 const admin = createSupabaseAdminClient();
 const org = await admin.from("organizations").select("id,affiliate_id,affiliate_terms,stripe_customer_id").eq("id", orgId).maybeSingle();
 if (org.error) throw new Error(org.error.message);
 if (!org.data?.affiliate_id) return;
 const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
 if (!customer || org.data.stripe_customer_id !== customer) throw new Error("Affiliate invoice customer does not match organization.");
 const lines: Stripe.InvoiceLineItem[] = [];
 for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) lines.push(line);
 const result = calculateAffiliateCommission(invoice, lines, org.data.affiliate_terms, [FOUNDATION_STRIPE_PRICE_ID, FIRST_SEAT_PACK_STRIPE_PRICE_ID, VOLUME_SEAT_PACK_STRIPE_PRICE_ID].filter((v): v is string => Boolean(v)));
 const charges: Stripe.Charge[] = [];
 for await (const payment of stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })) {
  const intentRef = payment.payment.payment_intent;
  const intentId = typeof intentRef === "string" ? intentRef : intentRef?.id;
  if (intentId) {
   const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
   if (intent.latest_charge && typeof intent.latest_charge !== "string") charges.push(intent.latest_charge);
  }
 }
 if (invoice.amount_paid > 0 && (!charges.length || charges.some(c => c.refunded || c.amount_refunded > 0 || c.disputed || !c.paid))) {
  result.status = "held";
  result.reason = "Refund, dispute or payment source needs review. No transfer authorized.";
  result.commission_cents = 0;
 }
 const saved = await admin.rpc("record_affiliate_earning", { payload: { ...result, invoice_id: invoice.id, affiliate_id: org.data.affiliate_id, organization_id: org.data.id, subscription_id: subscriptionId, livemode: invoice.livemode, currency: invoice.currency, charge_ids: charges.map(c => c.id), invoice_created_at: new Date(invoice.created * 1000).toISOString(), checked_at: new Date().toISOString() } });
 if (saved.error) throw new Error(saved.error.message);
}
export async function handleAffiliateStripeEvent(event: Stripe.Event) {
 if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") await recordAffiliateInvoice(event.data.object.id);
 if (event.type === "charge.refunded" || event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
  const object = event.data.object;
  const charge = object.object === "charge" ? object.id : typeof object.charge === "string" ? object.charge : object.charge.id;
  const admin = createSupabaseAdminClient();
  const rows = await admin.from("affiliate_earnings").select("invoice_id").contains("charge_ids", [charge]);
  if (rows.error) throw new Error(rows.error.message);
  for (const row of rows.data ?? []) await recordAffiliateInvoice(row.invoice_id);
 }
}
