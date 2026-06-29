import { RoleFocusSelector } from "@/components/role-focus-selector";
import { RoleFlowPanel } from "@/components/role-flow-panel";
import { RoleManagementPanel } from "@/components/role-management-panel";
import { RoleMentorDialog } from "@/components/role-mentor-dialog";
import { RoleResourcesPanel } from "@/components/role-resources-panel";
import { hasOpenAIEnv } from "@/lib/env";
import {
  isMissingRoleCharacteristicLibraryTableError,
  normalizeRoleLibraryCharacteristic,
} from "@/lib/role-characteristic-library";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { requireWorkspaceProfile } from "@/lib/workspace";

type RolesPageProps = {
  searchParams: Promise<{
    roleId?: string;
    mode?: string;
  }>;
};

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const { roleId: requestedRoleId, mode: requestedMode } = await searchParams;
  const { profile, supabase } = await requireWorkspaceProfile();
  const canGenerateComposite = hasOpenAIEnv();
  const [
    rolesResult,
    competenciesResult,
    characteristicsResult,
    sharedLibraryResult,
    compositeDocumentsResult,
    mentorsResult,
    roleMentorAssignmentsResult,
  ] =
    await Promise.all([
      supabase
        .from("roles")
        .select("id, title, department, description, status")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("role_competencies")
        .select(
          "id, role_id, name, definition, weight, target_score, behavioral_indicators, red_flags",
        )
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("role_candidate_characteristics")
        .select("id, role_id, category, characteristic, sort_order")
        .eq("organization_id", profile.organization_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("role_characteristic_library")
        .select("id, category, characteristic")
        .eq("organization_id", profile.organization_id)
        .order("characteristic", { ascending: true }),
      supabase
        .from("role_composite_documents")
        .select("id, role_id, document_source, file_name, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, position_title")
        .eq("organization_id", profile.organization_id)
        .eq("role", "mentor")
        .order("created_at", { ascending: true }),
      supabase
        .from("role_mentor_assignments")
        .select("role_id, mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true }),
    ]);

  if (rolesResult.error) {
    throw new Error(rolesResult.error.message);
  }

  if (competenciesResult.error) {
    throw new Error(competenciesResult.error.message);
  }

  if (characteristicsResult.error) {
    throw new Error(characteristicsResult.error.message);
  }

  if (
    sharedLibraryResult.error &&
    !isMissingRoleCharacteristicLibraryTableError(sharedLibraryResult.error)
  ) {
    throw new Error(sharedLibraryResult.error.message);
  }

  if (compositeDocumentsResult.error) {
    throw new Error(compositeDocumentsResult.error.message);
  }

  if (mentorsResult.error) {
    throw new Error(mentorsResult.error.message);
  }

  if (roleMentorAssignmentsResult.error) {
    throw new Error(roleMentorAssignmentsResult.error.message);
  }

  const competenciesByRole = new Map<string, typeof competenciesResult.data>();
  const characteristicsByRole = new Map<string, typeof characteristicsResult.data>();
  const compositeDocumentByRole = new Map<
    string,
    NonNullable<typeof compositeDocumentsResult.data>[number]
  >();
  const mentorMap = new Map((mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]));
  const mentorsByRole = new Map<string, string[]>();
  const primaryMentorIdByRole = new Map<string, string>();

  for (const competency of competenciesResult.data ?? []) {
    const current = competenciesByRole.get(competency.role_id) ?? [];
    current.push(competency);
    competenciesByRole.set(competency.role_id, current);
  }

  for (const characteristic of characteristicsResult.data ?? []) {
    const current = characteristicsByRole.get(characteristic.role_id) ?? [];
    current.push(characteristic);
    characteristicsByRole.set(characteristic.role_id, current);
  }

  for (const document of compositeDocumentsResult.data ?? []) {
    if (!compositeDocumentByRole.has(document.role_id)) {
      compositeDocumentByRole.set(document.role_id, document);
    }
  }

  for (const assignment of roleMentorAssignmentsResult.data ?? []) {
    const mentor = mentorMap.get(assignment.mentor_profile_id);

    if (!mentor || assignment.status !== "active") {
      continue;
    }

    const current = mentorsByRole.get(assignment.role_id) ?? [];
    current.push(
      mentor.position_title
        ? `${mentor.full_name} • ${mentor.position_title}`
        : mentor.full_name,
    );
    mentorsByRole.set(assignment.role_id, current);

    if (!primaryMentorIdByRole.has(assignment.role_id)) {
      primaryMentorIdByRole.set(assignment.role_id, mentor.id);
    }
  }

  const roles = rolesResult.data ?? [];
  const resolvedSharedLibrary: Array<{
    id: string;
    category: "talent" | "skill" | "behavior";
    characteristic: string;
  }> = (() => {
    const items = [
      ...((sharedLibraryResult.data ?? []) as Array<{
        id: string;
        category: string;
        characteristic: string;
      }>),
      ...((characteristicsResult.data ?? []) as Array<{
        id: string;
        category: string;
        characteristic: string;
      }>).map((item) => ({
        id: `existing-${item.id}`,
        category: item.category,
        characteristic: item.characteristic,
      })),
    ];
    const seen = new Set<string>();

    return items.flatMap((item) => {
      const category =
        item.category === "talent" ||
        item.category === "skill" ||
        item.category === "behavior"
          ? item.category
          : null;

      if (!category) {
        return [];
      }

      const normalized = normalizeRoleLibraryCharacteristic(item.characteristic);

      if (!normalized) {
        return [];
      }

      const key = `${category}:${normalized}`;

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [
        {
          id: item.id,
          category,
          characteristic: item.characteristic.trim(),
        },
      ];
    });
  })();
  const selectedMode: "flow" | "create" | "import" | "composite" | "view" | "resources" =
    requestedMode === "flow" ||
    requestedMode === "view" ||
    requestedMode === "create" ||
    requestedMode === "import" ||
    requestedMode === "composite" ||
    requestedMode === "resources"
      ? requestedMode
      : requestedRoleId
        ? "view"
        : "flow";
  const selectedRoleId =
    requestedRoleId && roles.some((role) => role.id === requestedRoleId)
      ? requestedRoleId
      : null;
  const visibleRoles = selectedRoleId
    ? roles.filter((role) => role.id === selectedRoleId)
    : roles;

  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Role Composite Builder
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
            Build Roles for Development
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            Add roles and define the competencies that matter most for success,
            and we will help you build a composite and supporting documents to
            identify the right people to develop. This is the beginning of a
            more intentional process to strengthen your leadership bench, guide
            mentoring, and build the next generation of leaders in your
            organization.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <RoleFocusSelector
            roles={roles.map((role) => ({
              id: role.id,
              title: role.title,
            }))}
            selectedRoleId={selectedRoleId}
            selectedMode={selectedMode}
          />

          <div className="grid gap-6">
            {selectedMode === "flow" ? (
              <RoleFlowPanel
                roles={roles.map((role) => ({
                  id: role.id,
                  title: role.title,
                  department: role.department,
                  hasCompositeDocument: compositeDocumentByRole.has(role.id),
                  hasCompetencies:
                    (characteristicsByRole.get(role.id) ?? []).length > 0,
                }))}
                selectedRoleId={selectedRoleId}
              />
            ) : selectedMode === "create" ||
              selectedMode === "import" ||
              selectedMode === "composite" ? (
              <RoleManagementPanel
                roles={roles.map((role) => ({
                  id: role.id,
                  title: role.title,
                  department: role.department,
                  description: role.description,
                  status: role.status as "draft" | "active",
                  primaryMentorProfileId: primaryMentorIdByRole.get(role.id) ?? null,
                  idealCompetencyCount:
                    (characteristicsByRole.get(role.id) ?? []).length,
                  roleCompositeCount: (competenciesByRole.get(role.id) ?? []).length,
                  compositeDocumentSource:
                    compositeDocumentByRole.get(role.id)?.document_source ?? null,
                  compositeDocumentFileName:
                    compositeDocumentByRole.get(role.id)?.file_name ?? null,
                  talents: groupCharacteristicsByCategory(
                    characteristicsByRole.get(role.id) ?? [],
                  ).talents,
                  skills: groupCharacteristicsByCategory(
                    characteristicsByRole.get(role.id) ?? [],
                  ).skills,
                  behaviors: groupCharacteristicsByCategory(
                    characteristicsByRole.get(role.id) ?? [],
                  ).behaviors,
                }))}
                sharedLibrary={resolvedSharedLibrary}
                canGenerateComposite={canGenerateComposite}
                initialSelectedRoleId={selectedRoleId}
                mode={selectedMode}
              />
            ) : selectedMode === "resources" ? (
              <RoleResourcesPanel
                roles={roles.map((role) => ({
                  id: role.id,
                  title: role.title,
                  department: role.department,
                  description: role.description,
                  competencyCount: (competenciesByRole.get(role.id) ?? []).length,
                  hasComposite: (competenciesByRole.get(role.id) ?? []).length > 0,
                }))}
                initialSelectedRoleId={selectedRoleId}
                canGenerateResources={canGenerateComposite}
              />
            ) : (
              <div className="grid gap-6">
                {roles.length === 0 ? (
                  <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-600">
                    No roles exist yet in this workspace. Use create mode to add
                    one manually or upload a role composite.
                  </section>
                ) : null}
                {roles.length > 0 && visibleRoles.length === 0 ? (
                  <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-600">
                    That role could not be found. Pick another role from the menu.
                  </section>
                ) : null}
                {visibleRoles.map((role) => {
                  const competencies = competenciesByRole.get(role.id) ?? [];
                  const characteristics = groupCharacteristicsByCategory(
                    characteristicsByRole.get(role.id) ?? [],
                  );
                  const assignedMentors = Array.from(
                    new Set(mentorsByRole.get(role.id) ?? []),
                  );

                  return (
                    <section
                      key={role.id}
                      className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            {role.department}
                          </p>
                          <h2 className="mt-2 font-display text-4xl text-slate-900">
                            {role.title}
                          </h2>
                          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                            {role.description}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-slate-600">
                            Assigned mentors:{" "}
                            <span className="font-semibold text-slate-900">
                              {assignedMentors.length > 0
                                ? assignedMentors.join(", ")
                                : "None yet"}
                            </span>
                          </p>
                          {assignedMentors.length === 0 ? (
                            <RoleMentorDialog
                              roleId={role.id}
                              roleTitle={role.title}
                              mentors={(mentorsResult.data ?? []).map((mentor) => ({
                                id: mentor.id,
                                full_name: mentor.full_name,
                                position_title: mentor.position_title,
                              }))}
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
                            {role.status}
                          </span>
                          {compositeDocumentByRole.get(role.id) ? (
                            <a
                              href={`/api/roles/${role.id}/composite-docx`}
                              className="interactive-contrast rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                            >
                              Download Composite (Word)
                            </a>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
                              Generate composite to print in Word
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-8 grid gap-4 lg:grid-cols-2">
                        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:col-span-2">
                          <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            Ideal Candidate Competencies
                          </p>
                          <div className="mt-5 grid gap-4 lg:grid-cols-3">
                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">Talents</p>
                              <p className="mt-2 leading-7">
                                {characteristics.talents.length > 0
                                  ? characteristics.talents.join(" • ")
                                  : "No talents attached yet"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">Skills</p>
                              <p className="mt-2 leading-7">
                                {characteristics.skills.length > 0
                                  ? characteristics.skills.join(" • ")
                                  : "No skills attached yet"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">Behaviors</p>
                              <p className="mt-2 leading-7">
                                {characteristics.behaviors.length > 0
                                  ? characteristics.behaviors.join(" • ")
                                  : "No behaviors attached yet"}
                              </p>
                            </div>
                          </div>
                        </article>
                        {competencies.length > 0 ? (
                          competencies.map((competency) => (
                            <article
                              key={competency.id}
                              className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <h3 className="text-xl font-semibold text-slate-900">
                                  {competency.name}
                                </h3>
                                <div className="text-right text-sm font-semibold text-slate-600">
                                  <p>Target {competency.target_score.toFixed(2)}</p>
                                  <p>Weight {competency.weight.toFixed(2)}</p>
                                </div>
                              </div>
                              <p className="mt-4 text-sm leading-7 text-slate-600">
                                {competency.definition}
                              </p>
                              <div className="mt-5 grid gap-3">
                                <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                                  <p className="font-semibold text-slate-900">
                                    Behavioral Indicators
                                  </p>
                                  <p className="mt-2 leading-7">
                                    {(competency.behavioral_indicators as string[]).join(
                                      " • ",
                                    )}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                                  <p className="font-semibold text-slate-900">Red Flags</p>
                                  <p className="mt-2 leading-7">
                                    {(competency.red_flags as string[]).join(" • ")}
                                  </p>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600 lg:col-span-2">
                            No competencies are attached to this role yet. Upload a
                            composite to populate them.
                          </article>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
