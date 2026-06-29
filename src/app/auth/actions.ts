"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, hasSupabaseEnv } from "@/lib/env";

function getFormField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${key}`);
  }

  return value.trim();
}

export async function signInAction(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/auth?message=Add+Supabase+credentials+to+.env.local+first");
  }

  const email = getFormField(formData, "email");
  const password = getFormField(formData, "password");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/auth?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/auth?message=Add+Supabase+credentials+to+.env.local+first");
  }

  const email = getFormField(formData, "email");
  const password = getFormField(formData, "password");
  const appUrl = getAppUrl();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/auth?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth?message=Check+your+email+to+confirm+your+account");
}

export async function signOutAction() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
