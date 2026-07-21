import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";
import { AuthForms } from "@/components/auth-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuthPageProps = {
  searchParams: Promise<{
    message?: string;
    mode?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { message, mode } = await searchParams;
  let hasExistingWorkspaceUsers = false;

  if (hasSupabaseEnv()) {
    const admin = createSupabaseAdminClient();
    const organizationUsersResult = await admin
      .from("organization_users")
      .select("id", { head: true, count: "exact" });

    if (organizationUsersResult.error) {
      throw new Error(organizationUsersResult.error.message);
    }

    hasExistingWorkspaceUsers = (organizationUsersResult.count ?? 0) > 0;
  }

  const requestedMode = mode === "signup" ? "signup" : "signin";
  const initialMode = requestedMode;

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
            {hasExistingWorkspaceUsers ? (
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                New candidate and mentor access is created by an administrator
                through the invite workflow so user types stay assigned by the
                organization. Use create account only when starting a new
                organization workspace.
              </p>
            ) : null}
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

        {hasExistingWorkspaceUsers && requestedMode === "signup" ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-medium text-sky-900">
            Create Account remains available for new workspace owners. Invited
            candidates, mentors, and administrators should sign in with the
            account or invitation already created for them.
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

        <AuthForms
          initialMode={initialMode}
          signUpContext={
            hasExistingWorkspaceUsers ? "new-workspace" : "first-workspace"
          }
        />
      </div>
    </main>
  );
}
