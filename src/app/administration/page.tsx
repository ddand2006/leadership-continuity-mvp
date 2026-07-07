import { redirect } from "next/navigation";
import { AdministrationPanel } from "@/components/administration-panel";
import { isAdminAppRole } from "@/lib/mentor-access";
import { loadAdministrationUsers } from "@/lib/organization-user-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

type AdministrationPageProps = {
  searchParams: Promise<{
    organizationId?: string;
  }>;
};

export default async function AdministrationPage({
  searchParams,
}: AdministrationPageProps) {
  const { profile } = await requireWorkspaceProfile();
  const { organizationId: requestedOrganizationId } = await searchParams;

  if (!isAdminAppRole(profile.role)) {
    redirect("/dashboard?message=Administration+is+available+to+organization+admins+only.");
  }

  const admin = createSupabaseAdminClient();
  const isSystemAdmin = profile.role === "system_admin";
  const organizationsResult = isSystemAdmin
    ? await admin
        .from("organizations")
        .select(
          "id, name, industry, subscription_status, billing_contact_email, leadership_continuity_enabled, leadership_continuity_tier, leadership_help_enabled, leadership_help_tier",
        )
        .order("name", { ascending: true })
    : await admin
        .from("organizations")
        .select(
          "id, name, industry, subscription_status, billing_contact_email, leadership_continuity_enabled, leadership_continuity_tier, leadership_help_enabled, leadership_help_tier",
        )
        .eq("id", profile.organization_id)
        .order("name", { ascending: true });

  if (organizationsResult.error) {
    throw new Error(organizationsResult.error.message);
  }

  const organizations = organizationsResult.data ?? [];
  const selectedOrganization =
    (requestedOrganizationId &&
      organizations.find((organization) => organization.id === requestedOrganizationId)) ||
    organizations.find((organization) => organization.id === profile.organization_id) ||
    organizations[0] ||
    null;

  if (!selectedOrganization) {
    throw new Error("No organization could be loaded for administration.");
  }

  const users = await loadAdministrationUsers({
    admin,
    organizationId: selectedOrganization.id,
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
                Manage companies, product access, candidates, mentors, and
                administrative access from one protected control surface while
                preserving historical leadership development data for reporting.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm leading-7 text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              {isSystemAdmin
                ? "System Admin can create companies, switch company context, and manage product access across the full platform."
                : "CEO Admin and Manager Admin currently share the same permissions inside their organization."}
            </div>
          </div>
        </section>

        <AdministrationPanel
          users={users}
          summary={summary}
          organizations={organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            industry: organization.industry ?? null,
            subscription_status: organization.subscription_status,
            billing_contact_email: organization.billing_contact_email ?? null,
            leadership_continuity_enabled:
              organization.leadership_continuity_enabled,
            leadership_continuity_tier:
              organization.leadership_continuity_tier,
            leadership_help_enabled: organization.leadership_help_enabled,
            leadership_help_tier: organization.leadership_help_tier,
          }))}
          selectedOrganizationId={selectedOrganization.id}
          canManageOrganizations={isSystemAdmin}
        />
      </div>
    </main>
  );
}
