import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { reconcileSandboxAffiliate } from "@/lib/affiliate-sandbox";
import { getStripeBillingReturnUrl } from "@/lib/stripe-billing";
import { recordAffiliateInvoice } from "@/lib/affiliate-commerce";
const input = z.object({ affiliateId: z.string().uuid(), action: z.enum(["configure", "status", "onboard", "reconcile"]), email: z.string().trim().email().optional(), country: z.string().regex(/^[A-Z]{2}$/).optional() });
export async function POST(request: Request) {
 try {
  const p = input.parse(await request.json());
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) throw new ApiRouteError("Sign in with your verified payout email first.", 401);
  const admin = createSupabaseAdminClient();
  const result = await admin.from("affiliates").select("id,name,payout_email,payout_country,is_sandbox").eq("id", p.affiliateId).single();
  if (result.error || !result.data) throw new ApiRouteError("Affiliate unavailable.", 404);
  const affiliate = result.data;
  const isOwner = affiliate.payout_email?.toLowerCase() === user.email.toLowerCase();
  let isPlatformAdmin = false;
  if (affiliate.is_sandbox || p.action === "configure" || p.action === "reconcile" || !isOwner) {
   const context = await requireApiWorkspaceProfile({ requirePaid: false });
   isPlatformAdmin = context.profile.role === "system_admin";
   if (!isPlatformAdmin) throw new ApiRouteError("Only the payout contact or platform administrator can access this account.", 403);
  }
  if (p.action === "configure") {
   if (affiliate.is_sandbox) throw new ApiRouteError("Sandbox accounts use simulated business details, not a real payout contact.", 400);
   if (!p.email || !p.country) throw new ApiRouteError("Enter the payout contact email and business country.", 400);
   const existing = await admin.from("affiliate_connect_accounts").select("affiliate_id").eq("affiliate_id", affiliate.id).limit(1);
   if (existing.error) throw new Error(existing.error.message);
   if (existing.data?.length) throw new ApiRouteError("Stripe setup has started. Contact the platform administrator to review any ownership or country changes.", 409);
   const saved = await admin.from("affiliates").update({ payout_email: p.email.toLowerCase(), payout_country: p.country }).eq("id", affiliate.id);
   if (saved.error) throw new Error(saved.error.message);
   return NextResponse.json({ message: "Payout contact saved. Share the secure setup page with that contact.", portalUrl: getStripeBillingReturnUrl(`/affiliate-payments?id=${affiliate.id}`) });
  }
  const stripe = getAffiliateStripe(affiliate.is_sandbox === true);
  const livemode = !affiliate.is_sandbox;
  if (p.action === "reconcile") {
   if (affiliate.is_sandbox) {
    const count = await reconcileSandboxAffiliate(affiliate.id);
    return NextResponse.json({ message: `Reviewed ${count} sandbox invoices. No live billing or payments changed.` });
   }
   const orgs = await admin.from("organizations").select("stripe_customer_id").eq("affiliate_id", affiliate.id);
   if (orgs.error) throw new Error(orgs.error.message);
   let count = 0;
   for (const org of orgs.data ?? []) {
    if (!org.stripe_customer_id) continue;
    // Bounded synchronous reconciliation; older history remains a separate operation.
    const invoices = await stripe.invoices.list({ customer: org.stripe_customer_id, status: "paid", limit: 20 });
    for (const invoice of invoices.data) { await recordAffiliateInvoice(invoice.id); count++; }
   }
   return NextResponse.json({ message: `Reviewed ${count} paid invoices (up to the latest 20 per customer). No payments were transferred.` });
  }
  const accountRow = await admin.from("affiliate_connect_accounts").select("*").eq("affiliate_id", affiliate.id).eq("livemode", livemode).maybeSingle();
  if (accountRow.error) throw new Error(accountRow.error.message);
  let accountId = accountRow.data?.account_id as string | undefined;
  if (p.action === "onboard") {
   // A platform administrator may configure the contact but may not impersonate it.
   if (!isOwner && !(affiliate.is_sandbox && isPlatformAdmin)) throw new ApiRouteError(`You are signed in as ${user.email}. Sign in using the designated payout email before continuing to Stripe.`, 403);
   if (!affiliate.is_sandbox && !affiliate.payout_country) throw new ApiRouteError("Your business country must be configured first.", 409);
   if (!accountId) {
    const reserved = await admin.from("affiliate_connect_accounts").upsert({ affiliate_id: affiliate.id, livemode }, { onConflict: "affiliate_id,livemode", ignoreDuplicates: true });
    if (reserved.error) throw new Error(reserved.error.message);
    const row = await admin.from("affiliate_connect_accounts").select("account_id,requested_at,creation_retry_key").eq("affiliate_id", affiliate.id).eq("livemode", livemode).single();
    if (row.error) throw new Error(row.error.message);
    const current = await admin.from("affiliates").select("payout_email,payout_country").eq("id", affiliate.id).single();
    if (current.error) throw new Error(current.error.message);
    if (!affiliate.is_sandbox && current.data.payout_email?.toLowerCase() !== user.email.toLowerCase()) throw new ApiRouteError("The payout contact changed. Sign in with the designated email.", 403);
    affiliate.payout_email = current.data.payout_email;
    affiliate.payout_country = current.data.payout_country;
    accountId = row.data.account_id;
    if (!accountId) {
     if (Date.now() - Date.parse(row.data.requested_at) > 23 * 3600000) throw new ApiRouteError("Stripe setup needs administrator reconciliation before retrying.", 409);
     const account = await stripe.accounts.create({ type: "express", country: affiliate.is_sandbox ? "US" : affiliate.payout_country!, ...(affiliate.is_sandbox ? {} : { email: affiliate.payout_email! }), capabilities: { transfers: { requested: true } }, metadata: { affiliate_id: affiliate.id } }, { idempotencyKey: row.data.creation_retry_key ?? `affiliate-connect-${affiliate.id}-${livemode}` });
     accountId = account.id;
     const saved = await admin.from("affiliate_connect_accounts").update({ account_id: accountId }).eq("affiliate_id", affiliate.id).eq("livemode", livemode);
     if (saved.error) throw new Error(saved.error.message);
    }
   }
   const path = affiliate.is_sandbox ? `/platform-operations/affiliates` : `/affiliate-payments?id=${affiliate.id}`;
   const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: getStripeBillingReturnUrl(path), return_url: getStripeBillingReturnUrl(path) });
   return NextResponse.json({ url: link.url });
  }
  let state = null;
  if (accountId) {
   const account = await stripe.accounts.retrieve(accountId);
   state = { details_submitted: account.details_submitted, payouts_enabled: account.payouts_enabled, transfers_active: account.capabilities?.transfers === "active", checked_at: new Date().toISOString() };
   const saved = await admin.from("affiliate_connect_accounts").update(state).eq("affiliate_id", affiliate.id).eq("livemode", livemode);
   if (saved.error) throw new Error(saved.error.message);
  }
  const earnings = await admin.from(affiliate.is_sandbox ? "affiliate_sandbox_invoices" : "affiliate_earnings").select("invoice_id,currency,commission_cents,status,reason,renewal_number,livemode,invoice_created_at").eq("affiliate_id", affiliate.id).eq("livemode", livemode).order("invoice_created_at", { ascending: false }).limit(100);
  if (earnings.error) throw new Error(earnings.error.message);
  return NextResponse.json({ name: affiliate.name, email: affiliate.payout_email, country: affiliate.payout_country, livemode, state, earnings: earnings.data, portalUrl: getStripeBillingReturnUrl(`/affiliate-payments?id=${affiliate.id}`), transfersEnabled: false });
 } catch (error) { return createApiErrorResponse(error, "Unable to update affiliate Stripe setup."); }
}
