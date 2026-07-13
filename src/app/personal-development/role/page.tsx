import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { PersonalRoleProfileForm } from "@/components/personal-role-profile-form";
import { loadPersonalDevelopmentWorkspaceData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentRolePage() {
  const workspace = await loadPersonalDevelopmentWorkspaceData();
  const detailItems = [
    `Current position: ${
      workspace.personalProfile?.current_position_title ??
      workspace.profilePositionTitle ??
      "Not entered"
    }`,
    `Role mode: ${
      workspace.roleProfile?.role_mode === "organization_role"
        ? "Connected to organizational role"
        : workspace.roleProfile?.role_mode === "personal_role"
          ? "Personal role profile"
          : "Not chosen yet"
    }`,
    `Composite status: ${workspace.latestComposite?.status ?? "Not generated yet"}`,
    `Strengths on file: ${workspace.strengthsCount}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="role"
        />

        {!workspace.migrationReady ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase">
              Personal Development Migration
            </p>
            <h2 className="mt-3 font-display text-3xl">
              Apply the Personal Development foundation migration first
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7">
              This role workspace is ready in code, but the new Personal
              Development tables have not been created in Supabase yet. Apply the
              latest migration, then return here to save the leader&apos;s role
              profile.
            </p>
          </section>
        ) : (
          <PersonalRoleProfileForm
            roles={workspace.roles.map((role) => ({
              id: role.id,
              title: role.title,
              department: role.department,
              description: role.description,
              status: role.status,
            }))}
            initialRoleMode={
              workspace.roleProfile?.role_mode ??
              (workspace.roles.length > 0 ? "organization_role" : "personal_role")
            }
            initialSourceRoleId={workspace.roleProfile?.source_role_id ?? null}
            initialTitle={workspace.roleProfile?.role_mode === "personal_role" ? workspace.roleProfile.title : ""}
            initialDepartment={
              workspace.roleProfile?.role_mode === "personal_role"
                ? (workspace.roleProfile.department ?? "")
                : ""
            }
            initialDescription={
              workspace.roleProfile?.role_mode === "personal_role"
                ? workspace.roleProfile.description
                : ""
            }
            initialCurrentPositionTitle={
              workspace.personalProfile?.current_position_title ??
              workspace.profilePositionTitle ??
              ""
            }
            initialYearsInRole={
              workspace.personalProfile?.years_in_role !== null &&
              workspace.personalProfile?.years_in_role !== undefined
                ? String(workspace.personalProfile.years_in_role)
                : ""
            }
            initialLeadershipHistory={
              workspace.personalProfile?.leadership_history ?? ""
            }
            initialOrganizationalContext={
              workspace.personalProfile?.organizational_context ?? ""
            }
          />
        )}
      </div>
    </main>
  );
}
