import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyWorkspaceSetupToken } from "@/lib/workspace-setup-token";
import { initializeWorkspaceForUser } from "@/lib/workspace-initializer";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    authEmail?: string;
    authUserId?: string;
    fullName?: string;
    organizationName?: string;
    industryName?: string;
    setupToken?: string;
  };

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

  if (!body.industryName?.trim()) {
    return NextResponse.json(
      { error: "Industry is required." },
      { status: 400 },
    );
  }

  try {
    const message = await initializeWorkspaceForUser({
      userId: body.authUserId,
      email: body.authEmail,
      fullName: body.fullName.trim(),
      organizationName: body.organizationName.trim(),
      industryName: body.industryName.trim(),
    });

    revalidatePath("/dashboard");
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to initialize workspace.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
