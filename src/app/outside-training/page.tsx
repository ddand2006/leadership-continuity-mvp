import { redirect } from "next/navigation";
import {
  isAdminAppRole,
  isMentorAppUser,
} from "@/lib/mentor-access";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { OutsideTrainingFinder } from "@/components/outside-training-finder";
import {
  normalizeTrainingCompetencyName,
  temporaryTrainingPrograms,
} from "@/lib/outside-training-programs";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

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
      .select("id, title, department, description")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
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
    competencies: (competenciesByRoleId.get(role.id) ?? []).map((competency) => ({
      ...competency,
      weight: Number(competency.weight ?? 0),
    })),
  }));
  const competencyCount = competenciesResult.data?.length ?? 0;
  const rolesPerCompetency = new Map<string, Set<string>>();

  for (const role of roles) {
    for (const competency of role.competencies) {
      const normalizedName = normalizeTrainingCompetencyName(competency.name);
      const matchingRoles = rolesPerCompetency.get(normalizedName) ?? new Set<string>();
      matchingRoles.add(role.id);
      rolesPerCompetency.set(normalizedName, matchingRoles);
    }
  }

  const sharedTrainingOpportunityCount = [...rolesPerCompetency.values()].filter(
    (matchingRoles) => matchingRoles.size > 1,
  ).length;

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
            Explore outside training programs based on the leadership priorities of
            each organizational role. Select a role, choose a development priority,
            and compare programs that may strengthen that capability across one or
            more leaders.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Roles reviewed
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{roles.length}</p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Leadership priorities
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {competencyCount}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Training programs available
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {temporaryTrainingPrograms.length}
            </p>
          </article>
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Shared training opportunities
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {sharedTrainingOpportunityCount}
            </p>
          </article>
        </section>

        <OutsideTrainingFinder roles={roles} />
      </div>
    </main>
  );
}
