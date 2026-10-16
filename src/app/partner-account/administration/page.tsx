import Link from "next/link";
import { requirePartnerContext } from "@/lib/partner-account";
import { AffiliatePeople } from "@/components/affiliate-people";
export const dynamic = "force-dynamic";
export default async function PartnerAdministration() {
 const {admin,application}=await requirePartnerContext(true);
 const people=await admin.from("affiliate_people").select("id,name,email,roles,role,organization_name,invitation_status").eq("partner_application_id",application.id).order("created_at",{ascending:false});
 if(people.error)throw new Error(people.error.message);
 return <main className="app-page"><div className="mx-auto max-w-5xl space-y-6 px-6 py-12 sm:px-10"><Link className="font-semibold text-blue-800 underline" href="/partner-account/dashboard">Back to partner account</Link><div className="theme-panel p-6 sm:p-8"><h1 className="font-display text-4xl">Partner contacts</h1><p className="mt-4 text-slate-600">These labels record relationships. Use Team access to give someone permission to your partner portal; company access is assigned by the company.</p><AffiliatePeople initial={people.data??[]} /></div></div></main>;
}
