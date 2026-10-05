"use client";
import { ShareAffiliateLink } from "@/components/share-affiliate-link";
import { AffiliatePayments } from "@/components/affiliate-payments";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AffiliateLanding } from "@/components/affiliate-landing";
import type { AffiliateBranding } from "@/lib/affiliates";
type Affiliate = { is_sandbox?: boolean; id: string; name: string; slug: string; draft_branding: AffiliateBranding; published_branding: AffiliateBranding | null; initial_bps: number; renewal_bps: number; renewal_years: number | null; commission_exclusions?: string[]; payout_hold_days?: number; attribution_days?: number; agreement_accepted_at?: string | null };
const empty = { name: "", slug: "", initialPercent: 0, renewalPercent: 0, renewalYears: null as number | null,
 branding: { displayName: "", headline: "Build your next generation of leaders", description: "Prepare your organization for leadership transitions with a structured approach to development, mentoring, and succession.", contactName: "", contactEmail: "", phone: "", address: "", color: "#0f766e", logoUrl: "" } };
const defaultTerms = { commissionExclusions: ["tax", "refunds", "chargebacks", "discounts", "stripe_fees"], payoutHoldDays: 14, attributionDays: 30, agreementAccepted: false };
function formatPhone(value: string) {
 const digits = value.replace(/\D/g, "").slice(0, 10);
 if (digits.length <= 3) return digits ? `(${digits}` : "";
 if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
 return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
export function AffiliateManager({ affiliates, referrals }: { affiliates: Affiliate[]; referrals: { id: string; name: string; affiliate_id: string; subscription_status: string; affiliate_attributed_at: string | null; affiliate_attribution_expires_at: string | null; affiliate_terms: { initial_bps: number; renewal_bps: number } }[] }) {
 const router = useRouter();
 const [form, setForm] = useState<typeof empty & { id?: string; commissionExclusions: string[]; payoutHoldDays: number; attributionDays: number; agreementAccepted: boolean }>({ ...empty, ...defaultTerms });
 const selectedSandbox = affiliates.find(a => a.id === form.id)?.is_sandbox === true;
 const [approved, setApproved] = useState(false);
 const [preview, setPreview] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState("");
 const [renderedAt] = useState(() => Date.now());
 async function save(action: "save" | "publish" | "unpublish") {
  setBusy(true); setMessage("");
  try {
   const response = await fetch("/api/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, action, approved }) });
   const result = await response.json(); if (!response.ok) throw new Error(result.error);
   setForm(current => ({ ...current, id: result.id })); setApproved(false);
   setMessage(action === "publish" ? "Page published." : action === "unpublish" ? "Page unpublished. Existing client attribution is preserved." : "Draft and terms saved. Existing clients retain their terms."); router.refresh();
  } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); } finally { setBusy(false); }
 }
 const input = "w-full rounded-lg border border-slate-300 bg-white p-3";
 return <div className="space-y-8">
 <p className="rounded-xl bg-amber-50 p-4 text-amber-950">Affiliate setup · Payouts are not enabled. Rates apply to subscription revenue after discounts, excluding tax, before processing fees. Training commissions and automated payouts will be added separately.</p>
 <div className="flex flex-wrap gap-3"><button className="rounded-lg border p-3" onClick={() => { setForm({ ...empty, ...defaultTerms }); setApproved(false); setMessage(""); }}>New affiliate</button>{affiliates.map(a => <button className="rounded-lg border p-3" key={a.id} onClick={() => { setForm({ id: a.id, name: a.name, slug: a.slug, branding: a.draft_branding, initialPercent: a.initial_bps / 100, renewalPercent: a.renewal_bps / 100, renewalYears: a.renewal_years, commissionExclusions: a.commission_exclusions ?? defaultTerms.commissionExclusions, payoutHoldDays: a.payout_hold_days ?? 14, attributionDays: a.attribution_days ?? 30, agreementAccepted: Boolean(a.agreement_accepted_at) }); setApproved(false); setMessage(""); }}>{a.name}{a.is_sandbox ? " (Sandbox only)" : ""} · {a.published_branding ? "Published" : "Draft"}</button>)}</div>
 <form className="grid gap-5 rounded-2xl border bg-white p-6 md:grid-cols-2" onSubmit={event => { event.preventDefault(); void save("save"); }} onChangeCapture={() => setApproved(false)}>
 <label>Company name<input required className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
 <label>Permanent page address<input required disabled={!!form.id} className={input} placeholder="company-name" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}/><small>/partners/{form.slug || "company-name"}</small></label>
 {([['displayName','Public company name'],['headline','Headline'],['contactName','Contact name'],['contactEmail','Contact email'],['phone','Phone'],['logoUrl','Logo URL (HTTPS)'],['color','Accent color']] as const).map(([key,label]) => <label key={key}>{label}<input className={input} type={key === 'color' ? 'color' : key === 'contactEmail' ? 'email' : 'text'} placeholder={key === 'phone' ? '(555) 123-4567' : undefined} value={key === 'phone' ? formatPhone(form.branding.phone) : form.branding[key]} onChange={e => setForm({ ...form, branding: { ...form.branding, [key]: key === 'phone' ? formatPhone(e.target.value) : e.target.value } })}/></label>)}
 <label className="md:col-span-2">Business address<textarea className={input} rows={3} placeholder="Street, city, state, ZIP" value={form.branding.address} onChange={e => setForm({ ...form, branding: { ...form.branding, address: e.target.value } })}/></label>
 <label className="md:col-span-2">Introduction<textarea className={input} rows={5} value={form.branding.description} onChange={e => setForm({ ...form, branding: { ...form.branding, description: e.target.value } })}/></label>
 {([['initialPercent','Initial sale commission (%)'],['renewalPercent','Renewal commission (%)']] as const).map(([key,label]) => <label key={key}>{label}<input required type="number" min="0" max="100" step="0.01" className={input} value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}/></label>)}
 <label>Number of annual renewals earning commission<input className={input} type="number" min="1" max="100" placeholder="No limit" value={form.renewalYears ?? ""} onChange={e => setForm({ ...form, renewalYears: e.target.value ? Number(e.target.value) : null })}/></label>
 <label>Payout hold days<input required className={input} type="number" min="0" max="90" value={form.payoutHoldDays} onChange={e => setForm({ ...form, payoutHoldDays: Number(e.target.value) })}/></label>
 <label>Attribution window (days)<input required className={input} type="number" min="1" max="365" value={form.attributionDays} onChange={e => setForm({ ...form, attributionDays: Number(e.target.value) })}/></label>
 <fieldset className="md:col-span-2"><legend className="font-semibold">Excluded from commissionable revenue</legend><div className="mt-2 flex flex-wrap gap-4">{["tax", "refunds", "chargebacks", "discounts", "stripe_fees", "pass_through_expenses"].map(item => <label key={item} className="text-sm"><input type="checkbox" checked={form.commissionExclusions.includes(item)} onChange={e => setForm({ ...form, commissionExclusions: e.target.checked ? [...form.commissionExclusions, item] : form.commissionExclusions.filter(value => value !== item) })}/> {item.replaceAll("_", " ")}</label>)}</div></fieldset>
 <p className="self-center text-sm text-slate-600">Rate changes affect new clients only. Existing client terms remain fixed.</p>
 <label className="md:col-span-2"><input type="checkbox" checked={form.agreementAccepted} onChange={e => setForm({ ...form, agreementAccepted: e.target.checked })}/> The affiliate agreement has been accepted and recorded.</label>
 <label className="md:col-span-2"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)}/> I have the affiliate’s approval to publish this branding and have reviewed the commission terms.</label>
 <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={busy} className="rounded-lg bg-slate-900 p-3 text-white">Save draft & terms</button><button disabled={busy || !approved || selectedSandbox} type="button" className="rounded-lg border p-3 disabled:opacity-40" onClick={() => void save("publish")}>Publish approved page</button><button type="button" className="rounded-lg border p-3" onClick={() => setPreview(!preview)}>Preview draft</button>{form.id && <button type="button" disabled={busy} className="rounded-lg border p-3" onClick={() => void save("unpublish")}>Unpublish</button>}</div>
 {message && <p role="status" className="md:col-span-2">{message}</p>}
 </form>
 {form.id && !selectedSandbox && <section className="space-y-4"><h2 className="text-2xl font-semibold">Invite and share</h2><p>Send the partner setup link to the saved payout contact. They sign in themselves for free. Share the client page with prospective customers after publishing it.</p><ShareAffiliateLink path={`/affiliate-payments?id=${form.id}`} title="Affiliate invitation — free partner portal"/>{affiliates.find(a => a.id === form.id)?.published_branding ? <ShareAffiliateLink path={`/partners/${form.slug}`} title="Client referral page"/> : <p>Publish the approved page to enable the client referral link.</p>}</section>}
 {form.id && <AffiliatePayments key={form.id} affiliateId={form.id} sandbox={selectedSandbox} admin/>}
 {preview && <AffiliateLanding branding={form.branding} slug={form.slug} preview/>}
 <section><h2 className="text-2xl font-semibold">Referred clients</h2><p className="mt-2 text-sm text-slate-600">Paid clients are ready for your implementation outreach. Commission estimates are available in each affiliate’s payment section. Transfers remain disabled.</p><div className="mt-4 overflow-auto"><table className="w-full text-left"><thead><tr>{['Client','Affiliate','Subscription','Attribution','Agreed initial / renewal'].map(v => <th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{referrals.map(r => { const expires = r.affiliate_attribution_expires_at ? new Date(r.affiliate_attribution_expires_at) : null; const expired = expires ? expires.getTime() <= renderedAt : false; return <tr key={r.id} className="border-t"><td className="p-3">{r.name}</td><td className="p-3">{affiliates.find(a => a.id === r.affiliate_id)?.name}</td><td className="p-3">{r.subscription_status}</td><td className="p-3">{expires ? `${expired ? 'Expired' : 'Active'} · ${expires.toLocaleDateString()}` : 'Not recorded'}</td><td className="p-3">{r.affiliate_terms.initial_bps / 100}% / {r.affiliate_terms.renewal_bps / 100}%</td></tr>; })}</tbody></table>{!referrals.length && <p className="p-3">No referred clients yet.</p>}</div></section>
 </div>;
}
