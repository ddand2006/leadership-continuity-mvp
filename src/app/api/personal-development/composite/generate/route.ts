import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { hasOpenAIEnv } from "@/lib/env";
import {
  generatePersonalLeadershipNarrative,
  type PersonalLeadershipNarrative,
} from "@/lib/personal-leadership-composite";
import {
  generateRoleCompositeFromIdealCompetencies,
  generateRoleCompositeFromRoleProfile,
  normalizeRoleComposite,
  type RoleComposite,
} from "@/lib/role-composite";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { isMissingPersonalDevelopmentTablesError } from "@/lib/personal-development";

type RoleCharacteristicRow = {
  category: string;
  characteristic: string;
};

type RoleCompetencyRow = {
  name: string;
  definition: string | null;
  target_score: number | null;
  weight: number | null;
  behavioral_indicators: unknown;
  red_flags: unknown;
};

function fallbackList(
  value: unknown,
  fallback: string[],
) {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);

    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  return fallback;
}

function normalizeExistingRoleCompetencies(options: {
  title: string;
  department: string | null;
  description: string;
  competencies: RoleCompetencyRow[];
}) {
  const composite: RoleComposite = {
    title: options.title,
    department: options.department,
    description: options.description,
    competencies: options.competencies.map((competency) => ({
      name: competency.name.trim(),
      definition:
        competency.definition?.trim() ||
        `Demonstrates strong judgment and execution in ${competency.name.toLowerCase()}.`,
      weight: competency.weight && competency.weight > 0 ? competency.weight : 1,
      target_score:
        competency.target_score && competency.target_score >= 1
          ? competency.target_score
          : 4,
      behavioral_indicators: fallbackList(competency.behavioral_indicators, [
        `Consistently demonstrates ${competency.name.toLowerCase()} in visible leadership situations.`,
      ]),
      red_flags: fallbackList(competency.red_flags, [
        `Performance in ${competency.name.toLowerCase()} is inconsistent or reactive.`,
      ]),
    })),
  };

  return normalizeRoleComposite(composite);
}

function createCompositeNarrativeInput(options: {
  role: {
    title: string;
    department: string | null;
    description: string;
  };
  personalContext: {
    currentPositionTitle: string | null;
    yearsInRole: number | null;
    leadershipHistory: string | null;
    organizationalContext: string | null;
  };
  strengths: string[];
  evidence: {
    generation_mode: "ideal_competencies" | "existing_role_competencies" | "role_profile";
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  composite: RoleComposite;
}) {
  return generatePersonalLeadershipNarrative({
    role: options.role,
    personalContext: options.personalContext,
    strengths: options.strengths,
    evidence: options.evidence,
    composite: options.composite,
  });
}

export async function POST() {
  try {
    if (!hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY to .env.local before generating a Personal Development composite.",
        400,
      );
    }

    const { admin, profile } = await requireApiWorkspaceProfile({
      product: "leadership_help",
    });

    const personalProfileResult = await admin
      .from("personal_development_profiles")
      .select(
        "id, current_position_title, years_in_role, leadership_history, organizational_context",
      )
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (personalProfileResult.error) {
      if (isMissingPersonalDevelopmentTablesError(personalProfileResult.error)) {
        throw new ApiRouteError(
          "Apply the Personal Development foundation migration before generating a composite.",
          400,
        );
      }

      throw new ApiRouteError(personalProfileResult.error.message, 500);
    }

    if (!personalProfileResult.data) {
      throw new ApiRouteError(
        "Save your role profile before generating a Personal Development composite.",
        400,
      );
    }

    const personalProfile = personalProfileResult.data;

    const roleProfileResult = await admin
      .from("personal_role_profiles")
      .select(
        "id, source_role_id, role_mode, title, department, description",
      )
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id)
      .maybeSingle();

    if (roleProfileResult.error) {
      throw new ApiRouteError(roleProfileResult.error.message, 500);
    }

    if (!roleProfileResult.data) {
      throw new ApiRouteError(
        "Save your role profile before generating a Personal Development composite.",
        400,
      );
    }

    const roleProfile = roleProfileResult.data;

    const [
      latestCompositeResult,
      strengthsResult,
      roleCharacteristicsResult,
      roleCompetenciesResult,
      latestSurveyResult,
    ] = await Promise.all([
      admin
        .from("personal_leadership_composites")
        .select("version")
        .eq("organization_id", profile.organization_id)
        .eq("personal_development_profile_id", personalProfile.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("personal_strength_profiles")
        .select("theme_name")
        .eq("organization_id", profile.organization_id)
        .eq("personal_development_profile_id", personalProfile.id)
        .order("rank", { ascending: true })
        .limit(10),
      roleProfile.source_role_id
        ? admin
            .from("role_candidate_characteristics")
            .select("category, characteristic, sort_order")
            .eq("organization_id", profile.organization_id)
            .eq("role_id", roleProfile.source_role_id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      roleProfile.source_role_id
        ? admin
            .from("role_competencies")
            .select(
              "name, definition, target_score, weight, behavioral_indicators, red_flags",
            )
            .eq("organization_id", profile.organization_id)
            .eq("role_id", roleProfile.source_role_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      roleProfile.source_role_id
        ? admin
            .from("role_surveys")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .eq("role_id", roleProfile.source_role_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    for (const result of [
      latestCompositeResult,
      strengthsResult,
      roleCharacteristicsResult,
      roleCompetenciesResult,
      latestSurveyResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    const groupedCharacteristics = groupCharacteristicsByCategory(
      (roleCharacteristicsResult.data ?? []) as RoleCharacteristicRow[],
    );
    const sourceStrengths = (strengthsResult.data ?? []).map(
      (item) => item.theme_name,
    );

    let generationMode:
      | "ideal_competencies"
      | "existing_role_competencies"
      | "role_profile" = "role_profile";
    let generatedComposite: RoleComposite;

    if (
      groupedCharacteristics.talents.length +
        groupedCharacteristics.skills.length +
        groupedCharacteristics.behaviors.length >
      0
    ) {
      generationMode = "ideal_competencies";
      generatedComposite = await generateRoleCompositeFromIdealCompetencies({
        title: roleProfile.title,
        department: roleProfile.department,
        description: roleProfile.description,
        talents: groupedCharacteristics.talents,
        skills: groupedCharacteristics.skills,
        behaviors: groupedCharacteristics.behaviors,
      });
    } else if ((roleCompetenciesResult.data ?? []).length > 0) {
      generationMode = "existing_role_competencies";
      generatedComposite = normalizeExistingRoleCompetencies({
        title: roleProfile.title,
        department: roleProfile.department,
        description: roleProfile.description,
        competencies: (roleCompetenciesResult.data ?? []) as RoleCompetencyRow[],
      });
    } else {
      generatedComposite = await generateRoleCompositeFromRoleProfile({
        title: roleProfile.title,
        department: roleProfile.department,
        description: roleProfile.description,
        organizationalContext: personalProfile.organizational_context,
      });
    }

    const narrative = (await createCompositeNarrativeInput({
      role: {
        title: roleProfile.title,
        department: roleProfile.department,
        description: roleProfile.description,
      },
      personalContext: {
        currentPositionTitle: personalProfile.current_position_title,
        yearsInRole: personalProfile.years_in_role,
        leadershipHistory: personalProfile.leadership_history,
        organizationalContext: personalProfile.organizational_context,
      },
      strengths: sourceStrengths,
      evidence: {
        generation_mode: generationMode,
        talents: groupedCharacteristics.talents,
        skills: groupedCharacteristics.skills,
        behaviors: groupedCharacteristics.behaviors,
      },
      composite: generatedComposite,
    })) as PersonalLeadershipNarrative;

    const nextVersion = (latestCompositeResult.data?.version ?? 0) + 1;
    const generatedAt = new Date().toISOString();

    const archiveExistingResult = await admin
      .from("personal_leadership_composites")
      .update({ status: "archived" })
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalProfile.id)
      .neq("status", "archived");

    if (archiveExistingResult.error) {
      throw new ApiRouteError(archiveExistingResult.error.message, 500);
    }

    const insertCompositeResult = await admin
      .from("personal_leadership_composites")
      .insert({
        organization_id: profile.organization_id,
        personal_development_profile_id: personalProfile.id,
        personal_role_profile_id: roleProfile.id,
        source_survey_id: latestSurveyResult.data?.id ?? null,
        version: nextVersion,
        status: "generated",
        composite_json: {
          ...generatedComposite,
          evidence: {
            generation_mode: generationMode,
            talents: groupedCharacteristics.talents,
            skills: groupedCharacteristics.skills,
            behaviors: groupedCharacteristics.behaviors,
            strengths_on_file: sourceStrengths,
            source_role_competency_count: roleCompetenciesResult.data?.length ?? 0,
          },
        },
        narrative_json: narrative,
        generated_at: generatedAt,
      })
      .select("id")
      .single();

    if (insertCompositeResult.error) {
      throw new ApiRouteError(insertCompositeResult.error.message, 500);
    }

    const updateProfileResult = await admin
      .from("personal_development_profiles")
      .update({ last_composite_generated_at: generatedAt })
      .eq("organization_id", profile.organization_id)
      .eq("id", personalProfile.id);

    if (updateProfileResult.error) {
      throw new ApiRouteError(updateProfileResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Personal leadership composite generated for "${roleProfile.title}" (version ${nextVersion}).`,
      version: nextVersion,
      compositeId: insertCompositeResult.data.id,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate the Personal Development composite.",
    );
  }
}
