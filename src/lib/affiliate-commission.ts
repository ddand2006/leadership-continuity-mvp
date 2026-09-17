import type Stripe from "stripe";
import { z } from "zod";
const termsSchema = z.object({ initial_bps: z.number().int().min(0).max(10000), renewal_bps: z.number().int().min(0).max(10000), renewal_years: z.number().int().positive().nullable(), attributed_at: z.string().datetime({ offset: true }) });
export function calculateAffiliateCommission(invoice: Stripe.Invoice, lines: Stripe.InvoiceLineItem[], rawTerms: unknown, prices: string[]) {
 const terms = termsSchema.parse(rawTerms);
 const held = (reason: string) => ({ eligible_cents: 0, commission_cents: 0, rate_bps: 0, renewal_number: null, status: "held" as const, reason });
 if (invoice.status !== "paid" || invoice.amount_remaining !== 0) return held("Invoice is not fully paid.");
 if (invoice.currency !== "usd") return held("Currency needs review.");
 if (!["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "")) return held("Proration, adjustments or manual invoice require review.");
 if (!lines.length || lines.some(line => {
  const price = line.pricing?.price_details?.price;
  const id = typeof price === "string" ? price : price?.id;
  return !id || !prices.includes(id) || line.amount < 0 || line.parent?.subscription_item_details?.proration || line.parent?.invoice_item_details?.proration;
 })) return held("Invoice contains non-subscription items or prorations.");
 const start = Math.min(...lines.map(line => line.period.start));
 if (lines.some(line => line.period.start !== start || line.period.end - line.period.start < 360 * 86400 || line.period.end - line.period.start > 370 * 86400)) return held("Annual billing period needs review.");
 // The referral's original anniversary persists across replacement subscriptions.
 const elapsed = (start * 1000 - Date.parse(terms.attributed_at)) / (365.2425 * 86400000);
 const renewal = Math.max(0, Math.round(elapsed));
 if (Math.abs(elapsed - renewal) > 0.08) return held("Billing date differs from the referral anniversary; review contract eligibility.");
 const rate = renewal === 0 ? terms.initial_bps : terms.renewal_bps;
 if (renewal > 0 && terms.renewal_years !== null && renewal > terms.renewal_years) return { eligible_cents: 0, commission_cents: 0, rate_bps: rate, renewal_number: renewal, status: "ineligible" as const, reason: "Agreed renewal commission term has ended." };
 if (invoice.total_excluding_tax === null || invoice.total_excluding_tax < 0 || invoice.amount_paid < invoice.total) return held("Invoice balance, credit or tax basis requires review.");
 const eligible = invoice.total_excluding_tax;
 return { eligible_cents: eligible, commission_cents: Math.round(eligible * rate / 10000), rate_bps: rate, renewal_number: renewal, status: "awaiting_review" as const, reason: "Calculated from paid annual subscription revenue after discounts, excluding tax. No transfer authorized." };
}
