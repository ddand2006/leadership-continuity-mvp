import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspaceProfile } from "@/lib/workspace";
import { AffiliatePayoutQueue } from "@/components/affiliate-payout-queue";
export default async function AffiliatePayoutsPage() {
 const {profile}=await requireWorkspaceProfile();
 if(profile.role!=="system_admin")redirect("/dashboard");
 return <main className="mx-auto max-w-6xl space-y-6 px-6 py-10"><Link className="underline" href="/platform-operations">Platform operations</Link><h1 className="text-4xl font-semibold">Affiliate payout approval</h1><AffiliatePayoutQueue /></main>;
}
