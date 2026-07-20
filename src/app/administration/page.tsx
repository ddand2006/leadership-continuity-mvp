import Link from "next/link";
import { redirect } from "next/navigation";
import { AdministrationPanel } from "@/components/administration-panel";
import { isAdminAppRole } from "@/lib/mentor-access";
import { loadAdministrationUsers } from "@/lib/organization-user-admin";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

type AdministrationPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    section?: string;
  }>;
};

export default async function AdministrationPage({
  searchParams,
}: AdministrationPageProps) {
  const { profile } = await requireWorkspaceProfile();
  const {
    organizationId: requestedOrganizationId,
    section: requestedSection,
  } = await searchParams;

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

  const [users, candidatesResult, rolesResult, mentorsResult] = await Promise.all([
    loadAdministrationUsers({
      admin,
      organizationId: selectedOrganization.id,
    }),
    admin
      .from("candidates")
      .select("id, full_name")
      .eq("organization_id", selectedOrganization.id)
      .order("full_name", { ascending: true }),
    admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", selectedOrganization.id)
      .order("title", { ascending: true }),
    admin
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", selectedOrganization.id)
      .eq("role", "mentor")
      .order("full_name", { ascending: true }),
  ]);

  for (const result of [candidatesResult, rolesResult, mentorsResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

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

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { id: "user-access", label: "Add Users" },
              { id: "assign-mentors", label: "Assign Mentors" },
              { id: "organization-controls", label: "Organization Controls" },
            ].map((tab) => {
              const isActive = (requestedSection ?? "user-access") === tab.id;
              const href = `/administration?organizationId=${encodeURIComponent(selectedOrganization.id)}&section=${encodeURIComponent(tab.id)}`;

              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </section>

        <AdministrationPanel
          initialTab={
            requestedSection === "assign-mentors"
              ? "assign-mentors"
              : requestedSection === "organization-controls"
                ? "organization-controls"
                : requestedSection === "user-access"
                ? "user-access"
                : "user-access"
          }
          mentorAssignmentOptions={{
            candidates: (candidatesResult.data ?? []).map((candidate) => ({
              id: candidate.id,
              full_name: candidate.full_name,
            })),
            roles: (rolesResult.data ?? []).map((role) => ({
              id: role.id,
              title: canonicalizeRoleTitle(role.title),
            })),
            mentors: (mentorsResult.data ?? []).map((mentor) => ({
              id: mentor.id,
              full_name: mentor.full_name,
              position_title: mentor.position_title,
            })),
          }}
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
          canEditOrganizationAccess={isAdminAppRole(profile.role)}
          canCreateOrganizations={isSystemAdmin}
        />
      </div>
    </main>
  );
}
