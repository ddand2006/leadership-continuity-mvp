import type Stripe from "stripe";
import { z } from "zod";
const termsSchema = z.object({
  initial_bps:z.number().int().min(0).max(10000),renewal_bps:z.number().int().min(0).max(10000),renewal_years:z.number().int().positive().nullable(),
  payout_hold_days:z.number().int().min(0).max(90).default(14),attributed_at:z.string().datetime({offset:true}),
  attribution_expires_at:z.string().datetime({offset:true}).optional(),
  commission_exclusions:z.array(z.enum(["tax","refunds","chargebacks","discounts","stripe_fees","pass_through_expenses"])).default(["tax","refunds","chargebacks","discounts"]),
});
export type AffiliatePaymentEvidence = {processingFeeCents?:number;refundedCents?:number;chargedCents?:number;conversionStart?:string;disputed?:boolean};
export function affiliateDisputeBlocksCommission(status: string) {
  return !["won", "prevented", "warning_closed"].includes(status);
}
export function calculateAffiliateCommission(invoice: Stripe.Invoice, lines: Stripe.InvoiceLineItem[], rawTerms: unknown, prices: string[], evidence: AffiliatePaymentEvidence = {}) {
  const terms=termsSchema.parse(rawTerms);
  const held=(reason:string)=>({eligible_cents:0,commission_cents:0,rate_bps:0,renewal_number:null,status:"held" as const,reason,hold_until:null,billing_period_start:null as string|null});
  if(invoice.status!=="paid"||invoice.amount_remaining!==0)return held("Invoice is not fully paid.");
  if(invoice.currency!=="usd")return held("Currency needs review.");
  if(!["subscription_create","subscription_cycle"].includes(invoice.billing_reason??""))return held("Proration, adjustments or manual invoice require review.");
  if(!lines.length||lines.some(line=>{const price=line.pricing?.price_details?.price;const id=typeof price==="string"?price:price?.id;return !id||!prices.includes(id)||line.amount<0||line.parent?.subscription_item_details?.proration||line.parent?.invoice_item_details?.proration;}))return held("Invoice contains non-subscription items or prorations.");
  const start=Math.min(...lines.map(line=>line.period.start));
  if(lines.some(line=>line.period.start!==start||line.period.end-line.period.start<360*86400||line.period.end-line.period.start>370*86400))return held("Annual billing period needs review.");
  const stamp=new Date(start*1000).toISOString();
  const paidAt=invoice.status_transitions?.paid_at??invoice.created;
  const expired=terms.attribution_expires_at&&Math.max(start,paidAt)*1000>Date.parse(terms.attribution_expires_at);
  if(!evidence.conversionStart&&expired)return {...held("The referral did not convert within its agreed attribution window."),status:"ineligible" as const};
  if(start*1000<Date.parse(terms.attributed_at)-86400000)return held("Billing period predates referral attribution.");
  // Once a referral converts, renewals follow its first eligible billing period.
  const anchor=evidence.conversionStart??(terms.attribution_expires_at?stamp:terms.attributed_at);
  const elapsed=(start*1000-Date.parse(anchor))/(365.2425*86400000);
  const renewal=Math.max(0,Math.round(elapsed));
  if(Math.abs(elapsed-renewal)>0.08)return held("Billing date differs from the original subscription anniversary; review contract eligibility.");
  const rate=renewal===0?terms.initial_bps:terms.renewal_bps;
  if(renewal>0&&terms.renewal_years!==null&&renewal>terms.renewal_years)return {...held("Agreed renewal commission term has ended."),status:"ineligible" as const,rate_bps:rate,renewal_number:renewal,billing_period_start:stamp};
  if(invoice.total_excluding_tax===null||invoice.total_excluding_tax<0||invoice.amount_paid<invoice.total)return held("Invoice balance, credit or tax basis requires review.");
  const excluded=new Set(terms.commission_exclusions);
  if(evidence.disputed)return held("Payment is disputed. Commission requires review.");
  if(excluded.has("stripe_fees")&&(evidence.processingFeeCents===undefined||!Number.isSafeInteger(evidence.processingFeeCents)||evidence.processingFeeCents<0))return held("Verified processing fees are required by the agreement.");
  let eligible=excluded.has("tax")?invoice.total_excluding_tax:invoice.total;
  if(!excluded.has("discounts"))eligible+=(invoice.total_discount_amounts??[]).reduce((n,d)=>n+d.amount,0);
  if(excluded.has("refunds")&&evidence.refundedCents){
    if(!evidence.chargedCents||evidence.refundedCents<0||evidence.refundedCents>evidence.chargedCents)return held("Refund basis requires review.");
    eligible=Math.round(eligible*(evidence.chargedCents-evidence.refundedCents)/evidence.chargedCents);
  }
  if(excluded.has("stripe_fees"))eligible-=evidence.processingFeeCents!;
  eligible=Math.max(0,eligible);
  const holdUntil=new Date(paidAt*1000+terms.payout_hold_days*86400000).toISOString();
  return {eligible_cents:eligible,commission_cents:Math.round(eligible*rate/10000),rate_bps:rate,renewal_number:renewal,status:"pending" as const,
    reason:`Payment verified against agreed exclusions. Hold ends ${holdUntil.slice(0,10)}.`,hold_until:holdUntil,billing_period_start:stamp};
}
