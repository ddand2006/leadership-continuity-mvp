import { redirect } from "next/navigation";
import { RoleFlowPanel } from "@/components/role-flow-panel";
import { RoleManagementPanel } from "@/components/role-management-panel";
import { RoleMentorDialog } from "@/components/role-mentor-dialog";
import { RoleResourcesPanel } from "@/components/role-resources-panel";
import { RoleSurveyPanel } from "@/components/role-survey-panel";
import { RoleWorkspaceMenu } from "@/components/role-workspace-menu";
import { hasOpenAIEnv, hasResendEnv } from "@/lib/env";
import {
  isMissingRoleCharacteristicLibraryTableError,
  normalizeRoleLibraryCharacteristic,
} from "@/lib/role-characteristic-library";
import { isAdminAppRole } from "@/lib/mentor-access";
import {
  isMissingRoleSurveyTablesError,
  type RoleSurveyRecipientRecord,
  type RoleSurveyRecord,
  type RoleSurveyResponseRecord,
} from "@/lib/role-competency-surveys";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type RolesPageProps = {
  searchParams: Promise<{
    roleId?: string;
    mode?: string;
  }>;
};

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const { roleId: requestedRoleId, mode: requestedMode } = await searchParams;
  const isEmailDeliveryEnabled = hasResendEnv();
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  const selectedMode:
    | "flow"
    | "create"
    | "import"
    | "composite"
    | "view"
    | "resources"
    | "survey" =
    requestedMode === "flow" ||
    requestedMode === "view" ||
    requestedMode === "create" ||
    requestedMode === "import" ||
    requestedMode === "composite" ||
    requestedMode === "resources" ||
    requestedMode === "survey"
      ? requestedMode
      : requestedRoleId
        ? "view"
        : "flow";

  if (!isAdminAppRole(profile.role)) {
    redirect(
      "/candidates?message=Role+configuration+is+available+to+organization+administrators+only",
    );
  }

  const canGenerateComposite = hasOpenAIEnv();
  const needsCompetencies =
    selectedMode === "create" ||
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey" ||
    selectedMode === "view" ||
    selectedMode === "resources";
  const needsCharacteristicDetails =
    selectedMode === "create" ||
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey" ||
    selectedMode === "view";
  const needsCharacteristicPresence =
    selectedMode === "flow" || needsCharacteristicDetails;
  const needsSharedLibrary =
    selectedMode === "create" ||
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey";
  const needsCompositeDocumentDetails =
    selectedMode === "create" ||
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey" ||
    selectedMode === "view";
  const needsCompositeDocumentPresence =
    selectedMode === "flow" || needsCompositeDocumentDetails;
  const needsMentors = selectedMode === "view";
  const needsRoleMentorAssignments = selectedMode === "view";
  const needsSurveyRecords =
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey";
  const [
    rolesResult,
    competenciesResult,
    characteristicsResult,
    sharedLibraryResult,
    compositeDocumentsResult,
    mentorsResult,
    roleMentorAssignmentsResult,
    roleSurveysResult,
    roleSurveyRecipientsResult,
    roleSurveyResponsesResult,
  ] =
    await Promise.all([
      supabase
        .from("roles")
        .select("id, title, department, description, status")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true }),
      needsCompetencies
        ? supabase
            .from("role_competencies")
            .select(
              "id, role_id, name, definition, weight, target_score, behavioral_indicators, red_flags",
            )
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      needsCharacteristicPresence
        ? supabase
            .from("role_candidate_characteristics")
            .select(
              needsCharacteristicDetails
                ? "id, role_id, category, characteristic, sort_order"
                : "role_id",
            )
            .eq("organization_id", profile.organization_id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      needsSharedLibrary
        ? supabase
            .from("role_characteristic_library")
            .select("id, category, characteristic")
            .eq("organization_id", profile.organization_id)
            .order("characteristic", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      needsCompositeDocumentPresence
        ? supabase
            .from("role_composite_documents")
            .select(
              needsCompositeDocumentDetails
                ? "id, role_id, document_source, file_name, created_at"
                : "role_id",
            )
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      needsMentors
        ? supabase
            .from("profiles")
            .select("id, full_name, position_title")
            .eq("organization_id", profile.organization_id)
            .eq("role", "mentor")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      needsRoleMentorAssignments
        ? supabase
            .from("role_mentor_assignments")
            .select("role_id, mentor_profile_id, status")
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      needsSurveyRecords
        ? supabase
            .from("role_surveys")
            .select(
              "id, organization_id, role_id, title, description, intro_message, thank_you_message, status, created_by_profile_id, updated_by_profile_id, launched_at, closed_at, created_at, updated_at",
            )
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      needsSurveyRecords
        ? supabase
            .from("role_survey_recipients")
            .select(
              "id, organization_id, survey_id, recipient_name, recipient_email, recipient_title, relationship_to_role, access_token, status, invited_by_profile_id, invited_at, opened_at, completed_at, reminder_sent_at, created_at, updated_at",
            )
            .eq("organization_id", profile.organization_id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      needsSurveyRecords
        ? supabase
            .from("role_survey_responses")
            .select(
              "id, organization_id, survey_id, recipient_id, response_json, normalized_competencies, submitted_at, created_at, updated_at",
            )
            .eq("organization_id", profile.organization_id)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
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

  if (
    roleSurveysResult.error &&
    !isMissingRoleSurveyTablesError(roleSurveysResult.error)
  ) {
    throw new Error(roleSurveysResult.error.message);
  }

  if (
    roleSurveyRecipientsResult.error &&
    !isMissingRoleSurveyTablesError(roleSurveyRecipientsResult.error)
  ) {
    throw new Error(roleSurveyRecipientsResult.error.message);
  }

  if (
    roleSurveyResponsesResult.error &&
    !isMissingRoleSurveyTablesError(roleSurveyResponsesResult.error)
  ) {
    throw new Error(roleSurveyResponsesResult.error.message);
  }

  const normalizedCompetencies = (competenciesResult.data ?? []) as Array<{
    id: string;
    role_id: string;
    name: string;
    definition: string;
    weight: number;
    target_score: number;
    behavioral_indicators: unknown;
    red_flags: unknown;
  }>;
  const competenciesByRole = new Map<
    string,
    typeof normalizedCompetencies
  >();
  const characteristicsByRole = new Map<
    string,
    typeof normalizedCharacteristics
  >();
  const normalizedCharacteristics = (characteristicsResult.data ?? []) as Array<{
    id?: string;
    role_id: string;
    category?: string;
    characteristic?: string;
    sort_order?: number;
  }>;
  const normalizedCompositeDocuments = (
    compositeDocumentsResult.data ?? []
  ) as Array<{
    id?: string;
    role_id: string;
    document_source?: "generated" | "manual" | null;
    file_name?: string | null;
    created_at?: string;
  }>;
  const compositeDocumentByRole = new Map<
    string,
    (typeof normalizedCompositeDocuments)[number]
  >();
  const mentorMap = new Map((mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]));
  const mentorsByRole = new Map<string, string[]>();
  const primaryMentorIdByRole = new Map<string, string>();

  for (const competency of normalizedCompetencies) {
    const current = competenciesByRole.get(competency.role_id) ?? [];
    current.push(competency);
    competenciesByRole.set(competency.role_id, current);
  }

  for (const characteristic of normalizedCharacteristics) {
    const current = characteristicsByRole.get(characteristic.role_id) ?? [];
    current.push(characteristic);
    characteristicsByRole.set(characteristic.role_id, current);
  }

  for (const document of normalizedCompositeDocuments) {
    if (!compositeDocumentByRole.has(document.role_id)) {
      compositeDocumentByRole.set(document.role_id, document);
    }
  }

  function getDetailedCharacteristics(roleId: string) {
    return (characteristicsByRole.get(roleId) ?? []).flatMap((item) => {
      if (
        typeof item.category !== "string" ||
        typeof item.characteristic !== "string"
      ) {
        return [];
      }

      return [
        {
          category: item.category,
          characteristic: item.characteristic,
        },
      ];
    });
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
  const surveyModuleReady =
    !isMissingRoleSurveyTablesError(roleSurveysResult.error) &&
    !isMissingRoleSurveyTablesError(roleSurveyRecipientsResult.error) &&
    !isMissingRoleSurveyTablesError(roleSurveyResponsesResult.error);
  const roleSurveys = (roleSurveysResult.data ?? []) as RoleSurveyRecord[];
  const roleSurveyRecipients = (roleSurveyRecipientsResult.data ??
    []) as RoleSurveyRecipientRecord[];
  const roleSurveyResponses = (roleSurveyResponsesResult.data ??
    []) as RoleSurveyResponseRecord[];
  const selectedRoleId =
    requestedRoleId && roles.some((role) => role.id === requestedRoleId)
      ? requestedRoleId
      : null;
  const visibleRoles = selectedRoleId
    ? roles.filter((role) => role.id === selectedRoleId)
    : roles;
  const isRoleWorkspaceMode = selectedRoleId !== null && selectedMode !== "flow";
  const selectedRole = visibleRoles[0] ?? null;
  const selectedRoleMentors = selectedRole
    ? Array.from(new Set(mentorsByRole.get(selectedRole.id) ?? []))
    : [];
  const selectedRoleCompetencyCount = selectedRole
    ? (competenciesByRole.get(selectedRole.id) ?? []).length
    : 0;
  const selectedRoleCharacteristicCount = selectedRole
    ? (characteristicsByRole.get(selectedRole.id) ?? []).length
    : 0;
  const selectedRoleCompositeDocument = selectedRole
    ? compositeDocumentByRole.get(selectedRole.id) ?? null
    : null;
  const selectedRoleDetailItems = selectedRole
    ? [
        `Department: ${selectedRole.department ?? "Not entered"}`,
        `Status: ${selectedRole.status}`,
        `Ideal candidate traits: ${selectedRoleCharacteristicCount}`,
        `Structured competencies: ${selectedRoleCompetencyCount}`,
        `Mentors: ${
          selectedRoleMentors.length > 0
            ? selectedRoleMentors.join(", ")
            : "Not assigned yet"
        }`,
        `Composite: ${
          selectedRoleCompositeDocument?.file_name ??
          (selectedRoleCompositeDocument?.document_source === "generated"
            ? "Generated and ready"
            : "Not created yet")
        }`,
      ]
    : [];
  const activeWorkspaceSectionId =
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey"
      ? "workflow"
      : selectedMode === "resources"
        ? "interview"
        : selectedMode;
  const roleWorkspaceSections = selectedRoleId
    ? [
        {
          id: "view",
          label: "Overview",
          href: `/roles?roleId=${selectedRoleId}&mode=view`,
        },
        {
          id: "create",
          label: "Role Setup",
          href: `/roles?roleId=${selectedRoleId}&mode=create`,
        },
        {
          id: "workflow",
          label: "Role Workflow",
          href: `/roles?roleId=${selectedRoleId}&mode=import`,
        },
        {
          id: "interview",
          label: "Narrative & Interview",
          href: `/roles?roleId=${selectedRoleId}&mode=resources`,
        },
      ]
    : [];
  const roleOptionsForPanels = isRoleWorkspaceMode ? visibleRoles : roles;

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        {isRoleWorkspaceMode && selectedRole ? (
          <RoleWorkspaceMenu
            roleName={selectedRole.title}
            detailItems={selectedRoleDetailItems}
            sections={roleWorkspaceSections}
            activeSectionId={activeWorkspaceSectionId}
            backHref="/roles?mode=flow"
          />
        ) : (
          <section className="theme-panel-strong rounded-[2rem] p-8">
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
        )}

        <section className="grid gap-6">
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
                selectedMode={selectedMode}
              />
            ) : selectedMode === "create" ? (
              <RoleManagementPanel
                roles={roleOptionsForPanels.map((role) => ({
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
                    getDetailedCharacteristics(role.id),
                  ).talents,
                  skills: groupCharacteristicsByCategory(
                    getDetailedCharacteristics(role.id),
                  ).skills,
                  behaviors: groupCharacteristicsByCategory(
                    getDetailedCharacteristics(role.id),
                  ).behaviors,
                }))}
                sharedLibrary={resolvedSharedLibrary}
                canGenerateComposite={canGenerateComposite}
                initialSelectedRoleId={selectedRoleId}
                mode="create"
              />
            ) : selectedMode === "import" ||
              selectedMode === "composite" ||
              selectedMode === "survey" ? (
              <>
                <RoleManagementPanel
                  roles={roleOptionsForPanels.map((role) => ({
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
                      getDetailedCharacteristics(role.id),
                    ).talents,
                    skills: groupCharacteristicsByCategory(
                      getDetailedCharacteristics(role.id),
                    ).skills,
                    behaviors: groupCharacteristicsByCategory(
                      getDetailedCharacteristics(role.id),
                    ).behaviors,
                  }))}
                  sharedLibrary={resolvedSharedLibrary}
                  canGenerateComposite={canGenerateComposite}
                  initialSelectedRoleId={selectedRoleId}
                  mode="import"
                />
                <div className="flex items-center gap-4 px-2 text-slate-400 sm:px-8">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    or
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                {surveyModuleReady ? (
                  <RoleSurveyPanel
                    roles={roleOptionsForPanels.map((role) => ({
                      id: role.id,
                      title: role.title,
                      department: role.department,
                    }))}
                    surveys={roleSurveys}
                    recipients={roleSurveyRecipients}
                    responses={roleSurveyResponses}
                    initialSelectedRoleId={selectedRoleId}
                    isEmailDeliveryEnabled={isEmailDeliveryEnabled}
                    sectionId="role-survey-tools"
                  />
                ) : (
                  <section
                    id="role-survey-tools"
                    className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
                  >
                    <p className="text-sm font-semibold tracking-[0.16em] uppercase">
                      Competency Survey
                    </p>
                    <h2 className="mt-3 font-display text-3xl">
                      The role survey database migration still needs to be applied
                    </h2>
                    <p className="mt-4 max-w-3xl text-sm leading-7">
                      The survey interface is ready, but the survey tables have not
                      been created in Supabase yet. Once the migration is applied,
                      you will be able to send competency surveys to any email
                      address, collect responses, and review recurring themes.
                    </p>
                  </section>
                )}
                <div className="flex items-center gap-4 px-2 text-slate-400 sm:px-8">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    then
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <RoleManagementPanel
                  roles={roleOptionsForPanels.map((role) => ({
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
                      getDetailedCharacteristics(role.id),
                    ).talents,
                    skills: groupCharacteristicsByCategory(
                      getDetailedCharacteristics(role.id),
                    ).skills,
                    behaviors: groupCharacteristicsByCategory(
                      getDetailedCharacteristics(role.id),
                    ).behaviors,
                  }))}
                  sharedLibrary={resolvedSharedLibrary}
                  canGenerateComposite={canGenerateComposite}
                  initialSelectedRoleId={selectedRoleId}
                  mode="composite"
                />
              </>
            ) : selectedMode === "resources" ? (
              <RoleResourcesPanel
                roles={roleOptionsForPanels.map((role) => ({
                  id: role.id,
                  title: role.title,
                  department: role.department,
                  description: role.description,
                  competencyCount: (competenciesByRole.get(role.id) ?? []).length,
                  hasStructuredComposite:
                    (competenciesByRole.get(role.id) ?? []).length > 0,
                  hasCompositeDocument: compositeDocumentByRole.has(role.id),
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
                    getDetailedCharacteristics(role.id),
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
