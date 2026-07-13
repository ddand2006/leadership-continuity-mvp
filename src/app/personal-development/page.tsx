import Link from "next/link";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { loadPersonalDevelopmentWorkspaceData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

function getRoleStatusLabel(workspace: Awaited<ReturnType<typeof loadPersonalDevelopmentWorkspaceData>>) {
  if (!workspace.migrationReady) {
    return "Apply migration";
  }

  if (!workspace.personalProfile || !workspace.roleProfile) {
    return "Set up role";
  }

  return workspace.roleProfile.role_mode === "organization_role"
    ? "Connected to organization role"
    : "Personal role saved";
}

export default async function PersonalDevelopmentPage() {
  const workspace = await loadPersonalDevelopmentWorkspaceData();
  const detailItems = [
    `Current position: ${
      workspace.personalProfile?.current_position_title ??
      workspace.profilePositionTitle ??
      "Not entered"
    }`,
    `Role profile: ${workspace.roleProfile?.title ?? "Not started"}`,
    `Composite status: ${workspace.latestComposite?.status ?? "Not generated yet"}`,
    `Strengths imported: ${workspace.strengthsCount}`,
    `Coaching requests: ${workspace.coachingRequestCount}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="dashboard"
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
              The workspace shell is ready, but the new Personal Development
              profile, role, composite, document, and strengths tables have not
              been created in Supabase yet. Apply the latest migration to unlock
              the real dashboard experience.
            </p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "My Role",
              body:
                workspace.roleProfile?.title ??
                "Define the role you want to grow in so every later workflow uses the same context.",
              status: getRoleStatusLabel(workspace),
              href: "/personal-development/role",
            },
            {
              title: "Leadership Composite",
              body: workspace.latestComposite
                ? `Version ${workspace.latestComposite.version} is on file for this leader.`
                : "Generate a personal leadership composite after your role profile is ready.",
              status: workspace.latestComposite?.status ?? "Not generated",
              href: "/personal-development/composite",
            },
            {
              title: "CliftonStrengths",
              body:
                workspace.strengthsCount > 0
                  ? `${workspace.strengthsCount} strengths are already stored in this personal workspace.`
                  : "Wire Gallup uploads into the personal profile so coaching can reference strengths directly.",
              status:
                workspace.strengthsCount > 0
                  ? `${workspace.strengthsCount} imported`
                  : "Awaiting upload",
              href: "/personal-development/strengths",
            },
            {
              title: "AI Coaching",
              body:
                workspace.coachingRequestCount > 0
                  ? `${workspace.coachingRequestCount} coaching request${workspace.coachingRequestCount === 1 ? "" : "s"} are already on record.`
                  : "Use the coaching workspace to capture live leadership challenges and receive practical guidance.",
              status: workspace.hasOpenAI ? "AI available" : "OPENAI_API_KEY needed",
              href: "/personal-development/coaching",
            },
          ].map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-teal-900 uppercase">
                  {card.status}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Phase 1 Build Path
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Start with role clarity, then layer in insight
            </h2>
            <div className="mt-6 grid gap-4">
              {[
                "1. Save the leader’s role profile or connect to an organizational role.",
                "2. Reuse the composite generator to build a personal leadership composite.",
                "3. Reuse Gallup parsing to import strengths into the personal workspace.",
                "4. Use the coaching workspace with role, composite, and strengths context.",
              ].map((item) => (
                <article
                  key={item}
                  className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700"
                >
                  {item}
                </article>
              ))}
            </div>
          </section>

          <aside className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Next Milestone
            </p>
            <h2 className="mt-3 font-display text-3xl text-[#183822]">
              Make the workspace real for one leader first
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#24512f]">
              The strongest Phase 1 outcome is a private leadership workspace that
              knows the leader&apos;s role, later knows their composite, then applies
              strengths-aware coaching to real challenges over time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/personal-development/role"
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Role Profile
              </Link>
              <Link
                href="/personal-development/coaching"
                className="rounded-full border border-[rgba(82,140,94,0.24)] bg-white/85 px-5 py-3 text-sm font-semibold text-[#24512f] transition hover:bg-white"
              >
                Open Coaching
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
