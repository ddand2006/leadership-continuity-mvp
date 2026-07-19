import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";
import { hasOpenAIEnv } from "@/lib/env";
import { isAdminAppRole, isMentorAppUser } from "@/lib/mentor-access";
import { parseCoachingGuidance, type CoachingRequestRecord } from "@/lib/coaching-support";
import type { PersonalLeadershipNarrative } from "@/lib/personal-leadership-composite";
import type { RoleComposite } from "@/lib/role-composite";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import {
  isMissingRoleSurveyTablesError,
  type RoleSurveyRecipientRecord,
  type RoleSurveyRecord,
  type RoleSurveyResponseRecord,
} from "@/lib/role-competency-surveys";

export type PersonalDevelopmentProfileRecord = {
  id: string;
  organization_id: string;
  profile_id: string;
  current_role_id: string | null;
  current_position_title: string | null;
  years_in_role: number | null;
  leadership_history: string | null;
  organizational_context: string | null;
  last_composite_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalRoleProfileRecord = {
  id: string;
  personal_development_profile_id: string;
  source_role_id: string | null;
  role_mode: "organization_role" | "personal_role";
  title: string;
  department: string | null;
  description: string;
  created_at: string;
  updated_at: string;
};

export type PersonalLeadershipCompositeRecord = {
  id: string;
  version: number;
  status: "draft" | "generated" | "archived";
  composite_json: (RoleComposite & {
    evidence?: {
      generation_mode?: "ideal_competencies" | "existing_role_competencies" | "role_profile";
      talents?: string[];
      skills?: string[];
      behaviors?: string[];
      strengths_on_file?: string[];
      source_role_competency_count?: number;
    };
  }) | null;
  narrative_json: PersonalLeadershipNarrative | null;
  generated_at: string | null;
  created_at: string;
};

export type PersonalDevelopmentRoleOption = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  status: string;
};

export type PersonalStrengthProfileRecord = {
  id: string;
  theme_name: string;
  rank: number;
  domain: string;
  notes: string | null;
  created_at: string;
};

export type PersonalSourceDocumentRecord = {
  id: string;
  document_category: string;
  file_name: string;
  file_extension: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  extracted_text: string | null;
  created_at: string;
};

export type PersonalStrengthReferenceRecord = {
  theme_name: string;
  domain: string;
  leadership_advantages: string;
  possible_blind_spots: string;
  development_uses: string;
};

export type PersonalDevelopmentWorkspaceData = {
  account: Awaited<ReturnType<typeof requirePaidWorkspaceProfile>>["account"];
  profile: Awaited<ReturnType<typeof requirePaidWorkspaceProfile>>["profile"];
  canReviewCoachingQueue: boolean;
  hasOpenAI: boolean;
  migrationReady: boolean;
  profilePositionTitle: string | null;
  roles: PersonalDevelopmentRoleOption[];
  personalProfile: PersonalDevelopmentProfileRecord | null;
  roleProfile: PersonalRoleProfileRecord | null;
  latestComposite: PersonalLeadershipCompositeRecord | null;
  strengthsCount: number;
  sourceDocumentCount: number;
  coachingRequestCount: number;
};

type PersonalDevelopmentCoachingRequest = CoachingRequestRecord & {
  requesterName: string;
  requesterEmail: string | null;
};

export type PersonalDevelopmentConnectedRoleSurveyData = {
  canManageSurvey: boolean;
  migrationReady: boolean;
  surveys: RoleSurveyRecord[];
  recipients: RoleSurveyRecipientRecord[];
  responses: RoleSurveyResponseRecord[];
};

export type PersonalDevelopmentStrengthsPageData = {
  workspace: PersonalDevelopmentWorkspaceData;
  strengths: PersonalStrengthProfileRecord[];
  strengthReferences: PersonalStrengthReferenceRecord[];
  sourceDocuments: PersonalSourceDocumentRecord[];
  readableDocumentCount: number;
};

export function isMissingPersonalDevelopmentTablesError(
  error: { message: string } | null,
) {
  return Boolean(
    error?.message.includes("personal_development_profiles") ||
      error?.message.includes("personal_role_profiles") ||
      error?.message.includes("personal_leadership_composites") ||
      error?.message.includes("personal_source_documents") ||
      error?.message.includes("personal_strength_profiles"),
  );
}

export async function loadPersonalDevelopmentWorkspaceData(): Promise<PersonalDevelopmentWorkspaceData> {
  const { account, profile, supabase } = await requirePaidWorkspaceProfile({
    product: "leadership_help",
  });
  const canReviewCoachingQueue =
    isAdminAppRole(profile.role) || isMentorAppUser(profile, account);

  const [profileDetailsResult, rolesResult, coachingCountResult, personalProfileResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("position_title")
        .eq("id", profile.id)
        .maybeSingle(),
      supabase
        .from("roles")
        .select("id, title, department, description, status")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("coaching_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("requester_profile_id", profile.id),
      supabase
        .from("personal_development_profiles")
        .select(
          "id, organization_id, profile_id, current_role_id, current_position_title, years_in_role, leadership_history, organizational_context, last_composite_generated_at, created_at, updated_at",
        )
        .eq("organization_id", profile.organization_id)
        .eq("profile_id", profile.id)
        .maybeSingle(),
    ]);

  for (const result of [profileDetailsResult, rolesResult, coachingCountResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const roles = ((rolesResult.data ?? []) as PersonalDevelopmentRoleOption[]).map((role) => ({
    ...role,
    title: canonicalizeRoleTitle(role.title),
  }));

  if (personalProfileResult.error) {
    if (isMissingPersonalDevelopmentTablesError(personalProfileResult.error)) {
      return {
        account,
        profile,
        canReviewCoachingQueue,
        hasOpenAI: hasOpenAIEnv(),
        migrationReady: false,
        profilePositionTitle: profileDetailsResult.data?.position_title ?? null,
        roles,
        personalProfile: null,
        roleProfile: null,
        latestComposite: null,
        strengthsCount: 0,
        sourceDocumentCount: 0,
        coachingRequestCount: coachingCountResult.count ?? 0,
      };
    }

    throw new Error(personalProfileResult.error.message);
  }

  const personalProfile =
    (personalProfileResult.data as PersonalDevelopmentProfileRecord | null) ?? null;

  if (!personalProfile) {
    return {
      account,
      profile,
      canReviewCoachingQueue,
      hasOpenAI: hasOpenAIEnv(),
      migrationReady: true,
      profilePositionTitle: profileDetailsResult.data?.position_title ?? null,
      roles,
      personalProfile: null,
      roleProfile: null,
      latestComposite: null,
      strengthsCount: 0,
      sourceDocumentCount: 0,
      coachingRequestCount: coachingCountResult.count ?? 0,
    };
  }

  const [
    roleProfileResult,
    latestCompositeResult,
    strengthsCountResult,
    sourceDocumentCountResult,
  ] = await Promise.all([
    supabase
      .from("personal_role_profiles")
      .select(
        "id, personal_development_profile_id, source_role_id, role_mode, title, department, description, created_at, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id)
      .maybeSingle(),
    supabase
      .from("personal_leadership_composites")
      .select(
        "id, version, status, composite_json, narrative_json, generated_at, created_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("personal_strength_profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id),
    supabase
      .from("personal_source_documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id),
  ]);

  for (const result of [
    roleProfileResult,
    latestCompositeResult,
    strengthsCountResult,
    sourceDocumentCountResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  return {
    account,
    profile,
    canReviewCoachingQueue,
    hasOpenAI: hasOpenAIEnv(),
    migrationReady: true,
    profilePositionTitle: profileDetailsResult.data?.position_title ?? null,
    roles,
    personalProfile,
    roleProfile:
      roleProfileResult.data
        ? {
            ...(roleProfileResult.data as PersonalRoleProfileRecord),
            title: canonicalizeRoleTitle(roleProfileResult.data.title),
          }
        : null,
    latestComposite:
      (latestCompositeResult.data as PersonalLeadershipCompositeRecord | null) ?? null,
    strengthsCount: strengthsCountResult.count ?? 0,
    sourceDocumentCount: sourceDocumentCountResult.count ?? 0,
    coachingRequestCount: coachingCountResult.count ?? 0,
  };
}

export async function loadPersonalDevelopmentCoachingData() {
  const { account, profile } = await requirePaidWorkspaceProfile({
    product: "leadership_help",
  });
  const admin = createSupabaseAdminClient();
  const canReviewQueue = isAdminAppRole(profile.role) || isMentorAppUser(profile, account);
  const requestsQuery = admin
    .from("coaching_requests")
    .select(
      "id, requester_profile_id, challenge_area, challenge_title, challenge_summary, organizational_context, desired_outcome, urgency, support_path, status, ai_guidance, ai_generated_at, assigned_coach_name, internal_notes, last_reviewed_at, created_at, updated_at",
    )
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (!canReviewQueue) {
    requestsQuery.eq("requester_profile_id", profile.id);
  }

  const requestsResult = await requestsQuery;

  if (requestsResult.error) {
    throw new Error(requestsResult.error.message);
  }

  const requesterIds = Array.from(
    new Set((requestsResult.data ?? []).map((request) => request.requester_profile_id)),
  );
  const profilesResult =
    requesterIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", requesterIds)
      : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((item) => [item.id, item]),
  );
  const requests = ((requestsResult.data ?? []) as CoachingRequestRecord[]).map(
    (request) => ({
      ...request,
      ai_guidance: parseCoachingGuidance(request.ai_guidance),
      requesterName:
        profileMap.get(request.requester_profile_id)?.full_name ?? "Team member",
      requesterEmail: profileMap.get(request.requester_profile_id)?.email ?? null,
    }),
  ) as PersonalDevelopmentCoachingRequest[];

  return {
    account,
    profile,
    canReviewQueue,
    requests,
    hasOpenAI: hasOpenAIEnv(),
  };
}

export async function loadPersonalDevelopmentStrengthsPageData(): Promise<PersonalDevelopmentStrengthsPageData> {
  const workspace = await loadPersonalDevelopmentWorkspaceData();

  if (!workspace.migrationReady || !workspace.personalProfile) {
    return {
      workspace,
      strengths: [],
      strengthReferences: [],
      sourceDocuments: [],
      readableDocumentCount: 0,
    };
  }

  const { supabase } = await requirePaidWorkspaceProfile({
    product: "leadership_help",
  });

  const [strengthsResult, sourceDocumentsResult] = await Promise.all([
    supabase
      .from("personal_strength_profiles")
      .select("id, theme_name, rank, domain, notes, created_at")
      .eq("organization_id", workspace.profile.organization_id)
      .eq("personal_development_profile_id", workspace.personalProfile.id)
      .order("rank", { ascending: true }),
    supabase
      .from("personal_source_documents")
      .select(
        "id, document_category, file_name, file_extension, mime_type, file_size_bytes, extracted_text, created_at",
      )
      .eq("organization_id", workspace.profile.organization_id)
      .eq("personal_development_profile_id", workspace.personalProfile.id)
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [strengthsResult, sourceDocumentsResult]) {
    if (result.error) {
      if (isMissingPersonalDevelopmentTablesError(result.error)) {
        return {
          workspace: {
            ...workspace,
            migrationReady: false,
          },
          strengths: [],
          strengthReferences: [],
          sourceDocuments: [],
          readableDocumentCount: 0,
        };
      }

      throw new Error(result.error.message);
    }
  }

  const strengths = (strengthsResult.data ?? []) as PersonalStrengthProfileRecord[];
  const sourceDocuments = (sourceDocumentsResult.data ?? []) as PersonalSourceDocumentRecord[];
  const readableDocumentCount = sourceDocuments.filter(
    (document) => (document.extracted_text ?? "").trim().length > 0,
  ).length;

  if (strengths.length === 0) {
    return {
      workspace,
      strengths,
      strengthReferences: [],
      sourceDocuments,
      readableDocumentCount,
    };
  }

  const strengthReferencesResult = await supabase
    .from("strengths_library")
    .select(
      "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
    )
    .in(
      "theme_name",
      strengths.map((strength) => strength.theme_name),
    );

  if (strengthReferencesResult.error) {
    throw new Error(strengthReferencesResult.error.message);
  }

  return {
    workspace,
    strengths,
    strengthReferences:
      (strengthReferencesResult.data ?? []) as PersonalStrengthReferenceRecord[],
    sourceDocuments,
    readableDocumentCount,
  };
}

export async function loadPersonalDevelopmentConnectedRoleSurveyData(
  roleId: string,
): Promise<PersonalDevelopmentConnectedRoleSurveyData> {
  const { profile, supabase } = await requirePaidWorkspaceProfile({
    product: "leadership_help",
  });
  const canManageSurvey = isAdminAppRole(profile.role);

  if (!canManageSurvey) {
    return {
      canManageSurvey,
      migrationReady: true,
      surveys: [],
      recipients: [],
      responses: [],
    };
  }

  const roleSurveysResult = await supabase
    .from("role_surveys")
    .select(
      "id, organization_id, role_id, title, description, intro_message, thank_you_message, status, created_by_profile_id, updated_by_profile_id, launched_at, closed_at, created_at, updated_at",
    )
    .eq("organization_id", profile.organization_id)
    .eq("role_id", roleId)
    .order("created_at", { ascending: false });

  if (roleSurveysResult.error) {
    if (isMissingRoleSurveyTablesError(roleSurveysResult.error)) {
      return {
        canManageSurvey,
        migrationReady: false,
        surveys: [],
        recipients: [],
        responses: [],
      };
    }

    throw new Error(roleSurveysResult.error.message);
  }

  const surveys = (roleSurveysResult.data ?? []) as RoleSurveyRecord[];
  const surveyIds = surveys.map((survey) => survey.id);

  if (surveyIds.length === 0) {
    return {
      canManageSurvey,
      migrationReady: true,
      surveys: [],
      recipients: [],
      responses: [],
    };
  }

  const [recipientsResult, responsesResult] = await Promise.all([
    supabase
      .from("role_survey_recipients")
      .select(
        "id, organization_id, survey_id, recipient_name, recipient_email, recipient_title, relationship_to_role, access_token, status, invited_by_profile_id, invited_at, opened_at, completed_at, reminder_sent_at, created_at, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .in("survey_id", surveyIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("role_survey_responses")
      .select(
        "id, organization_id, survey_id, recipient_id, response_json, normalized_competencies, submitted_at, created_at, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .in("survey_id", surveyIds)
      .order("submitted_at", { ascending: false }),
  ]);

  for (const result of [recipientsResult, responsesResult]) {
    if (result.error) {
      if (isMissingRoleSurveyTablesError(result.error)) {
        return {
          canManageSurvey,
          migrationReady: false,
          surveys: [],
          recipients: [],
          responses: [],
        };
      }

      throw new Error(result.error.message);
    }
  }

  return {
    canManageSurvey,
    migrationReady: true,
    surveys,
    recipients: (recipientsResult.data ?? []) as RoleSurveyRecipientRecord[],
    responses: (responsesResult.data ?? []) as RoleSurveyResponseRecord[],
  };
}
