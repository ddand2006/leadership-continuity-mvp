import { zodTextFormat } from "openai/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiRouteError } from "@/lib/api-route";
import { getOpenAIEnv, hasOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

type StrengthLibraryRecord = {
  theme_name: string;
  domain: string;
  leadership_advantages?: string;
  possible_blind_spots?: string;
  development_uses?: string;
};

type StrengthRecord = {
  theme_name: string;
  rank: number;
  domain: string;
  notes?: string | null;
};

type CompetencyRecord = {
  id: string;
  name: string;
  definition?: string;
  target_score?: number;
  weight?: number;
  behavioral_indicators?: string[] | null;
  red_flags?: string[] | null;
};

const strengthsRoleFitAssessmentSchema = z.object({
  assessments: z.array(
    z.object({
      competency_id: z.string().uuid(),
      strength_score: z.number().min(1).max(5),
      supporting_strengths: z.array(z.string().trim().min(1)).max(5),
      rationale: z.string().trim().min(1),
    }),
  ),
});

export type CandidateRoleStrengthAssessment = {
  competency_id: string;
  strength_score: number;
  supporting_strengths: string[];
  rationale: string | null;
};

export async function generateCandidateRoleStrengthAssessments(options: {
  candidateName: string;
  roleTitle: string;
  roleDescription: string | null | undefined;
  competencies: CompetencyRecord[];
  strengths: StrengthRecord[];
  strengthsLibrary: StrengthLibraryRecord[];
}) {
  if (!hasOpenAIEnv()) {
    return [];
  }

  if (options.competencies.length === 0 || options.strengths.length === 0) {
    return [];
  }

  const openai = createOpenAIClient();
  const openAIEnv = getOpenAIEnv();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You evaluate how a candidate's CliftonStrengths profile supports success in a specific hospital leadership role competency. Score each competency from 1 to 5 using strengths evidence only. A 5 means the candidate's strengths strongly support natural success in that competency. A 3 means mixed or indirect support. A 1 means weak or little support. Use only the provided strengths, strengths-library context, and competency definitions. Return one assessment for every competency_id exactly once.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            candidate_name: options.candidateName,
            role: {
              title: options.roleTitle,
              description: options.roleDescription ?? null,
            },
            competencies: options.competencies.map((competency) => ({
              competency_id: competency.id,
              name: competency.name,
              definition: competency.definition ?? null,
              behavioral_indicators: competency.behavioral_indicators ?? [],
              red_flags: competency.red_flags ?? [],
            })),
            candidate_strengths: options.strengths.map((strength) => ({
              theme_name: strength.theme_name,
              rank: strength.rank,
              domain: strength.domain,
              notes: strength.notes ?? null,
            })),
            strengths_library: options.strengthsLibrary,
            instructions: {
              coverage:
                "Return one assessment for every competency_id provided in the competencies array.",
              scoring:
                "Use the full 1 to 5 scale. Higher scores mean stronger natural fit from strengths alone.",
              supporting_strengths:
                "Reference the most relevant strengths by official theme name.",
            },
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: zodTextFormat(
        strengthsRoleFitAssessmentSchema,
        "strengths_role_fit_assessments",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new ApiRouteError(
      "OpenAI could not evaluate strengths against the role competencies.",
      502,
    );
  }

  const expectedCompetencyIds = new Set(options.competencies.map((item) => item.id));
  const seen = new Set<string>();
  const assessments = response.output_parsed.assessments
    .filter((assessment) => {
      if (!expectedCompetencyIds.has(assessment.competency_id)) {
        return false;
      }

      if (seen.has(assessment.competency_id)) {
        return false;
      }

      seen.add(assessment.competency_id);
      return true;
    })
    .map((assessment) => ({
      competency_id: assessment.competency_id,
      strength_score: Number(assessment.strength_score.toFixed(2)),
      supporting_strengths: sanitizeAppTextList(assessment.supporting_strengths),
      rationale: sanitizeAppText(assessment.rationale),
    }));

  if (assessments.length !== options.competencies.length) {
    throw new ApiRouteError(
      "Strengths-to-competency assessment did not cover every role competency.",
      502,
    );
  }

  return assessments;
}

export async function syncCandidateRoleStrengthAssessments(options: {
  admin: Pick<SupabaseClient, "from">;
  organizationId: string;
  candidateId: string;
  roleId: string;
  candidateName: string;
  roleTitle: string;
  roleDescription?: string | null;
  competencies: CompetencyRecord[];
  strengths: StrengthRecord[];
  strengthsLibrary: StrengthLibraryRecord[];
  force?: boolean;
}) {
  if (!hasOpenAIEnv()) {
    return [];
  }

  if (options.competencies.length === 0 || options.strengths.length === 0) {
    return [];
  }

  const existingResult = await options.admin
    .from("candidate_role_strength_assessments")
    .select("competency_id, strength_score, supporting_strengths, rationale")
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId)
    .eq("role_id", options.roleId)
    .order("created_at", { ascending: true });

  if (existingResult.error) {
    throw new ApiRouteError(existingResult.error.message, 500);
  }

  const existingAssessments =
    (existingResult.data as CandidateRoleStrengthAssessment[] | null) ?? [];

  if (!options.force && existingAssessments.length === options.competencies.length) {
    return existingAssessments.map((assessment) => ({
      competency_id: assessment.competency_id,
      strength_score: Number(assessment.strength_score),
      supporting_strengths: sanitizeAppTextList(assessment.supporting_strengths ?? []),
      rationale: sanitizeAppText(assessment.rationale ?? null) || null,
    }));
  }

  const generatedAssessments = await generateCandidateRoleStrengthAssessments({
    candidateName: options.candidateName,
    roleTitle: options.roleTitle,
    roleDescription: options.roleDescription,
    competencies: options.competencies,
    strengths: options.strengths,
    strengthsLibrary: options.strengthsLibrary,
  });

  const deleteResult = await options.admin
    .from("candidate_role_strength_assessments")
    .delete()
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId)
    .eq("role_id", options.roleId);

  if (deleteResult.error) {
    throw new ApiRouteError(deleteResult.error.message, 500);
  }

  const insertResult = await options.admin
    .from("candidate_role_strength_assessments")
    .insert(
      generatedAssessments.map((assessment) => ({
        organization_id: options.organizationId,
        candidate_id: options.candidateId,
        role_id: options.roleId,
        competency_id: assessment.competency_id,
        strength_score: assessment.strength_score,
        supporting_strengths: assessment.supporting_strengths,
        rationale: assessment.rationale,
      })),
    );

  if (insertResult.error) {
    throw new ApiRouteError(insertResult.error.message, 500);
  }

  return generatedAssessments;
}
