import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyWorkspaceSetupToken } from "@/lib/workspace-setup-token";
import { initializeWorkspaceForUser } from "@/lib/workspace-initializer";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    authEmail?: string;
    authUserId?: string;
    fullName?: string;
    organizationName?: string;
    setupToken?: string;
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let userId = user?.id;
  let email = user?.email;

  if (!userId || !email || userError) {
    if (
      !body.authUserId ||
      !body.authEmail ||
      !body.setupToken ||
      !verifyWorkspaceSetupToken({
        token: body.setupToken,
        userId: body.authUserId,
        email: body.authEmail,
      })
    ) {
      return NextResponse.json(
        { error: "Your session was not available. Please sign in again." },
        { status: 401 },
      );
    }

    userId = body.authUserId;
    email = body.authEmail;
  }

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
      userId,
      email,
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
