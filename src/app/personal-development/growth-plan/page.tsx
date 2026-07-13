import Link from "next/link";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { loadPersonalDevelopmentWorkspaceData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentGrowthPlanPage() {
  const workspace = await loadPersonalDevelopmentWorkspaceData();
  const detailItems = [
    `Role profile: ${workspace.roleProfile?.title ?? "Not started"}`,
    `Composite status: ${workspace.latestComposite?.status ?? "Not generated yet"}`,
    `Strengths imported: ${workspace.strengthsCount}`,
    `Coaching sessions: ${workspace.coachingRequestCount}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="growth-plan"
        />

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Growth Plan
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Growth planning is staged after role, composite, and strengths
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            This workspace will eventually generate the leader&apos;s top development
            priorities, learning actions, stretch assignments, and review cadence.
            The plan should synthesize the role profile, composite, strengths,
            coaching patterns, and future 360 feedback.
          </p>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Build order for this page</p>
            <p className="mt-3 leading-7">
              Save the role profile first, then generate the leadership composite,
              then wire strengths import. After those pieces are in place, this page
              can generate a meaningful personal growth plan instead of a generic
              checklist.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/personal-development/coaching"
              className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Open Coaching
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
