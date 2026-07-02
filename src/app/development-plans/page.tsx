import { DevelopmentPlanGeneratorCard } from "@/components/development-plan-generator-card";
import { hasOpenAIEnv } from "@/lib/env";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function DevelopmentPlansPage() {
  const { profile, supabase } = await requireWorkspaceProfile();
  const canGenerate = hasOpenAIEnv();
  const [plansResult, rolesResult] = await Promise.all([
    supabase
      .from("development_projects")
      .select(
        "id, title, description, difficulty, duration_days, applicable_roles, competencies_developed, strengths_leveraged",
      )
      .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`)
      .order("duration_days", { ascending: true }),
    supabase
      .from("roles")
      .select("id, title, department")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: true }),
  ]);

  if (plansResult.error) {
    throw new Error(plansResult.error.message);
  }

  if (rolesResult.error) {
    throw new Error(rolesResult.error.message);
  }

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="theme-panel-strong rounded-[2rem] p-8">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Development Plan Library
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
            Development plans aligned to roles, gaps, and strengths
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            These seeded plans are the recommendation engine&apos;s working library
            for mentoring assignments. They carry role, competency, and strength
            metadata that can later be tied directly to a candidate&apos;s development
            path.
          </p>
        </section>

        <DevelopmentPlanGeneratorCard
          roles={(rolesResult.data ?? []).map((role) => ({
            id: role.id,
            title: role.title,
            department: role.department,
          }))}
          canGenerate={canGenerate}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {(plansResult.data ?? []).map((plan) => (
            <article
              key={plan.id}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-3xl leading-tight text-slate-900">
                  {plan.title}
                </h2>
                <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
                  {plan.duration_days} days
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {plan.description}
              </p>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Difficulty</p>
                  <p className="mt-2 capitalize">{plan.difficulty}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Applicable roles</p>
                  <p className="mt-2 leading-7">
                    {(plan.applicable_roles as string[]).join(" • ")}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    Competencies developed
                  </p>
                  <p className="mt-2 leading-7">
                    {(plan.competencies_developed as string[]).join(" • ")}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">
                    Strengths leveraged
                  </p>
                  <p className="mt-2 leading-7">
                    {(plan.strengths_leveraged as string[]).join(" • ")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
