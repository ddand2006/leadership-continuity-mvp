import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, hasSupabaseEnv } from "@/lib/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const appUrl = getAppUrl();

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(
      new URL("/auth?message=Missing+Supabase+configuration", appUrl),
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/auth?message=${encodeURIComponent(error.message)}`, appUrl),
      );
    }
  }

  if (requestUrl.searchParams.has("token_hash") || requestUrl.searchParams.has("type")) {
    const confirmUrl = new URL("/auth/confirm", appUrl);

    for (const [key, value] of requestUrl.searchParams.entries()) {
      confirmUrl.searchParams.set(key, value);
    }

    return NextResponse.redirect(confirmUrl);
  }

  return NextResponse.redirect(new URL(next, appUrl));
}
