"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignUpPayload = {
  fullName: string;
  companyName: string;
  phone: string;
  roleTitle: string;
  email: string;
  password: string;
};

async function syncSessionToServer(session: Session) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: session.access_token, refreshToken: session.refresh_token }),
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Unable to save your session.");
  }
}

export function AuthForms(props: { initialMode?: "signin" | "signup" }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [signIn, setSignIn] = useState({ email: "", password: "" });
  const [signUp, setSignUp] = useState<SignUpPayload>({
    fullName: "", companyName: "", phone: "", roleTitle: "", email: "", password: "",
  });

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErrorMessage(""); setSuccessMessage(""); setIsSigningIn(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword(signIn);
      if (error) throw error;
      if (!data.session) throw new Error("Your session could not be created. Please try again.");
      await syncSessionToServer(data.session);
      const request = await fetch("/api/account-requests/current");
      const requestData = request.ok ? await request.json() as { pending?: boolean } : {};
      window.location.assign(requestData.pending ? "/account-request-received" : "/");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now."); }
    finally { setIsSigningIn(false); }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErrorMessage(""); setSuccessMessage(""); setIsSigningUp(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: signUp.email.trim(), password: signUp.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?mode=signup&next=/account-request-received`,
          data: { account_request: { fullName: signUp.fullName.trim(), companyName: signUp.companyName.trim(), phone: signUp.phone.trim(), roleTitle: signUp.roleTitle.trim() } },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setSuccessMessage("Check your email to confirm your account. We will create your request after confirmation.");
        return;
      }
      await syncSessionToServer(data.session);
      const requestResult = await fetch("/api/account-requests", { method: "POST" });
      if (!requestResult.ok) { const payload = await requestResult.json() as { error?: string }; throw new Error(payload.error ?? "Unable to submit your account request."); }
      window.location.assign("/account-request-received");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to submit your account request right now."); }
    finally { setIsSigningUp(false); }
  }

  async function handleForgotPassword() {
    setErrorMessage(""); setSuccessMessage("");
    if (!signIn.email.trim()) { setErrorMessage("Enter your email address first, then request a password reset."); return; }
    setIsSendingReset(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(signIn.email.trim(), { redirectTo: `${window.location.origin}/auth/confirm?mode=recovery&next=/` });
      if (error) throw error;
      setSuccessMessage("Password reset email sent. Check your inbox and follow the link to choose a new password.");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to send a password reset email right now."); }
    finally { setIsSendingReset(false); }
  }

  const signupFirst = props.initialMode === "signup";
  const signInCard = <section className="theme-panel-strong rounded-[1.75rem] p-8"><h2 className="font-display text-3xl text-slate-900">Sign In</h2><p className="mt-3 text-sm leading-6 text-slate-600">Use the login provided by your organization administrator.</p><form onSubmit={handleSignIn} className="mt-6 space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email</span><input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" type="email" required autoComplete="email" value={signIn.email} onChange={(event) => setSignIn({ ...signIn, email: event.target.value })} /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" type="password" required autoComplete="current-password" value={signIn.password} onChange={(event) => setSignIn({ ...signIn, password: event.target.value })} /></label><button type="button" onClick={() => void handleForgotPassword()} className="text-sm font-semibold text-teal-800">Forgot password?</button><button className="interactive-contrast w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isSigningIn || isSendingReset}>{isSigningIn ? "Signing in…" : "Sign In"}</button></form></section>;
  const signUpCard = <section className="theme-panel-strong rounded-[1.75rem] p-8 ring-2 ring-sky-200"><h2 className="font-display text-3xl text-slate-900">Request an account</h2><p className="mt-3 text-sm leading-6 text-slate-600">Tell us about your organization. Your information is held securely while our team contacts you to set up the right plan.</p><form onSubmit={handleSignUp} className="mt-6 grid gap-4 sm:grid-cols-2">{([['fullName','Your name','text'],['companyName','Company','text'],['phone','Phone','tel'],['roleTitle','Your role','text'],['email','Work email','email'],['password','Password (8+ characters)','password']] as const).map(([key,label,type]) => <label key={key} className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" type={type} required minLength={key === 'password' ? 8 : undefined} autoComplete={key === 'password' ? 'new-password' : undefined} value={signUp[key]} onChange={(event) => setSignUp({ ...signUp, [key]: event.target.value })} /></label>)}<button className="interactive-contrast sm:col-span-2 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isSigningUp}>{isSigningUp ? "Submitting…" : "Submit account request"}</button></form></section>;
  return <>{errorMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">{errorMessage}</div> : null}{successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900">{successMessage}</div> : null}<div className="grid gap-6 lg:grid-cols-2">{signupFirst ? <>{signUpCard}{signInCard}</> : <>{signInCard}{signUpCard}</>}</div></>;
}
