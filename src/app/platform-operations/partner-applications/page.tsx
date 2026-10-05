import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireWorkspaceProfile } from '@/lib/workspace';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PartnerApplicationQueue } from '@/components/partner-application-queue';

export default async function PartnerApplicationsPage() {
  const { profile } = await requireWorkspaceProfile();
  if (profile.role !== 'system_admin') redirect('/dashboard');
  const result = await createSupabaseAdminClient().from('partner_applications').select('id,organization_name,contact_name,email,phone,website,status,review_notes,created_at,reviewed_at').order('created_at', { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return <main className="app-page"><div className="mx-auto max-w-6xl space-y-6 px-6 py-10"><Link href="/platform-operations" className="underline">Platform operations</Link><section><p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">Affiliate program</p><h1 className="mt-2 font-display text-5xl">Partner applications</h1><p className="mt-4 max-w-3xl text-slate-600">Review partner organizations before they can invite coaches, manage referrals, or appear as approved affiliates.</p></section><PartnerApplicationQueue initial={result.data ?? []}/></div></main>;
}
