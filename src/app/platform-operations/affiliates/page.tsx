import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspaceProfile } from "@/lib/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AffiliateManager } from "@/components/affiliate-manager";
export default async function AffiliatesPage() {
 const { profile } = await requireWorkspaceProfile();
 if (profile.role !== "system_admin") redirect("/dashboard");
 const admin = createSupabaseAdminClient();
 const [affiliates, referrals] = await Promise.all([
  admin.from("affiliates").select("*").order("name"),
  admin.from("organizations").select("id,name,affiliate_id,affiliate_terms,subscription_status").not("affiliate_id", "is", null).order("name"),
 ]);
 return <main className="mx-auto max-w-6xl space-y-6 px-6 py-10"><Link href="/platform-operations" className="underline">Platform operations</Link><h1 className="text-4xl font-semibold">Affiliate partners</h1><p>Manage each company’s page and individually negotiated commission rates.</p>{affiliates.error || referrals.error ? <p role="alert">Affiliate setup is not available yet. Apply the affiliate database migration before using this page.</p> : <AffiliateManager affiliates={affiliates.data ?? []} referrals={referrals.data ?? []}/>}</main>;
}
