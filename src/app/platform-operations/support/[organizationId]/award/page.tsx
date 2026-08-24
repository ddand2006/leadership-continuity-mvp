import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintOrganizationAwardActions } from "@/components/print-organization-award-actions";
import { getLegacyCertificationAsset } from "@/lib/legacy-certifications";
import { loadOrganizationAwardSummary } from "@/lib/organization-award-summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function PrintOrganizationAwardPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { profile } = await requireWorkspaceProfile();
  if (profile.role !== "system_admin") redirect("/dashboard");

  const { organizationId } = await params;
  const admin = createSupabaseAdminClient();
  const [organizationResult, award] = await Promise.all([
    admin.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    loadOrganizationAwardSummary({ admin, organizationId }),
  ]);
  if (organizationResult.error) throw new Error(organizationResult.error.message);
  if (!organizationResult.data) notFound();
  if (!award.tier) redirect(`/platform-operations/support/${organizationId}`);
  const asset = getLegacyCertificationAsset(award.tier);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 print:bg-white print:px-0 print:py-0">
      <div className="no-print mx-auto mb-6 flex max-w-4xl justify-between gap-4">
        <Link href={`/platform-operations/support/${organizationId}`} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">Return to support summary</Link>
        <PrintOrganizationAwardActions />
      </div>
      <article className="mx-auto max-w-4xl border-[14px] border-amber-300 bg-white p-10 text-center shadow-sm print:max-w-none print:border-[10px] print:shadow-none">
        <p className="text-sm font-semibold tracking-[0.22em] text-teal-800 uppercase">Leadership Continuity</p>
        <h1 className="mt-7 font-display text-5xl text-slate-950">Organization Award</h1>
        <p className="mt-7 text-lg text-slate-600">This certificate recognizes</p>
        <h2 className="mt-3 font-display text-4xl text-slate-950">{organizationResult.data.name}</h2>
        <p className="mt-7 text-lg text-slate-600">for achieving</p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {asset ? <Image src={asset.src} alt={asset.alt} width={120} height={120} priority /> : null}
          <p className="font-display text-4xl text-amber-800">{award.label}</p>
        </div>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-slate-700">{award.description}</p>
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{award.coveredTopPriorityRoleCount}/{award.topPriorityRoleCount}</strong><br/>top-priority roles covered</p>
          <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{award.twoDeepTopPriorityRoleCount}/{award.topPriorityRoleCount}</strong><br/>top-priority roles two-deep</p>
          <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{award.protectedTopPriorityRoleCount}/{award.topPriorityRoleCount}</strong><br/>top-priority roles protected</p>
        </div>
        <p className="mt-10 text-sm text-slate-500">Issued {new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p>
      </article>
    </main>
  );
}
