"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ConfirmationState =
  | "working"
  | "needs-password"
  | "redirecting"
  | "done"
  | "error";

type VerifyOtpType = "email" | "recovery" | "invite" | "email_change";

function isVerifyOtpType(value: string | null): value is VerifyOtpType {
  return (
    value === "email" ||
    value === "recovery" ||
    value === "invite" ||
    value === "email_change"
  );
}

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

export default function AuthConfirmPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<ConfirmationState>("working");
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const nextPath = searchParams.get("next") ?? "/";
  const requestedMode = searchParams.get("mode");
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const flowMode: "invite" | "recovery" | "signup" | null =
    requestedMode === "invite" ||
    requestedMode === "recovery" ||
    requestedMode === "signup"
      ? requestedMode
      : type === "invite"
        ? "invite"
        : type === "recovery"
          ? "recovery"
          : null;

  useEffect(() => {
    let active = true;
    let resolved = false;

    async function finishSession(session: Session) {
      if (!active || resolved) {
        return;
      }

      resolved = true;
      await syncSessionToServer(session);

      if (flowMode === "invite" || flowMode === "recovery") {
        setState("needs-password");
        return;
      }

      setState("redirecting");
      window.location.assign(nextPath);
    }

    async function hydrateSessionFromLink() {
      setErrorMessage("");

      try {
        // Always process the email link before trusting any already-open
        // browser session, otherwise an admin who is already signed in can
        // accidentally change their own password while completing someone
        // else's invite or recovery flow.
        if (code) {
          const exchangeResult = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeResult.error) {
            throw exchangeResult.error;
          }

          if (exchangeResult.data.session) {
            await finishSession(exchangeResult.data.session);
            return;
          }
        }

        if (tokenHash && isVerifyOtpType(type)) {
          const verifyResult = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });

          if (verifyResult.error) {
            throw verifyResult.error;
          }

          if (verifyResult.data.session) {
            await finishSession(verifyResult.data.session);
            return;
          }
        }

        if (flowMode === "invite" || flowMode === "recovery") {
          if (active) {
            setState("error");
            setErrorMessage(
              "This invite or password reset link is missing details or has expired. Request a fresh email link and try again.",
            );
          }

          return;
        }

        const { data: initialSessionData } = await supabase.auth.getSession();

        if (initialSessionData.session) {
          await finishSession(initialSessionData.session);
          return;
        }

        await new Promise((resolvePromise) => window.setTimeout(resolvePromise, 750));

        const { data: finalSessionData } = await supabase.auth.getSession();

        if (finalSessionData.session) {
          await finishSession(finalSessionData.session);
          return;
        }

        if (active) {
          setState("error");
          setErrorMessage(
            "We could not complete the email link. Please request a fresh invitation or password reset and try again.",
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not complete the email link.",
        );
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session) {
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "PASSWORD_RECOVERY" ||
        event === "USER_UPDATED"
      ) {
        void finishSession(session);
      }
    });

    void hydrateSessionFromLink();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [code, flowMode, nextPath, supabase, tokenHash, type]);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters for the password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const updateResult = await supabase.auth.updateUser({ password });

      if (updateResult.error) {
        throw updateResult.error;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        throw new Error("Your session was not available after the password update.");
      }

      await syncSessionToServer(data.session);
      setState("done");
      window.location.assign(nextPath);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save your password.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  const heading =
    flowMode === "invite"
      ? "Complete your invitation"
      : flowMode === "recovery"
        ? "Choose a new password"
        : "Completing your sign-in";
  const description =
    flowMode === "invite"
      ? "Your invitation is valid. Set your password to activate this account and continue into the Leadership Continuity System."
      : flowMode === "recovery"
        ? "Your password reset link is valid. Choose a new password to regain access."
        : "We are finishing your email confirmation and signing you in.";

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="theme-panel-strong rounded-[2rem] p-8">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Account Access
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-slate-950">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
            {description}
          </p>

          {state === "working" || state === "redirecting" ? (
            <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-white/75 px-5 py-5 text-sm text-slate-600">
              {state === "working"
                ? "Checking your email link and creating your session..."
                : "Your session is ready. Redirecting now..."}
            </div>
          ) : null}

          {state === "needs-password" ? (
            <form className="mt-8 space-y-4" onSubmit={handlePasswordSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  New password
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm password
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSavingPassword}
              >
                {isSavingPassword ? "Saving password..." : "Save Password"}
              </button>
            </form>
          ) : null}

          {state === "error" || errorMessage ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
