import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { affiliateBranding, affiliateSlug } from "@/lib/affiliates";
import { AffiliateLanding } from "@/components/affiliate-landing";
export const dynamic = "force-dynamic";
export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!affiliateSlug.safeParse(slug).success) notFound();
  const { data, error } = await createSupabaseAdminClient().from("affiliates").select("published_branding").eq("slug", slug).maybeSingle();
  if (error) throw new Error("Unable to load partner page.");
  const branding = affiliateBranding.safeParse(data?.published_branding);
  if (!branding.success) notFound();
  return <AffiliateLanding branding={branding.data} slug={slug} />;
}
