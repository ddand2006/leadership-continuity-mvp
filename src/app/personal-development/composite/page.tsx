import Link from "next/link";
import { PersonalLeadershipCompositePanel } from "@/components/personal-leadership-composite-panel";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { loadPersonalDevelopmentWorkspaceData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentCompositePage() {
  const workspace = await loadPersonalDevelopmentWorkspaceData();
  const detailItems = [
    `Role profile: ${workspace.roleProfile?.title ?? "Not started"}`,
    `Composite status: ${workspace.latestComposite?.status ?? "Not generated yet"}`,
    `Composite version: ${
      workspace.latestComposite ? String(workspace.latestComposite.version) : "None yet"
    }`,
    `Strengths on file: ${workspace.strengthsCount}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="composite"
        />

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Leadership Composite
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Keep your composite current without leaving this workspace
          </h2>
          {!workspace.migrationReady ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              The migration for Personal Development foundation tables still needs
              to be applied before this composite workspace can store output.
            </p>
          ) : !workspace.roleProfile ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Save your role profile first so the composite generator has the right
              role context to work from.
            </p>
          ) : (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Generate a personal leadership composite from your saved role
              context, then refine it over time without leaving this workspace.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/personal-development/role"
              className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Open Role Profile
            </Link>
          </div>
        </section>

        {workspace.migrationReady && workspace.roleProfile ? (
          <PersonalLeadershipCompositePanel
            hasOpenAI={workspace.hasOpenAI}
            roleTitle={workspace.roleProfile.title}
            latestComposite={workspace.latestComposite}
          />
        ) : null}
      </div>
    </main>
  );
}
