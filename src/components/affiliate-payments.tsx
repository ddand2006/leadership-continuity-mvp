"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
type Result = { message?: string; error?: string; name?: string; email?: string; country?: string; livemode?: boolean; portalUrl?: string; state?: { details_submitted: boolean; payouts_enabled: boolean; transfers_active: boolean } | null; earnings?: { invoice_id: string; currency: string; commission_cents: number; status: string; reason: string; renewal_number: number | null }[] };
export function AffiliatePayments({ affiliateId, admin = false }: { affiliateId: string; admin?: boolean }) {
 const [email,setEmail] = useState(""); const [country,setCountry] = useState(""); const [busy,setBusy] = useState(false); const [result,setResult] = useState<Result>({});
 async function act(action: string) {
  setBusy(true);
  try {
   const response = await fetch("/api/affiliates/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({affiliateId,action,...(action === 'configure' ? {email,country:country.toUpperCase()} : {})})});
   const data=await response.json(); if (!response.ok) throw new Error(data.error);
   if(data.url) { window.location.assign(data.url); return; }
   setResult(data); if(data.email) setEmail(data.email); if(data.country) setCountry(data.country);
  } catch(e) { setResult({error:e instanceof Error ? e.message : "Unable to complete request."}); } finally {setBusy(false);}
 }
 async function login() {
  setBusy(true);
  try {
   const {error}=await createSupabaseBrowserClient().auth.signInWithOtp({email,options:{emailRedirectTo:`${window.location.origin}/auth/confirm?next=${encodeURIComponent(`/affiliate-payments?id=${affiliateId}`)}`}});
   if(error) throw error;
   setResult({message:"Check your email for the secure sign-in link, then return here and check your Stripe status."});
  } catch(e){setResult({error:e instanceof Error ? e.message : "Unable to send sign-in link."});}finally{setBusy(false);}
 }
 return <section className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-2xl font-semibold">Affiliate payments</h2><p>Stripe collects the affiliate’s business and bank details securely. Commission transfers are disabled while this integration is being verified.</p>
 {admin ? <><label className="block">Payout contact email<input className="ml-3 rounded border p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Business country (two-letter code, e.g. US)<input className="ml-3 rounded border p-2" maxLength={2} value={country} onChange={e=>setCountry(e.target.value.toUpperCase())}/></label><button disabled={busy} className="rounded border p-3" onClick={()=>void act('configure')}>Save payout contact</button></> : <><label className="block">Your designated payout email<input className="ml-3 rounded border p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy} className="rounded border p-3" onClick={()=>void login()}>Email me a sign-in link</button></>}
 <div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded border p-3" onClick={()=>void act('status')}>Check Stripe status & earnings</button>{admin ? <button disabled={busy} className="rounded border p-3" onClick={()=>void act('reconcile')}>Review recent paid invoices</button> : <button disabled={busy} className="rounded bg-slate-950 p-3 text-white" onClick={()=>void act('onboard')}>Continue to Stripe setup</button>}</div>
 {result.error && <p role="alert">{result.error}</p>}{result.message && <p role="status">{result.message}</p>}
 {result.portalUrl && admin && <p>Share this setup page with the payout contact: <a className="break-all underline" href={result.portalUrl}>{result.portalUrl}</a></p>}
 {result.name && <p>{result.name} · {result.livemode ? 'Live Stripe account' : 'Stripe test mode'} · {result.state?.details_submitted && result.state.payouts_enabled && result.state.transfers_active ? 'Stripe setup complete' : 'Stripe setup incomplete'} · Commission transfers disabled</p>}
 {result.earnings && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Invoice</th><th>Commission estimate</th><th>Review status</th></tr></thead><tbody>{result.earnings.map(e=><tr key={e.invoice_id} className="border-t"><td className="py-3">{e.invoice_id}</td><td>{new Intl.NumberFormat('en-US',{style:'currency',currency:e.currency}).format(e.commission_cents/100)}</td><td>{e.status.replaceAll('_',' ')}<p className="text-sm">{e.reason}</p></td></tr>)}</tbody></table>{!result.earnings.length && <p>No recorded commissions yet.</p>}</div>}
 </section>;
}
