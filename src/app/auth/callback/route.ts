import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, hasSupabaseEnv } from "@/lib/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/auth?message=Missing+Supabase+configuration", request.url));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const appUrl = getAppUrl();
      return NextResponse.redirect(
        new URL(`/auth?message=${encodeURIComponent(error.message)}`, appUrl),
      );
    }
  }

  const appUrl = getAppUrl();
  return NextResponse.redirect(new URL(next, appUrl));
}
