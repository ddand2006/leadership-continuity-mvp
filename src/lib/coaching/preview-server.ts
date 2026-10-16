import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function canViewCoachingPreview() {
  const db = await createSupabaseServerClient();
  const result = await db.rpc("coaching_identity_enabled");
  return !result.error && Boolean(result.data);
}
