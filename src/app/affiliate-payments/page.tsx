import { AffiliatePayments } from "@/components/affiliate-payments";
import { z } from "zod";
export default async function AffiliatePaymentsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
 const {id}=await searchParams;
 return <main className="mx-auto max-w-4xl space-y-6 p-8"><h1 className="text-4xl font-semibold">Partner payment setup</h1><p>Sign in using the payout email designated by Leadership Continuity. No subscription purchase is required.</p>{z.string().uuid().safeParse(id).success ? <AffiliatePayments affiliateId={id!}/> : <p>Use the affiliate setup link provided by Leadership Continuity.</p>}</main>;
}
