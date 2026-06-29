import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SessionPayload = {
  accessToken?: string;
  refreshToken?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SessionPayload;

  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json(
      { error: "Missing session tokens." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
