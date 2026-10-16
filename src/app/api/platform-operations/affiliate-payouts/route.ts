import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { affiliatePaymentsLive } from "@/lib/affiliate-payment-mode";
import { recordAffiliateInvoice } from "@/lib/affiliate-commerce";
const input=z.object({earningId:z.string().min(1).max(200),action:z.enum(["pay","reconcile","reverse"]).default("pay")});

export async function GET() {
  try {
    const {admin,profile}=await requireApiWorkspaceProfile({requirePaid:false});
    if(profile.role!=="system_admin")throw new ApiRouteError("Only platform administrators can review payouts.",403);
    const livemode=affiliatePaymentsLive();
    const result=await admin.from("affiliate_earnings").select("invoice_id,affiliate_id,organization_id,livemode,currency,eligible_cents,commission_cents,status,reason,hold_until,invoice_created_at,adjustment_cents,reconciliation_required,payout_transfer_id,affiliates(name,payout_email)")
      .eq("livemode",livemode).or("status.in.(payable,processing),reconciliation_required.eq.true").gt("commission_cents",0).order("invoice_created_at");
    if(result.error)throw new Error(result.error.message);
    return NextResponse.json({earnings:result.data??[],livemode});
  } catch(error){return createApiErrorResponse(error,"Unable to load affiliate payouts.");}
}

export async function POST(request:Request) {
  try {
    const {admin,profile,user}=await requireApiWorkspaceProfile({requirePaid:false});
    if(profile.role!=="system_admin")throw new ApiRouteError("Only platform administrators can approve payouts.",403);
    const {earningId,action}=input.parse(await request.json());
    const existing=await admin.from("affiliate_earnings").select("*").eq("invoice_id",earningId).single();
    if(existing.error||!existing.data)throw new ApiRouteError("Commission not found.",404);
    const earning=existing.data;
    if(earning.livemode!==affiliatePaymentsLive())throw new ApiRouteError("Commission does not match this app's payment mode.",400);
    const stripe=getAffiliateStripe(false);
    if(action==="reconcile") {
      const account=await admin.from("affiliate_connect_accounts").select("account_id").eq("affiliate_id",earning.affiliate_id).eq("livemode",earning.livemode).single();
      if(account.error||!account.data.account_id)throw new ApiRouteError("Stripe payout account unavailable for reconciliation.",409);
      const transfers=earning.payout_transfer_id?[await stripe.transfers.retrieve(earning.payout_transfer_id)]:(await stripe.transfers.list({limit:100})).data;
      const matching=transfers.filter(t=>t.metadata.affiliate_earning_invoice_id===earningId&&t.currency===earning.currency&&(typeof t.destination==="string"?t.destination:t.destination?.id)===account.data.account_id&&t.amount>0);
      if(matching.length!==1)throw new ApiRouteError("Stripe does not show exactly one matching transfer. Leave this payout under review.",409);
      const saved=await admin.rpc("finish_affiliate_payout",{invoice:earningId,transfer:matching[0].id,amount:matching[0].amount});
      if(saved.error)throw new Error(saved.error.message);
      await recordAffiliateInvoice(earningId);
      return NextResponse.json({status:"paid",transferId:matching[0].id});
    }
    // Recheck actual receipt, fees, refunds and disputes before approving money movement.
    await recordAffiliateInvoice(earningId);
    if(action==="reverse") {
      const assessed=await admin.from("affiliate_earnings").select("*").eq("invoice_id",earningId).single();
      if(assessed.error)throw new Error(assessed.error.message);
      const e=assessed.data;
      if(!e.payout_transfer_id||!e.reconciliation_required||e.adjustment_cents>=0)throw new ApiRouteError("No recoverable payout adjustment is pending.",409);
      const amount=-e.adjustment_cents;
      const target=e.reversed_commission_cents+amount;
      const key=`affiliate-reversal-${earningId}-${target}`;
      const reservation=await admin.from("affiliate_earning_events").upsert({invoice_id:earningId,event_key:key,event_type:"reversal_requested",details:{amount_cents:amount,target_cents:target,approved_by:user.id}},{onConflict:"event_key",ignoreDuplicates:true});
      if(reservation.error)throw new Error(reservation.error.message);
      const attempt=await admin.from("affiliate_earning_events").select("created_at,details").eq("event_key",key).single();
      if(attempt.error)throw new Error(attempt.error.message);
      // Recover a lost response before trying to create another reversal.
      let reversal;
      for await(const r of stripe.transfers.listReversals(e.payout_transfer_id,{limit:100}))if(r.metadata?.affiliate_reversal_key===key)reversal=r;
      if(!reversal){
        if(Date.now()-Date.parse(attempt.data.created_at)>23*3600000)throw new ApiRouteError("Reversal retry window ended. Reconcile this transfer in Stripe before retrying.",409);
        reversal=await stripe.transfers.createReversal(e.payout_transfer_id,{amount:Number(attempt.data.details.amount_cents),metadata:{affiliate_reversal_key:key}},{idempotencyKey:key});
      }
      const saved=await admin.rpc("finish_affiliate_reversal",{invoice:earningId,reversal:reversal.id,amount:reversal.amount});
      if(saved.error)throw new Error(saved.error.message);
      return NextResponse.json({status:"reconciled",reversalId:reversal.id});
    }
    const reserved=await admin.rpc("reserve_affiliate_payout",{invoice:earningId,actor:user.id});
    if(reserved.error)throw new ApiRouteError(reserved.error.message,409);
    const requestKey=reserved.data.payout_retry_key??`affiliate-payout-${earningId}`;
    let transferCreated=false;
    try {
      const e=reserved.data;
      const transfer=await stripe.transfers.create({amount:e.commission_cents,currency:e.currency,destination:e.account_id,transfer_group:`affiliate:${earningId}`,metadata:{affiliate_earning_invoice_id:earningId}},{idempotencyKey:requestKey});
      transferCreated=true;
      const saved=await admin.rpc("finish_affiliate_payout",{invoice:earningId,transfer:transfer.id,amount:transfer.amount});
      if(saved.error)throw new Error(saved.error.message);
      return NextResponse.json({status:"paid",transferId:transfer.id});
    } catch(error) {
      const rejected=error as {type?:string;code?:string;statusCode?:number;requestId?:string};
      if(!transferCreated&&rejected.type==="StripeInvalidRequestError"&&rejected.code==="balance_insufficient"&&rejected.statusCode===400&&rejected.requestId){
        const saved=await admin.rpc("reject_affiliate_payout",{invoice:earningId,request_key:requestKey,stripe_request:rejected.requestId});
        if(saved.error)throw new Error(saved.error.message);
        throw new ApiRouteError("Stripe rejected the transfer because available funds were insufficient. Add available funds in Stripe, then approve the transfer again.",409);
      }
      await admin.from("affiliate_earnings").update({last_payout_error:"Stripe transfer confirmation is incomplete. Reconcile before approving another payment."}).eq("invoice_id",earningId).eq("status","processing");
      throw error;
    }
  } catch(error){return createApiErrorResponse(error,"Unable to approve affiliate payout.");}
}
