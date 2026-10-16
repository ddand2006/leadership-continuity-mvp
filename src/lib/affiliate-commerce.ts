import "server-only";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FOUNDATION_STRIPE_PRICE_ID, FIRST_SEAT_PACK_STRIPE_PRICE_ID, VOLUME_SEAT_PACK_STRIPE_PRICE_ID } from "@/lib/stripe-billing";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { affiliatePaymentsLive, assertAffiliatePaymentMode } from "@/lib/affiliate-payment-mode";
import { affiliateDisputeBlocksCommission, calculateAffiliateCommission } from "@/lib/affiliate-commission";
export async function releaseMatureAffiliateEarnings(affiliateId: string) {
 const admin = createSupabaseAdminClient();
 const result = await admin.from("affiliate_earnings").update({ status: "payable", reason: "Hold period completed. Awaiting administrator payout approval." }).eq("affiliate_id", affiliateId).eq("livemode",affiliatePaymentsLive()).eq("status", "pending").gt("commission_cents",0).lte("hold_until", new Date().toISOString()).select("invoice_id");
 if (result.error) throw new Error(result.error.message);
 return result.data?.length ?? 0;
}
export async function recordAffiliateInvoice(invoiceId: string) {
 const stripe = getAffiliateStripe(false);
 const invoice = await stripe.invoices.retrieve(invoiceId);
 const ref = invoice.parent?.subscription_details?.subscription;
 const subscriptionId = typeof ref === "string" ? ref : ref?.id;
 if (!subscriptionId) return;
 assertAffiliatePaymentMode(invoice.livemode);
 const subscription = await stripe.subscriptions.retrieve(subscriptionId);
 assertAffiliatePaymentMode(subscription.livemode);
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
 const conversion = await admin.from("affiliate_referral_conversions").select("billing_period_start").eq("organization_id",org.data.id).maybeSingle();
 if(conversion.error)throw new Error(conversion.error.message);
 const charges: Stripe.Charge[] = [];
 for await (const payment of stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })) {
  const intentRef = payment.payment.payment_intent;
  const intentId = typeof intentRef === "string" ? intentRef : intentRef?.id;
  if (intentId) {
   const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge.balance_transaction"] });
   if (intent.latest_charge && typeof intent.latest_charge !== "string") charges.push(intent.latest_charge);
  }
 }
 let disputed=false;
 for (const charge of charges) {
  if (!charge.disputed) continue;
  let found=false;
  for await (const dispute of stripe.disputes.list({charge:charge.id,limit:100})) {
   found=true;
   if (affiliateDisputeBlocksCommission(dispute.status)) disputed=true;
  }
  // A disputed charge without retrievable dispute evidence stays on hold.
  if (!found) disputed=true;
 }
 const feesKnown=charges.every(c=>c.balance_transaction&&typeof c.balance_transaction!=="string");
 const result = calculateAffiliateCommission(invoice,lines,org.data.affiliate_terms,[FOUNDATION_STRIPE_PRICE_ID,FIRST_SEAT_PACK_STRIPE_PRICE_ID,VOLUME_SEAT_PACK_STRIPE_PRICE_ID].filter((v):v is string=>Boolean(v)),{
  processingFeeCents:feesKnown?charges.reduce((n,c)=>n+(typeof c.balance_transaction==='object'&&c.balance_transaction?c.balance_transaction.fee:0),0):undefined,
  refundedCents:charges.reduce((n,c)=>n+c.amount_refunded,0),chargedCents:charges.reduce((n,c)=>n+c.amount,0),
  disputed,conversionStart:conversion.data?.billing_period_start,
 });
 if(invoice.amount_paid>0&&(!charges.length||charges.some(c=>!c.paid))){result.status="held";result.reason="Payment source needs review. No transfer authorized.";result.commission_cents=0;result.hold_until=null;}
 const saved = await admin.rpc("record_affiliate_earning", { payload: { ...result, invoice_id: invoice.id, affiliate_id: org.data.affiliate_id, organization_id: org.data.id, subscription_id: subscriptionId, livemode: invoice.livemode, currency: invoice.currency, charge_ids: charges.map(c => c.id), invoice_created_at: new Date(invoice.created * 1000).toISOString(), checked_at: new Date().toISOString() } });
 if (saved.error) throw new Error(saved.error.message);
}
export async function handleAffiliateStripeEvent(event: Stripe.Event) {
 assertAffiliatePaymentMode(event.livemode);
 if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") await recordAffiliateInvoice(event.data.object.id);
 if (event.type === "charge.refunded" || event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
  const object = event.data.object;
  const charge = object.object === "charge" ? object.id : typeof object.charge === "string" ? object.charge : object.charge.id;
  const admin = createSupabaseAdminClient();
  const rows = await admin.from("affiliate_earnings").select("invoice_id").eq("livemode",event.livemode).contains("charge_ids", [charge]);
  if (rows.error) throw new Error(rows.error.message);
  for (const row of rows.data ?? []) await recordAffiliateInvoice(row.invoice_id);
 }
}
