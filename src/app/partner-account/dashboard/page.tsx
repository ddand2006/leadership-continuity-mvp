import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPartnerContext } from "@/lib/partner-account";
import { canManagePartner, canViewPartnerFinance } from "@/lib/affiliate-access";
import { PartnerCoachRoster } from "@/components/partner-coach-roster";
import { AffiliatePayments } from "@/components/affiliate-payments";
import { ShareAffiliateLink } from "@/components/share-affiliate-link";
import { PartnerTeam, type PartnerTeamMember } from "@/components/partner-team";

export const dynamic = "force-dynamic";
export default async function PartnerDashboard({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const context = await loadPartnerContext();
  if (!context) redirect("/partner-account");
  const { application, admin, role, user } = context;
  const approved = application.status === "approved";
  const tabs = [{id:"referral",label:"Referral link"},{id:"clients",label:"Referred clients"},{id:"coaches",label:"Coaches"},
    ...(canViewPartnerFinance(role)?[{id:"payments",label:"Earnings & payments"}]:[]),...(role==="owner"?[{id:"team",label:"Team access"}]:[])];
  const requested = (await searchParams).section ?? "referral";
  const section = tabs.some(t=>t.id===requested)?requested:"referral";
  const affiliateResult = application.affiliate_id ? await admin.from("affiliates").select("id,name,slug,published_branding,initial_bps,renewal_bps,agreement_accepted_at").eq("id",application.affiliate_id).single() : null;
  if (affiliateResult?.error) throw new Error(affiliateResult.error.message);
  const affiliate = affiliateResult?.data;
  let content;
  if (!approved) content=<p role="status">{application.status==="pending"?"Your application is awaiting review. Referral links, coach invitations, and payments become available after approval.":"This partner account is unavailable. Contact Leadership Continuity to review its status."}</p>;
  else if(section==="coaches") {
    const roster = await admin.from("partner_coaches").select("id,coach_name,coach_email,specialty,invitation_status,coach_profiles(profile_status)").eq("partner_application_id",application.id).order("created_at",{ascending:false});
    if(roster.error)throw new Error(roster.error.message);
    content=<PartnerCoachRoster initial={(roster.data??[]).map(r=>({...r,coach_profiles:Array.isArray(r.coach_profiles)?r.coach_profiles[0]??null:r.coach_profiles}))} canManage={canManagePartner(role)} />;
  } else if(section==="clients") {
    const orgs=await admin.from("organizations").select("id,name,subscription_status").eq("affiliate_id",application.affiliate_id).order("name");
    if(orgs.error)throw new Error(orgs.error.message);
    content=<section className="space-y-4"><h2 className="text-2xl font-semibold">Referred clients</h2><p className="text-slate-600">Subscription status is shown here. Each company controls its leaders’ records and coaching information.</p>{!orgs.data?.length?<p>No referred companies yet. Share your published referral link to get started.</p>:<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-3">Company</th><th className="p-3">Subscription</th></tr></thead><tbody>{orgs.data.map(o=><tr key={o.id} className="border-t border-slate-200"><td className="break-words p-3">{o.name}</td><td className="p-3">{o.subscription_status}</td></tr>)}</tbody></table></div>}</section>;
  } else if(section==="payments"&&affiliate)content=<AffiliatePayments affiliateId={affiliate.id} signedInEmail={user.email} />;
  else if(section==="team") {
    const members=await admin.rpc("partner_team_members",{affiliate:application.affiliate_id,actor:user.id});
    if(members.error)throw new Error(members.error.message);
    content=<PartnerTeam members={members.data as PartnerTeamMember[]} />;
  } else content=<section className="space-y-4"><h2 className="text-2xl font-semibold">Your referral link</h2>{affiliate?.published_branding?<><ShareAffiliateLink path={`/partners/${affiliate.slug}`} title="Leadership Continuity referral page" /><Link className="inline-block font-semibold text-blue-800 underline" href={`/partners/${affiliate.slug}`}>Open public referral page</Link></>:<p>Your account is linked. Leadership Continuity will confirm your commission terms and publish your referral page before you can share it.</p>}<p className="text-slate-600">Companies create their own accounts and are attributed to your partnership. Coaching compensation is agreed separately from subscription referral commission.</p></section>;
  return <main className="app-page"><div className="mx-auto max-w-5xl space-y-6 px-6 py-12 sm:px-10"><header><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Partner account</p><h1 className="mt-3 break-words font-display text-4xl">{application.organization_name}</h1><p className="mt-3 text-slate-600">Status: {application.status} · Access: {role}</p></header>{approved&&<nav aria-label="Partner workspace" className="flex flex-wrap gap-2">{tabs.map(tab=><Link key={tab.id} aria-current={section===tab.id?"page":undefined} href={`/partner-account/dashboard?section=${tab.id}`} className={`rounded-full border px-4 py-2 ${section===tab.id?"interactive-contrast border-blue-700 bg-blue-700":"border-slate-300"}`}>{tab.label}</Link>)}{canManagePartner(role)&&<Link className="rounded-full border border-slate-300 px-4 py-2" href="/partner-account/administration">Contacts</Link>}</nav>}<div className="theme-panel p-6 sm:p-8">{content}</div></div></main>;
}
