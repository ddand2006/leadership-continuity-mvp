import { redirect } from "next/navigation";
import {
  isAdminAppRole,
  isMentorAppUser,
} from "@/lib/mentor-access";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

const trainingProviders = [
  {
    name: "FranklinCovey",
    focus: "Leadership habits, execution, trust, and personal effectiveness.",
  },
  {
    name: "The Ken Blanchard Companies",
    focus: "Situational leadership, coaching, and manager development.",
  },
  {
    name: "BlessingWhite",
    focus: "Employee engagement, leadership alignment, and development strategy.",
  },
  {
    name: "Crucial Learning",
    focus: "Communication, accountability, influence, and high-stakes conversations.",
  },
  {
    name: "Additional providers",
    focus: "Add providers that best match your industry, culture, and competency priorities.",
  },
] as const;

export default async function OutsideTrainingPage() {
  const { account, profile, supabase } = await requirePaidWorkspaceProfile();
  const canAccessOutsideTraining =
    isAdminAppRole(profile.role) || isMentorAppUser(profile, account);

  if (!canAccessOutsideTraining) {
    redirect(
      "/candidates?message=Outside+training+resources+are+available+to+organization+administrators+and+mentors",
    );
  }

  const [rolesResult, competenciesResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, title, department, status")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("role_competencies")
      .select("id, role_id, name, definition, weight")
      .eq("organization_id", profile.organization_id)
      .order("weight", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (rolesResult.error) {
    throw new Error(rolesResult.error.message);
  }

  if (competenciesResult.error) {
    throw new Error(competenciesResult.error.message);
  }

  const competenciesByRoleId = new Map<string, (typeof competenciesResult.data)[number][]>();

  for (const competency of competenciesResult.data ?? []) {
    const competencies = competenciesByRoleId.get(competency.role_id) ?? [];
    competencies.push(competency);
    competenciesByRoleId.set(competency.role_id, competencies);
  }

  const roles = (rolesResult.data ?? []).map((role) => ({
    ...role,
    title: canonicalizeRoleTitle(role.title),
    competencies: competenciesByRoleId.get(role.id) ?? [],
  }));
  const competencyCount = competenciesResult.data?.length ?? 0;

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="theme-panel-strong rounded-[2rem] p-8 sm:p-10">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Resources
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
            Outside Training
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            This page reviews the competencies across all roles in your organization
            and creates a starting list of potential outside training providers to
            support leadership development.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Roles reviewed
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{roles.length}</p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Competencies available
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {competencyCount}
            </p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Competency review
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Leadership priorities by role
            </h2>
            <div className="mt-6 grid gap-4">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <article
                    key={role.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {role.title}
                      </h3>
                      {role.department ? (
                        <p className="text-sm text-slate-500">{role.department}</p>
                      ) : null}
                    </div>
                    {role.competencies.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {role.competencies.map((competency) => (
                          <span
                            key={competency.id}
                            title={competency.definition ?? undefined}
                            className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-900"
                          >
                            {competency.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        Add competencies to this role to include it in the training review.
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  Add roles and their competencies first. They will appear here as the
                  foundation for evaluating outside training options.
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Potential training providers
            </p>
            <h2 className="mt-3 font-display text-3xl text-[#183822]">
              Options to explore
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#24512f]">
              Use the role competencies to compare programs, course formats, and
              facilitators before selecting a provider. These are starting points,
              not endorsements.
            </p>
            <div className="mt-6 grid gap-3">
              {trainingProviders.map((provider) => (
                <article
                  key={provider.name}
                  className="rounded-2xl border border-[rgba(82,140,94,0.18)] bg-white/70 p-4"
                >
                  <h3 className="font-semibold text-[#183822]">{provider.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#24512f]">
                    {provider.focus}
                  </p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
