import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { hasSupabaseEnv } from "./env";

function isRecoverableAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Invalid Refresh Token") ||
    error.message.includes("Refresh Token Not Found") ||
    error.message.includes("JWT")
  );
}

export const getCurrentUser = cache(async () => {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ?? null;
  } catch (error) {
    if (isRecoverableAuthError(error)) {
      return null;
    }

    throw error;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  return user;
}
