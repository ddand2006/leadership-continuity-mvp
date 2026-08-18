import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const request = await createSupabaseAdminClient().from("platform_account_requests").select("status").eq("auth_user_id", user.id).maybeSingle();
  if (request.error) return NextResponse.json({ error: request.error.message }, { status: 500 });
  return NextResponse.json({ pending: Boolean(request.data && ["new", "contacted"].includes(request.data.status)), status: request.data?.status ?? null });
}
