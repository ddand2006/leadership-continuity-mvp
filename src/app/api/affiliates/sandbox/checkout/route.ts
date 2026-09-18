import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { getStripeBillingReturnUrl } from "@/lib/stripe-billing";
export async function POST(request:Request) {
 try {
  const {admin,profile}=await requireApiWorkspaceProfile({requirePaid:false});
  if(profile.role!=='system_admin') throw new ApiRouteError('Only platform administrators can run sandbox checkout.',403);
  const {affiliateId}=z.object({affiliateId:z.string().uuid()}).parse(await request.json());
  const a=await admin.from('affiliates').select('id,is_sandbox,initial_bps,renewal_bps,renewal_years,terms_version').eq('id',affiliateId).single();
  if(a.error || !a.data?.is_sandbox) throw new ApiRouteError('Select a sandbox-only affiliate.',400);
  const stripe=getAffiliateStripe(true); // Never fall back to the live key.
  const row=await admin.from('affiliate_sandbox_clients').insert({affiliate_id:affiliateId,terms:{initial_bps:a.data.initial_bps,renewal_bps:a.data.renewal_bps,renewal_years:a.data.renewal_years,version:a.data.terms_version,attributed_at:new Date().toISOString()}}).select('id').single();
  if(row.error) throw new Error(row.error.message);
  const id=row.data.id;
  const metadata={domain:'affiliate_sandbox',affiliate_sandbox_client_id:id,affiliate_id:affiliateId};
  const customer=await stripe.customers.create({name:'Affiliate sandbox verification client',metadata},{idempotencyKey:`affiliate-sandbox-customer-${id}`});
  if(customer.livemode) throw new Error('Live customer rejected by sandbox.');
  const saved=await admin.from('affiliate_sandbox_clients').update({customer_id:customer.id}).eq('id',id);
  if(saved.error) throw new Error(saved.error.message);
  const session=await stripe.checkout.sessions.create({mode:'subscription',customer:customer.id,metadata,subscription_data:{metadata},line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:300000,recurring:{interval:'year'},product_data:{name:'SANDBOX ONLY — Leadership Continuity Foundation'}}}],success_url:getStripeBillingReturnUrl('/platform-operations/affiliates?sandbox=paid'),cancel_url:getStripeBillingReturnUrl('/platform-operations/affiliates?sandbox=canceled')},{idempotencyKey:`affiliate-sandbox-checkout-${id}`});
  if(session.livemode || !session.url) throw new Error('Invalid sandbox checkout.');
  return NextResponse.json({url:session.url});
 }catch(error){return createApiErrorResponse(error,'Unable to start sandbox checkout.');}
}
