import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { getStripe } from "@/lib/stripe-billing";

const input = z.object({ earningId: z.string().uuid() });

export async function GET() {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requirePaid: false });
    if (profile.role !== "system_admin") throw new ApiRouteError("Only platform administrators can review payouts.", 403);
    const result = await admin.from("affiliate_earnings").select("invoice_id,affiliate_id,organization_id,currency,eligible_cents,commission_cents,status,reason,hold_until,invoice_created_at,affiliates(name,payout_email),affiliate_connect_accounts(account_id,details_submitted,payouts_enabled,transfers_active)").eq("status", "payable").is("payout_transfer_id", null).order("invoice_created_at", { ascending: true });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ earnings: result.data ?? [] });
  } catch (error) { return createApiErrorResponse(error, "Unable to load affiliate payouts."); }
}

export async function POST(request: Request) {
  try {
    const { admin, profile, user } = await requireApiWorkspaceProfile({ requirePaid: false });
    if (profile.role !== "system_admin") throw new ApiRouteError("Only platform administrators can approve payouts.", 403);
    const { earningId } = input.parse(await request.json());
    const earning = await admin.from("affiliate_earnings").select("invoice_id,affiliate_id,currency,commission_cents,status,payout_transfer_id,affiliate_connect_accounts(account_id,details_submitted,payouts_enabled,transfers_active)").eq("invoice_id", earningId).single();
    if (earning.error || !earning.data) throw new ApiRouteError("Commission not found.", 404);
    if (earning.data.status !== "payable" || earning.data.payout_transfer_id) throw new ApiRouteError("This commission is not available for payout.", 409);
    const account = Array.isArray(earning.data.affiliate_connect_accounts) ? earning.data.affiliate_connect_accounts[0] : earning.data.affiliate_connect_accounts;
    if (!account?.account_id || !account.details_submitted || !account.payouts_enabled || !account.transfers_active) throw new ApiRouteError("The affiliate Stripe account is not ready to receive transfers.", 409);
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({ amount: earning.data.commission_cents, currency: earning.data.currency, destination: account.account_id, metadata: { affiliate_earning_invoice_id: earning.data.invoice_id } }, { idempotencyKey: `affiliate-payout-${earning.data.invoice_id}` });
    const saved = await admin.from("affiliate_earnings").update({ status: "paid", payout_transfer_id: transfer.id, paid_at: new Date().toISOString(), payout_approved_at: new Date().toISOString(), payout_approved_by: user.id, payout_attempts: 1, reason: "Stripe transfer completed." }).eq("invoice_id", earning.data.invoice_id).eq("status", "payable").is("payout_transfer_id", null);
    if (saved.error) throw new Error(saved.error.message);
    return NextResponse.json({ transferId: transfer.id, status: "paid" });
  } catch (error) { return createApiErrorResponse(error, "Unable to approve affiliate payout."); }
}
