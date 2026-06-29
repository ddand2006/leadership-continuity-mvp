import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";
import { signInAction, signUpAction } from "./actions";

type AuthPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

function AuthCard({
  title,
  description,
  action,
  cta,
}: {
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  cta: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <h2 className="font-display text-3xl text-slate-900">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <form action={action} className="mt-6 space-y-4">
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
          />
        </label>
        <button
          className="interactive-contrast w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
          type="submit"
        >
          {cta}
        </button>
      </form>
    </section>
  );
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { message } = await searchParams;

  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl leading-tight text-slate-900">
              Sign in to the Leadership Continuity MVP
            </h1>
          </div>
          <Link
            href="/"
            className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            Back Home
          </Link>
        </div>

        {message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
            {message}
          </div>
        ) : null}

        {!hasSupabaseEnv() ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-8 text-sm leading-7 text-slate-700">
            Add your Supabase URL and API key values to
            {" "}
            <code className="rounded bg-slate-100 px-2 py-1">.env.local</code>
            {" "}
            before using auth. This page is already wired for the connection once
            the new project exists.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <AuthCard
            title="Sign In"
            description="Use email and password for administrators, interviewers, or mentors once they exist in Supabase Auth."
            action={signInAction}
            cta="Sign In"
          />
          <AuthCard
            title="Create Account"
            description="Create the first authenticated user. Supabase will send a confirmation email to complete the account setup."
            action={signUpAction}
            cta="Create Account"
          />
        </div>
      </div>
    </main>
  );
}
