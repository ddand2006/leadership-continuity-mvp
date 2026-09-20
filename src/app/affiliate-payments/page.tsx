import Link from "next/link";
import { AffiliatePayments } from "@/components/affiliate-payments";
import { ShareAffiliateLink } from "@/components/share-affiliate-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOwnedAffiliates } from "@/lib/affiliate-access";
import { z } from "zod";
export default async function AffiliatePaymentsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
 const {id}=await searchParams;
 const client=await createSupabaseServerClient();
 const {data:{user}}=await client.auth.getUser();
 const owned = await getOwnedAffiliates(user);
 const selected = owned.find(a => a.id === id) ?? (!id ? owned[0] : undefined);
 const selectedId = selected?.id ?? id;
 // A supplied URL ID never authorizes a client list. Ownership must match first.
 const referrals = selected ? await createSupabaseAdminClient().from("organizations")
   .select("name,subscription_status").eq("affiliate_id", selected.id).order("name") : null;
 if (referrals?.error) throw new Error(referrals.error.message);
 return <main className="mx-auto max-w-5xl space-y-8 p-8">
  <header className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl">
   <p className="text-sm font-semibold uppercase tracking-[.2em] text-teal-300">Partner workspace</p>
   <h1 className="mt-3 text-4xl font-semibold">Help organizations build leadership continuity.</h1>
   <p className="mt-4 max-w-2xl text-slate-300">Send your dedicated referral page to a prospective organization. They can learn about the program, create their own account, and be attributed to your partnership automatically.</p>
  </header>
  {owned.length > 1 && <nav className="flex flex-wrap gap-3">{owned.map(a => <Link className={`rounded-full border px-4 py-2 ${a.id === selected?.id ? "bg-slate-950 text-white" : "bg-white"}`} key={a.id} href={`/affiliate-payments?id=${a.id}`}>{a.name}</Link>)}</nav>}
  {selected ? <>
   <section className="grid gap-5 md:grid-cols-[1.35fr_.65fr]">
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
     <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Your referral page</p>
     <h2 className="mt-2 text-3xl font-semibold">{selected.name}</h2>
     {selected.published_branding ? <><p className="mt-3 text-slate-600">This is the page to send to organizations you are introducing to Leadership Continuity.</p><ShareAffiliateLink path={`/partners/${selected.slug}`} title="Leadership Continuity referral page"/><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link className="font-semibold underline" href={`/partners/${selected.slug}`}>Open public page</Link><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">Published and ready to share</span></div></> : <div className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">Your referral page is being prepared by Leadership Continuity. Once it is published, the share link will appear here.</div>}
    </div>
    <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">How it works</p><ol className="mt-4 space-y-4 text-sm text-slate-700"><li><strong>1. Share</strong><span className="block text-slate-500">Send your referral page by email or copy the link.</span></li><li><strong>2. They enroll</strong><span className="block text-slate-500">The organization creates its own secure account.</span></li><li><strong>3. We follow up</strong><span className="block text-slate-500">Their referral is recorded for implementation support.</span></li></ol></div>
   </section>
   <section className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Referred organizations</p><h2 className="mt-2 text-2xl font-semibold">Your introductions</h2><p className="mt-2 text-sm text-slate-600">Only organization names and subscription status are shared here. Employee records, assessments, and training content remain private.</p><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="pb-3">Organization</th><th className="pb-3">Status</th></tr></thead><tbody>{referrals?.data?.map((r,i) => <tr key={i} className="border-b last:border-0"><td className="py-3 font-medium">{r.name}</td><td className="py-3">{r.subscription_status ?? "Pending"}</td></tr>)}</tbody></table>{!referrals?.data?.length && <p className="pt-4 text-sm text-slate-500">No referred organizations yet. Your first introduction will appear here.</p>}</div></section>
   {z.string().uuid().safeParse(selectedId).success && <details className="rounded-2xl border bg-white p-6 shadow-sm"><summary className="cursor-pointer text-lg font-semibold">Payments and account setup</summary><div className="mt-5"><AffiliatePayments affiliateId={selectedId!} signedInEmail={user?.email}/></div></details>}
  </> : <section className="rounded-2xl border bg-white p-8"><h2 className="text-2xl font-semibold">Your partner access is not connected yet</h2><p className="mt-3 text-slate-600">Use the invitation link provided by Leadership Continuity and sign in with the designated partner email.</p></section>}
 </main>;
}
