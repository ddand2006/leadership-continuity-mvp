import { redirect } from "next/navigation";
import { AdministrationPanel } from "@/components/administration-panel";
import { isAdminAppRole } from "@/lib/mentor-access";
import { loadAdministrationUsers } from "@/lib/organization-user-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

export default async function AdministrationPage() {
  const { profile } = await requirePaidWorkspaceProfile();

  if (!isAdminAppRole(profile.role)) {
    redirect("/dashboard?message=Administration+is+available+to+organization+admins+only.");
  }

  const admin = createSupabaseAdminClient();
  const users = await loadAdministrationUsers({
    admin,
    organizationId: profile.organization_id,
  });
  const summary = {
    activeCandidates: users.filter(
      (user) => user.status === "active" && user.is_candidate,
    ).length,
    activeMentors: users.filter(
      (user) => user.status === "active" && user.is_mentor,
    ).length,
    suspendedUsers: users.filter((user) => user.status === "suspended").length,
    pendingInvitations: users.filter((user) => user.status === "invited").length,
  };

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="theme-panel-strong rounded-[2rem] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                Administration
              </p>
              <h1 className="mt-3 font-display text-5xl leading-tight text-slate-950">
                Administration
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Manage candidates, mentors, and administrative access from one
                protected control surface while preserving historical leadership
                development data for reporting.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm leading-7 text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              CEO Admin and Manager Admin currently share the same permissions for
              the MVP.
            </div>
          </div>
        </section>

        <AdministrationPanel users={users} summary={summary} />
      </div>
    </main>
  );
}
