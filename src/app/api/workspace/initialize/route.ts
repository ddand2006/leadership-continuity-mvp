import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getClientEnv } from "@/lib/env";
import { initializeWorkspaceForUser } from "@/lib/workspace-initializer";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Your session was not available. Please sign in again." },
      { status: 401 },
    );
  }

  const { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL } =
    getClientEnv();

  const supabase = createClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user?.email) {
    return NextResponse.json(
      { error: "Your session was not available. Please sign in again." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    fullName?: string;
    organizationName?: string;
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 },
    );
  }

  if (!body.organizationName?.trim()) {
    return NextResponse.json(
      { error: "Organization name is required." },
      { status: 400 },
    );
  }

  try {
    const message = await initializeWorkspaceForUser({
      userId: user.id,
      email: user.email,
      fullName: body.fullName.trim(),
      organizationName: body.organizationName.trim(),
    });

    revalidatePath("/dashboard");
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to initialize workspace.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
