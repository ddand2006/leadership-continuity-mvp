import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";
import { AuthForms } from "@/components/auth-forms";

type AuthPageProps = {
  searchParams: Promise<{
    message?: string;
    mode?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { message, mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-10 px-6 py-12 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl leading-tight text-slate-900">
              {initialMode === "signup"
                ? "Create your Leadership Continuity account"
                : "Sign in to the Leadership Continuity MVP"}
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

        <AuthForms initialMode={initialMode} />
      </div>
    </main>
  );
}
