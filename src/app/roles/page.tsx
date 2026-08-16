import { redirect } from "next/navigation";
import { RoleManagementPanel } from "@/components/role-management-panel";
import { RoleMentorDialog } from "@/components/role-mentor-dialog";
import { RoleResourcesPanel } from "@/components/role-resources-panel";
import { RolePrintablesPanel } from "@/components/role-printables-panel";
import { RoleSelectorSidebar } from "@/components/role-selector-sidebar";
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
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { createRolePrintableCompetencySignature } from "@/lib/role-printable-signature";
import {
  getFallbackMasterRoleCompetencyTemplates,
  isMissingMasterRoleCompetencyTemplatesTableError,
} from "@/lib/master-role-competency-templates";
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
  const requestedModeIsValid =
    requestedMode === "view" ||
    requestedMode === "create" ||
    requestedMode === "import" ||
    requestedMode === "composite" ||
    requestedMode === "resources" ||
    requestedMode === "survey" ||
    requestedMode === "printables";
  const dataMode:
    | "create"
    | "import"
    | "composite"
    | "view"
    | "resources"
    | "survey"
    | "printables" =
    requestedMode === "view"
      ? "import"
      : requestedModeIsValid
        ? requestedMode
        : "import";

  if (!isAdminAppRole(profile.role)) {
    redirect(
      "/candidates?message=Role+configuration+is+available+to+organization+administrators+only",
    );
  }

  const canGenerateComposite = hasOpenAIEnv();
  const needsCompetencies =
    dataMode === "create" ||
    dataMode === "import" ||
    dataMode === "composite" ||
    dataMode === "survey" ||
    dataMode === "view" ||
    dataMode === "resources" ||
    dataMode === "printables";
  const needsCharacteristicDetails =
    dataMode === "create" ||
    dataMode === "import" ||
    dataMode === "composite" ||
    dataMode === "survey" ||
    dataMode === "view" ||
    dataMode === "printables";
  const needsCharacteristicPresence = needsCharacteristicDetails;
  const needsSharedLibrary =
    dataMode === "create" ||
    dataMode === "import" ||
    dataMode === "composite" ||
    dataMode === "survey";
  const needsCompositeDocumentDetails =
    dataMode === "create" ||
    dataMode === "import" ||
    dataMode === "composite" ||
    dataMode === "survey" ||
    dataMode === "view" ||
    dataMode === "printables";
  const needsCompositeDocumentPresence = needsCompositeDocumentDetails;
  const needsMentors = dataMode === "view";
  const needsRoleMentorAssignments = dataMode === "view";
  const needsSurveyRecords =
    dataMode === "import" ||
    dataMode === "composite" ||
    dataMode === "survey";
  const needsPrintableGenerations = dataMode === "printables";
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
    organizationResult,
    masterRoleTemplatesResult,
    printableGenerationsResult,
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
      supabase
        .from("organizations")
        .select("industry")
        .eq("id", profile.organization_id)
        .maybeSingle(),
      supabase
        .from("master_role_competency_templates")
        .select(
          "id, industry, role_title, role_family, default_department, description, talents, skills, behaviors",
        )
        .order("industry", { ascending: true, nullsFirst: false })
        .order("role_title", { ascending: true }),
      needsPrintableGenerations
        ? supabase
            .from("role_printable_generations")
            .select("role_id,document_type,competency_signature")
            .eq("organization_id", profile.organization_id)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (rolesResult.error) {
    throw new Error(rolesResult.error.message);
  }

  if (competenciesResult.error) {
    throw new Error(competenciesResult.error.message);
  }

  if (printableGenerationsResult.error) {
    throw new Error(printableGenerationsResult.error.message);
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

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (
    masterRoleTemplatesResult.error &&
    !isMissingMasterRoleCompetencyTemplatesTableError(masterRoleTemplatesResult.error)
  ) {
    throw new Error(masterRoleTemplatesResult.error.message);
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

  const roles = (rolesResult.data ?? []).map((role) => ({
    ...role,
    title: canonicalizeRoleTitle(role.title),
  }));
  const organizationIndustry = organizationResult.data?.industry?.trim() ?? null;
  const masterRoleTemplates =
    masterRoleTemplatesResult.data && !masterRoleTemplatesResult.error
      ? (masterRoleTemplatesResult.data as Array<{
          id: string;
          industry: string | null;
          role_title: string;
          role_family: string | null;
          default_department: string | null;
          description: string | null;
          talents: string[] | null;
          skills: string[] | null;
          behaviors: string[] | null;
        }>)
          .map((template) => ({
            id: template.id,
            industry: template.industry,
            role_title: canonicalizeRoleTitle(template.role_title),
            role_family: template.role_family,
            default_department: template.default_department,
            description: template.description,
            talents: template.talents ?? [],
            skills: template.skills ?? [],
            behaviors: template.behaviors ?? [],
          }))
          .filter((template) => {
            if (!template.industry) {
              return true;
            }

            return (
              organizationIndustry !== null &&
              template.industry.trim().toLowerCase() ===
                organizationIndustry.trim().toLowerCase()
            );
          })
      : getFallbackMasterRoleCompetencyTemplates(organizationIndustry).map((template) => ({
          ...template,
          role_title: canonicalizeRoleTitle(template.role_title),
        }));
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
      ...masterRoleTemplates.flatMap((template) => [
        ...template.talents.map((characteristic, index) => ({
          id: `template-${template.id}-talent-${index}`,
          category: "talent",
          characteristic,
        })),
        ...template.skills.map((characteristic, index) => ({
          id: `template-${template.id}-skill-${index}`,
          category: "skill",
          characteristic,
        })),
        ...template.behaviors.map((characteristic, index) => ({
          id: `template-${template.id}-behavior-${index}`,
          category: "behavior",
          characteristic,
        })),
      ]),
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
  const printableGenerationByRoleAndType = new Map(
    (printableGenerationsResult.data ?? []).map((generation) => [
      `${generation.role_id}:${generation.document_type}`,
      generation.competency_signature,
    ]),
  );
  const selectedRoleId =
    requestedRoleId && roles.some((role) => role.id === requestedRoleId)
      ? requestedRoleId
      : requestedMode === "create"
        ? null
        : (roles[0]?.id ?? null);
  const selectedMode =
    requestedMode === "view"
      ? "import"
      : requestedModeIsValid
        ? requestedMode
        : selectedRoleId
          ? "import"
          : "create";
  const visibleRoles = selectedRoleId
    ? roles.filter((role) => role.id === selectedRoleId)
    : roles;
  const isRoleWorkspaceMode = selectedRoleId !== null;
  const selectedRole = visibleRoles[0] ?? null;
  const activeWorkspaceSectionId =
    selectedMode === "import" ||
    selectedMode === "composite" ||
    selectedMode === "survey"
      ? "workflow"
      : selectedMode === "resources"
        ? "interview"
        : selectedMode;
  const selectedWorkspaceMode =
    activeWorkspaceSectionId === "printables"
      ? "printables"
      : activeWorkspaceSectionId === "create"
        ? "create"
        : "import";
  const roleWorkspaceSections = selectedRoleId
    ? [
        {
          id: "workflow",
          label: "Role Workflow",
          href: `/roles?roleId=${selectedRoleId}&mode=import`,
        },
        {
          id: "printables",
          label: "Role Printables",
          href: `/roles?roleId=${selectedRoleId}&mode=printables`,
        },
        {
          id: "create",
          label: "Role Modification",
          href: `/roles?roleId=${selectedRoleId}&mode=create`,
        },
      ]
    : [];
  const roleOptionsForPanels = isRoleWorkspaceMode ? visibleRoles : roles;

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <RoleSelectorSidebar
            roles={roles}
            selectedRoleId={selectedRoleId}
            isCreatingRole={!selectedRoleId && selectedMode === "create"}
            selectedWorkspaceMode={selectedWorkspaceMode}
          />
          <div className="grid min-w-0 gap-6">
        {isRoleWorkspaceMode && selectedRole ? (
              <RoleWorkspaceMenu
                sections={roleWorkspaceSections}
                activeSectionId={activeWorkspaceSectionId}
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
            {selectedMode === "create" ? (
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
                organizationIndustry={organizationIndustry}
                masterRoleTemplates={masterRoleTemplates}
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
                  organizationIndustry={organizationIndustry}
                  masterRoleTemplates={masterRoleTemplates}
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
                  organizationIndustry={organizationIndustry}
                  masterRoleTemplates={masterRoleTemplates}
                  canGenerateComposite={canGenerateComposite}
                  initialSelectedRoleId={selectedRoleId}
                  mode="composite"
                />
              </>
            ) : selectedMode === "printables" && selectedRole ? (
              <RolePrintablesPanel
                roleId={selectedRole.id}
                roleTitle={selectedRole.title}
                printables={(() => {
                  const competencies = competenciesByRole.get(selectedRole.id) ?? [];
                  const signature = createRolePrintableCompetencySignature(competencies);
                  const generation = (documentType: "role_composite" | "condensed_profile" | "printable_narrative" | "interview_scorecard") => printableGenerationByRoleAndType.get(`${selectedRole.id}:${documentType}`);
                  const ready = competencies.length > 0;
                  return [
                    { id: "role_composite" as const, title: "Full Role Composite", description: "The source-of-truth role document. It captures the role purpose, scope, success priorities, ideal competencies, observable behaviors, and red flags used across development, selection, and succession planning.", endpoint: `/api/roles/${selectedRole.id}/composite-docx`, enabled: compositeDocumentByRole.has(selectedRole.id), generated: compositeDocumentByRole.has(selectedRole.id), outdated: false },
                    { id: "condensed_profile" as const, title: "Condensed Role Profile", description: "A short leadership-ready summary for hiring conversations, succession reviews, and quick role alignment. It highlights the role’s core requirements and the leadership profile needed for success.", endpoint: `/api/roles/${selectedRole.id}/condensed-composite-docx`, enabled: ready, generated: Boolean(generation("condensed_profile")), outdated: Boolean(generation("condensed_profile")) && generation("condensed_profile") !== signature },
                    { id: "printable_narrative" as const, title: "Printable Role Narrative", description: "A plain-language explanation of what the role is accountable for and what strong performance looks like. Use it to align the employee, supervisor, mentor, and leadership team around clear expectations.", endpoint: `/api/roles/${selectedRole.id}/printable-narrative-docx`, enabled: ready, generated: Boolean(generation("printable_narrative")), outdated: Boolean(generation("printable_narrative")) && generation("printable_narrative") !== signature },
                    { id: "interview_scorecard" as const, title: "Behavioral Interview Scorecard", description: "An interviewer packet with competency-based questions, what each question is intended to validate, and scoring space. Use it to compare candidates consistently and focus on evidence rather than impressions.", endpoint: `/api/roles/${selectedRole.id}/interview-scorecard-docx`, enabled: ready, generated: Boolean(generation("interview_scorecard")), outdated: Boolean(generation("interview_scorecard")) && generation("interview_scorecard") !== signature },
                  ];
                })()}
              />
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
                        <details
                          open
                          className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:col-span-2"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase [&::-webkit-details-marker]:hidden">
                            <span>Ideal Candidate Competencies</span>
                            <span className="flex items-center gap-2 text-xs tracking-normal text-teal-800 normal-case">
                              <span className="group-open:hidden">Expand</span>
                              <span className="hidden group-open:inline">Collapse</span>
                              <span className="text-lg leading-none transition-transform group-open:rotate-45">
                                +
                              </span>
                            </span>
                          </summary>
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
                        </details>
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
        </div>
      </div>
    </main>
  );
}
