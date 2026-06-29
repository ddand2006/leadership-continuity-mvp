import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintCompositeActions } from "@/components/print-composite-actions";
import { PrintCompositePageClient } from "@/components/print-composite-page-client";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { requireWorkspaceProfile } from "@/lib/workspace";

type PrintRoleCompositePageProps = {
  params: Promise<{
    roleId: string;
  }>;
};

export default async function PrintRoleCompositePage({
  params,
}: PrintRoleCompositePageProps) {
  const { roleId } = await params;
  const { profile, supabase } = await requireWorkspaceProfile();

  const [
    roleResult,
    characteristicsResult,
    competenciesResult,
    assignmentsResult,
    mentorsResult,
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id, title, department, description, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", roleId)
      .maybeSingle(),
    supabase
      .from("role_candidate_characteristics")
      .select("category, characteristic, sort_order")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("role_competencies")
      .select(
        "id, name, definition, weight, target_score, behavioral_indicators, red_flags",
      )
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .order("created_at", { ascending: true }),
    supabase
      .from("role_mentor_assignments")
      .select("mentor_profile_id, status")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId),
    supabase
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", profile.organization_id)
      .eq("role", "mentor"),
  ]);

  if (roleResult.error || characteristicsResult.error || competenciesResult.error) {
    throw new Error(
      roleResult.error?.message ??
        characteristicsResult.error?.message ??
        competenciesResult.error?.message ??
        "Unable to load the printable role composite.",
    );
  }

  if (assignmentsResult.error || mentorsResult.error) {
    throw new Error(
      assignmentsResult.error?.message ??
        mentorsResult.error?.message ??
        "Unable to load mentor assignments.",
    );
  }

  if (!roleResult.data) {
    notFound();
  }

  const role = roleResult.data;
  const characteristics = groupCharacteristicsByCategory(
    characteristicsResult.data ?? [],
  );
  const mentorMap = new Map(
    (mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const assignedMentors = Array.from(
    new Set(
      (assignmentsResult.data ?? [])
        .filter((assignment) => assignment.status === "active")
        .flatMap((assignment) => {
          const mentor = mentorMap.get(assignment.mentor_profile_id);

          if (!mentor) {
            return [];
          }

          return [
            mentor.position_title
              ? `${mentor.full_name} • ${mentor.position_title}`
              : mentor.full_name,
          ];
        }),
    ),
  );

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <PrintCompositePageClient />
      <div className="mx-auto max-w-5xl px-8 py-10 print:px-0 print:py-0">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Printable Role Composite
            </p>
            <h1 className="mt-2 font-display text-3xl text-slate-900">
              {role.title}
            </h1>
          </div>
          <div className="flex gap-3">
            <PrintCompositeActions />
            <Link
              href={`/roles?mode=view&roleId=${role.id}`}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Roles
            </Link>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] print:rounded-none print:border-none print:p-0 print:shadow-none">
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                {role.department || "Role Composite"}
              </p>
              <h2 className="mt-3 font-display text-5xl leading-tight text-slate-900">
                {role.title}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700">
                {role.description}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Assigned mentors:{" "}
                <span className="font-semibold text-slate-900">
                  {assignedMentors.length > 0
                    ? assignedMentors.join(", ")
                    : "None yet"}
                </span>
              </p>
            </div>
            <div className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
              {role.status}
            </div>
          </div>

          <section className="mt-8">
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Ideal Candidate Competencies
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                { title: "Talents", items: characteristics.talents },
                { title: "Skills", items: characteristics.skills },
                { title: "Behaviors", items: characteristics.behaviors },
              ].map((group) => (
                <article
                  key={group.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-lg font-semibold text-slate-900">
                    {group.title}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                    {group.items.length > 0 ? (
                      group.items.map((item) => <li key={item}>• {item}</li>)
                    ) : (
                      <li>No {group.title.toLowerCase()} attached yet.</li>
                    )}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Composite Competency Areas
            </p>
            <div className="mt-4 grid gap-5">
              {(competenciesResult.data ?? []).length > 0 ? (
                (competenciesResult.data ?? []).map((competency) => (
                  <article
                    key={competency.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {competency.name}
                      </h3>
                      <div className="text-right text-sm font-semibold text-slate-600">
                        <p>Target {competency.target_score.toFixed(2)}</p>
                        <p>Weight {competency.weight.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">
                      {competency.definition}
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          Behavioral Indicators
                        </p>
                        <ul className="mt-3 space-y-2 leading-7">
                          {((competency.behavioral_indicators as string[]) ?? []).map(
                            (item) => (
                              <li key={item}>• {item}</li>
                            ),
                          )}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Red Flags</p>
                        <ul className="mt-3 space-y-2 leading-7">
                          {((competency.red_flags as string[]) ?? []).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                  No generated composite sections exist for this role yet. Add
                  competencies and generate the composite first.
                </article>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
