"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function AuthCard(props: {
  title: string;
  description: string;
  cta: string;
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <section className="theme-panel-strong rounded-[1.75rem] p-8">
      <h2 className="font-display text-3xl text-slate-900">{props.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{props.description}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.onSubmit({ email, password });
        }}
        className="mt-6 space-y-4"
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Email
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Password
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          className="interactive-contrast w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={props.isSubmitting}
        >
          {props.isSubmitting ? "Please wait..." : props.cta}
        </button>
      </form>
    </section>
  );
}

export function AuthForms() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  async function syncSessionToServer(session: Session) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Unable to save your session.");
    }
  }

  async function handleSignIn(payload: { email: string; password: string }) {
    setErrorMessage("");
    setIsSigningIn(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword(payload);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.session) {
        setErrorMessage("Your session could not be created. Please try again.");
        return;
      }

      await syncSessionToServer(data.session);

      window.location.assign("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in right now.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignUp(payload: { email: string; password: string }) {
    setErrorMessage("");
    setIsSigningUp(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.session) {
        window.location.assign(
          "/auth?message=Check+your+email+to+confirm+your+account",
        );
        return;
      }

      await syncSessionToServer(data.session);

      window.location.assign("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your account right now.",
      );
    } finally {
      setIsSigningUp(false);
    }
  }

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <AuthCard
          title="Sign In"
          description="Use email and password for administrators, interviewers, or mentors once they exist in Supabase Auth."
          cta="Sign In"
          onSubmit={handleSignIn}
          isSubmitting={isSigningIn}
        />
        <AuthCard
          title="Create Account"
          description="Create the first authenticated user. Supabase will send a confirmation email to complete the account setup."
          cta="Create Account"
          onSubmit={handleSignUp}
          isSubmitting={isSigningUp}
        />
      </div>
    </>
  );
}
