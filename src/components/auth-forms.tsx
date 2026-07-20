"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function AuthCard(props: {
  id?: string;
  title: string;
  description: string;
  cta: string;
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
  isSubmitting: boolean;
  featured?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <section
      id={props.id}
      className={`theme-panel-strong rounded-[1.75rem] p-8 ${
        props.featured ? "ring-2 ring-sky-200" : ""
      }`}
    >
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
        {props.onForgotPassword ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void props.onForgotPassword?.(email)}
              className="text-sm font-semibold text-teal-800 transition hover:text-teal-950"
            >
              Forgot password?
            </button>
          </div>
        ) : null}
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

export function AuthForms(props: {
  initialMode?: "signin" | "signup";
  allowSelfServeSignUp?: boolean;
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

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
    setSuccessMessage("");
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
    setSuccessMessage("");
    setIsSigningUp(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?mode=signup&next=/`,
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

  async function handleForgotPassword(email: string) {
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("Enter your email address first, then request a password reset.");
      return;
    }

    setIsSendingReset(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?mode=recovery&next=/`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Password reset email sent. Check your inbox and follow the link to choose a new password.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send a password reset email right now.",
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  const cards = [
    {
      key: "signin",
      id: "sign-in",
      title: "Sign In",
      description:
        "Use email and password for administrators, interviewers, or mentors once they exist in Supabase Auth.",
      cta: "Sign In",
      onSubmit: handleSignIn,
      onForgotPassword: handleForgotPassword,
      isSubmitting: isSigningIn || isSendingReset,
    },
    {
      key: "signup",
      id: "create-account",
      title: "Create Account",
      description:
        "Create the first workspace owner account. Invited users should use the email invitation they received instead of creating a second account here.",
      cta: "Create Account",
      onSubmit: handleSignUp,
      onForgotPassword: undefined,
      isSubmitting: isSigningUp,
    },
  ] as const;

  const visibleCards = props.allowSelfServeSignUp === false ? [cards[0]] : cards;

  const orderedCards =
    props.initialMode === "signup" && visibleCards.length > 1
      ? [visibleCards[1], visibleCards[0]]
      : visibleCards;

  return (
    <>
      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {orderedCards.map((card) => (
          <AuthCard
            key={card.key}
            id={card.id}
            title={card.title}
            description={card.description}
            cta={card.cta}
            onSubmit={card.onSubmit}
            onForgotPassword={card.onForgotPassword}
            isSubmitting={card.isSubmitting}
            featured={props.initialMode === card.key}
          />
        ))}
      </div>
    </>
  );
}
