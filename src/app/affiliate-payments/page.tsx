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
 return <main className="mx-auto max-w-4xl space-y-6 p-8"><h1 className="text-4xl font-semibold">Affiliate portal</h1><p>Free partner access: share your client page, view your referred companies, and manage payment setup. No subscription purchase is required.</p>
 {owned.length > 1 && <nav className="flex gap-4">{owned.map(a => <Link className="underline" key={a.id} href={`/affiliate-payments?id=${a.id}`}>{a.name}</Link>)}</nav>}
 {selected && <section className="space-y-4"><h2 className="text-2xl font-semibold">{selected.name}</h2>{selected.published_branding ? <ShareAffiliateLink path={`/partners/${selected.slug}`} title="Invite a client through your referral page"/> : <p>Your client page is awaiting publication by Leadership Continuity.</p>}<h2 className="text-2xl font-semibold">Your referred companies</h2><p>Only company names and subscription status are shared here. Employee records, assessments, and training content remain private.</p><table className="w-full text-left"><thead><tr><th>Company</th><th>Subscription</th></tr></thead><tbody>{referrals?.data?.map((r,i) => <tr key={i}><td className="py-3">{r.name}</td><td>{r.subscription_status ?? "Pending"}</td></tr>)}</tbody></table>{!referrals?.data?.length && <p>No referred companies yet.</p>}</section>}
 {z.string().uuid().safeParse(selectedId).success ? <AffiliatePayments affiliateId={selectedId!} signedInEmail={user?.email}/> : <p>Use the affiliate invitation link provided by Leadership Continuity.</p>}</main>;
}
