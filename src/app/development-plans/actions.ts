"use server";

import { revalidatePath } from "next/cache";
import { hasOpenAIEnv } from "@/lib/env";
import { generateDevelopmentPlansForRole } from "@/lib/development-plan-generator";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";
import type { GenerateDevelopmentPlansState } from "@/app/development-plans/action-state";

function parseRequestedCount(formData: FormData) {
  const rawValue = formData.get("count");
  const parsedValue =
    typeof rawValue === "string" ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return 6;
  }

  return Math.min(12, Math.max(3, parsedValue));
}

export async function generateDevelopmentPlansAction(
  _previousState: GenerateDevelopmentPlansState,
  formData: FormData,
): Promise<GenerateDevelopmentPlansState> {
  if (!hasOpenAIEnv()) {
    return {
      status: "error",
      message: "Add OPENAI_API_KEY to .env.local before generating plans.",
      generatedTitles: [],
    };
  }

  const roleId = formData.get("roleId");

  if (typeof roleId !== "string" || roleId.trim().length === 0) {
    return {
      status: "error",
      message: "Choose a role first.",
      generatedTitles: [],
    };
  }

  const count = parseRequestedCount(formData);
  const { profile } = await requirePaidWorkspaceProfile();
  const admin = createSupabaseAdminClient();
  const [roleResult, competenciesResult, strengthsLibraryResult, existingPlansResult] =
    await Promise.all([
      admin
        .from("roles")
        .select("id, title, department, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", roleId)
        .maybeSingle(),
      admin
        .from("role_competencies")
        .select(
          "name, definition, behavioral_indicators, red_flags, target_score, weight",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .order("created_at", { ascending: true }),
      admin
        .from("strengths_library")
        .select("theme_name, domain, leadership_advantages, development_uses")
        .order("theme_name", { ascending: true }),
      admin
        .from("development_projects")
        .select("title")
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`),
    ]);

  for (const result of [
    roleResult,
    competenciesResult,
    strengthsLibraryResult,
    existingPlansResult,
  ]) {
    if (result.error) {
      return {
        status: "error",
        message: result.error.message,
        generatedTitles: [],
      };
    }
  }

  const role = roleResult.data;

  if (!role) {
    return {
      status: "error",
      message: "That role could not be found.",
      generatedTitles: [],
    };
  }

  const roleTitle = canonicalizeRoleTitle(role.title);

  if ((competenciesResult.data ?? []).length === 0) {
    return {
      status: "error",
      message:
        "This role needs competencies before development plans can be generated.",
      generatedTitles: [],
    };
  }

  try {
    const generatedPlans = await generateDevelopmentPlansForRole({
      role: {
        title: roleTitle,
        department: role.department,
        description: role.description,
      },
      competencies: (competenciesResult.data ?? []).map((competency) => ({
        name: competency.name,
        definition: competency.definition,
        behavioral_indicators:
          (competency.behavioral_indicators as string[] | null) ?? [],
        red_flags: (competency.red_flags as string[] | null) ?? [],
        target_score: competency.target_score,
        weight: competency.weight,
      })),
      strengthsLibrary: strengthsLibraryResult.data ?? [],
      existingTitles: (existingPlansResult.data ?? []).map((plan) => plan.title),
      count,
    });

    const existingTitles = new Set(
      (existingPlansResult.data ?? []).map((plan) => plan.title.trim().toLowerCase()),
    );

    const uniquePlans = generatedPlans.filter((plan) => {
      const normalizedTitle = plan.title.trim().toLowerCase();

      if (existingTitles.has(normalizedTitle)) {
        return false;
      }

      existingTitles.add(normalizedTitle);
      return true;
    });

    if (uniquePlans.length === 0) {
      return {
        status: "error",
        message:
          "No new plans were saved because the generated titles matched plans already in the library.",
        generatedTitles: [],
      };
    }

    const insertResult = await admin.from("development_projects").insert(
      uniquePlans.map((plan) => ({
        organization_id: profile.organization_id,
        title: plan.title,
        description: plan.description,
        difficulty: plan.difficulty,
        duration_days: plan.duration_days,
        applicable_roles: [roleTitle],
        competencies_developed: plan.competencies_developed,
        strengths_leveraged: plan.strengths_leveraged,
        expected_outcomes: plan.expected_outcomes,
        mentor_questions: plan.mentor_questions,
        evidence_of_success: plan.evidence_of_success,
      })),
    );

    if (insertResult.error) {
      return {
        status: "error",
        message: insertResult.error.message,
        generatedTitles: [],
      };
    }

    revalidatePath("/development-plans");
    revalidatePath("/candidates");

    return {
      status: "success",
      message: `Generated ${uniquePlans.length} development plan ideas for ${roleTitle}.`,
      generatedTitles: uniquePlans.map((plan) => plan.title),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The generator could not create development plans.",
      generatedTitles: [],
    };
  }
}
