import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Affiliate identity grants access only to the partner portal, never a workspace.
export async function getOwnedAffiliates(user: { email?: string; email_confirmed_at?: string } | null) {
  if (!user?.email || !user.email_confirmed_at) return [];
  const result = await createSupabaseAdminClient().from("affiliates")
    .select("id,name,slug,published_branding")
    .eq("payout_email", user.email.toLowerCase()).eq("is_sandbox", false).order("name");
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}
