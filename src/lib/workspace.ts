import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { createSupabaseServerClient } from "./supabase/server";

export type WorkspaceProfile = {
  id: string;
  organization_id: string;
  full_name: string;
  role: string;
};

export const getWorkspaceContext = cache(async () => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const profileResult = await supabase
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  return {
    user,
    supabase,
    profile: profileResult.data as WorkspaceProfile | null,
  };
});

export async function requireWorkspaceProfile() {
  const context = await getWorkspaceContext();

  if (!context.profile) {
    redirect("/dashboard?message=Initialize+your+workspace+before+opening+other+pages");
  }

  return {
    ...context,
    profile: context.profile,
  };
}
