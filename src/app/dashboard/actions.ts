"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { initializeWorkspaceForUser } from "@/lib/workspace-initializer";

function redirectWithMessage(message: string) {
  redirect(`/dashboard?message=${encodeURIComponent(message)}`);
}

function getRequiredField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${key}`);
  }

  return value.trim();
}

export async function initializeWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const fullName = getRequiredField(formData, "full_name");
  const organizationName = getRequiredField(formData, "organization_name");

  const email = user.email;

  if (typeof email !== "string" || email.length === 0) {
    redirectWithMessage("Your authenticated user is missing an email address.");
  }

  try {
    await initializeWorkspaceForUser({
      userId: user.id,
      email: email as string,
      fullName,
      organizationName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to initialize workspace.";
    redirectWithMessage(message);
  }

  revalidatePath("/dashboard");
  redirectWithMessage("Workspace initialized with your admin profile and demo hospital data.");
}
