import "server-only";
import type Stripe from "stripe";
import { getAffiliateStripe } from "@/lib/affiliate-stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { calculateAffiliateCommission } from "@/lib/affiliate-commission";
export async function recordSandboxInvoice(invoiceId: string) {
 const stripe = getAffiliateStripe(true);
 const invoice = await stripe.invoices.retrieve(invoiceId);
 if (invoice.livemode) throw new Error("Live invoice rejected by sandbox.");
 const ref=invoice.parent?.subscription_details?.subscription;
 const subId=typeof ref === "string" ? ref : ref?.id;
 if (!subId) return;
 const sub=await stripe.subscriptions.retrieve(subId);
 if (sub.livemode || sub.metadata.domain !== "affiliate_sandbox") return;
 const admin=createSupabaseAdminClient();
 const row=await admin.from("affiliate_sandbox_clients").select("*").eq("id",sub.metadata.affiliate_sandbox_client_id).maybeSingle();
 if(row.error) throw new Error(row.error.message);
 if(!row.data) throw new Error("Sandbox client is missing.");
 const customer=typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
 if(customer!==row.data.customer_id) throw new Error("Sandbox customer mismatch.");
 const lines: Stripe.InvoiceLineItem[]=[];
 for await(const line of stripe.invoices.listLineItems(invoice.id,{limit:100})) lines.push(line);
 const result=calculateAffiliateCommission(invoice,lines,row.data.terms,sub.items.data.map(item=>item.price.id));
 const charges: Stripe.Charge[]=[];
 for await(const payment of stripe.invoicePayments.list({invoice:invoice.id,limit:100})) {
  const ref=payment.payment.payment_intent;
  const id=typeof ref === "string" ? ref : ref?.id;
  if(id){const intent=await stripe.paymentIntents.retrieve(id,{expand:['latest_charge']});if(intent.latest_charge && typeof intent.latest_charge !== 'string') charges.push(intent.latest_charge);}
 }
 if(invoice.amount_paid>0 && (!charges.length || charges.some(c=>c.livemode || c.disputed || c.amount_refunded>0 || !c.paid))) {
  result.status='held';result.commission_cents=0;result.reason='Sandbox refund, dispute or payment source requires review.';
 }
 const saved=await admin.from('affiliate_sandbox_invoices').upsert({...result,invoice_id:invoice.id,affiliate_id:row.data.affiliate_id,client_id:row.data.id,currency:invoice.currency,charge_ids:charges.map(c=>c.id),livemode:false,invoice_created_at:new Date(invoice.created*1000).toISOString(),checked_at:new Date().toISOString()},{onConflict:'invoice_id'});
 if(saved.error) throw new Error(saved.error.message);
 const updated=await admin.from('affiliate_sandbox_clients').update({subscription_id:sub.id}).eq('id',row.data.id);
 if(updated.error) throw new Error(updated.error.message);
}
export async function reconcileSandboxAffiliate(affiliateId:string) {
 const admin=createSupabaseAdminClient();
 const rows=await admin.from('affiliate_sandbox_clients').select('customer_id').eq('affiliate_id',affiliateId);
 if(rows.error) throw new Error(rows.error.message);
 let count=0;const stripe=getAffiliateStripe(true);
 for(const row of rows.data??[]) {
  if(!row.customer_id) continue;
  for await(const invoice of stripe.invoices.list({customer:row.customer_id,status:'paid',limit:100})) {await recordSandboxInvoice(invoice.id);count++;}
 }
 return count;
}
export async function handleSandboxEvent(event:Stripe.Event) {
 if(event.livemode) throw new Error('Live event rejected by sandbox.');
 if(event.type==='invoice.paid' || event.type==='invoice.payment_succeeded') await recordSandboxInvoice(event.data.object.id);
 if(event.type==='charge.refunded' || event.type==='charge.dispute.created' || event.type==='charge.dispute.closed') {
  const obj=event.data.object; const id=obj.object==='charge'?obj.id:typeof obj.charge==='string'?obj.charge:obj.charge.id;
  const rows=await createSupabaseAdminClient().from('affiliate_sandbox_invoices').select('invoice_id').contains('charge_ids',[id]);
  if(rows.error) throw new Error(rows.error.message);
  for(const row of rows.data??[]) await recordSandboxInvoice(row.invoice_id);
 }
}
