"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LogoutPage() {
  useEffect(() => {
    let isActive = true;

    async function signOut() {
      const supabase = createSupabaseBrowserClient();

      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore browser session cleanup errors and continue clearing server cookies.
      }

      try {
        await fetch("/api/auth/session", {
          method: "DELETE",
        });
      } catch {
        // Ignore server cleanup errors and continue redirecting to auth.
      }

      if (isActive) {
        window.location.replace("/auth?message=You+have+been+signed+out.");
      }
    }

    void signOut();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16 sm:px-10 lg:px-12">
        <h1 className="font-display text-4xl text-slate-900">Signing you out</h1>
        <p className="text-sm leading-7 text-slate-600">
          Clearing your browser and server sessions now.
        </p>
      </div>
    </main>
  );
}
