import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { generateCandidateMentoringIdeas } from "@/lib/candidate-mentoring-ideas";
import { hasOpenAIEnv } from "@/lib/env";
import {
  buildCompetencyAssessments,
  categorizeStrengths,
  rankMentoringIdeasForCompetency,
  type DevelopmentProjectRecord,
} from "@/lib/fit-analysis";
import { isAdminAppRole, mentorHasCandidateAccess } from "@/lib/mentor-access";

const payloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  competencyId: z.string().uuid(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY to .env.local before generating mentoring ideas.",
        400,
      );
    }

    const { profile, admin } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [
      candidateResult,
      roleResult,
      competenciesResult,
      strengthsResult,
      panelsResult,
      strengthAssessmentsResult,
      projectsResult,
      mentorAssignmentsResult,
      considerationsResult,
    ] = await Promise.all([
      admin
        .from("candidates")
        .select("id, full_name, current_title, status, target_role_id")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.candidateId)
        .maybeSingle(),
      admin
        .from("roles")
        .select("id, title, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .maybeSingle(),
      admin
        .from("role_competencies")
        .select(
          "id, name, definition, target_score, weight, behavioral_indicators, red_flags",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .order("created_at", { ascending: true }),
      admin
        .from("candidate_strengths")
        .select("theme_name, rank, domain")
        .eq("candidate_id", payload.candidateId)
        .order("rank", { ascending: true }),
      admin
        .from("interview_panels")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      admin
        .from("candidate_role_strength_assessments")
        .select("competency_id, strength_score, supporting_strengths, rationale")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      admin
        .from("development_projects")
        .select(
          "title, description, difficulty, duration_days, applicable_roles, competencies_developed, strengths_leveraged, expected_outcomes, mentor_questions, evidence_of_success",
        )
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`),
      admin
        .from("mentor_role_assignments")
        .select("candidate_id, mentor_profile_id, role_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      admin
        .from("candidate_role_considerations")
        .select("role_id")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
    ]);

    for (const result of [
      candidateResult,
      roleResult,
      competenciesResult,
      strengthsResult,
      panelsResult,
      strengthAssessmentsResult,
      projectsResult,
      mentorAssignmentsResult,
      considerationsResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data) {
      throw new ApiRouteError("Candidate could not be found.", 404);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Role could not be found.", 404);
    }

    const mentorHasAccess = mentorHasCandidateAccess({
      profileId: profile.id,
      candidateId: payload.candidateId,
      roleId: payload.roleId,
      mentorAssignments: mentorAssignmentsResult.data ?? [],
    });

    if (!isAdminAppRole(profile.role) && !mentorHasAccess) {
      throw new ApiRouteError(
        "You do not have access to generate mentoring ideas for this candidate.",
        403,
      );
    }

    const roleAttachedToCandidate =
      (considerationsResult.data ?? []).length > 0 ||
      candidateResult.data.target_role_id === payload.roleId;

    if (!roleAttachedToCandidate && !mentorHasAccess) {
      throw new ApiRouteError("This role is not attached to the selected candidate.", 400);
    }

    const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
    const scoresResult =
      panelIds.length > 0
        ? await admin
            .from("interview_scores")
            .select("competency_id, score_numeric, evidence_notes, concern_notes")
            .in("panel_id", panelIds)
        : { data: [], error: null };

    if (scoresResult.error) {
      throw new ApiRouteError(scoresResult.error.message, 500);
    }

    const assessments = buildCompetencyAssessments(
      (competenciesResult.data ?? []).map((competency) => ({
        id: competency.id,
        name: competency.name,
        target_score: competency.target_score,
        weight: competency.weight,
      })),
      scoresResult.data ?? [],
      (strengthAssessmentsResult.data ?? []).map((assessment) => ({
        competency_id: assessment.competency_id,
        strength_score: Number(assessment.strength_score),
        supporting_strengths: assessment.supporting_strengths as string[],
        rationale: assessment.rationale,
      })),
    );

    const competencyAssessment = assessments.find(
      (assessment) => assessment.competencyId === payload.competencyId,
    );
    const competencyRecord = (competenciesResult.data ?? []).find(
      (competency) => competency.id === payload.competencyId,
    );

    if (!competencyAssessment || !competencyRecord) {
      throw new ApiRouteError("That competency could not be found for this role.", 404);
    }

    const strengthBuckets = categorizeStrengths(strengthsResult.data ?? []);
    const topStrengths = strengthBuckets.primary.map((strength) => strength.theme_name);
    const developmentProjects = ((projectsResult.data ?? []) as DevelopmentProjectRecord[]).map(
      (project) => ({
        ...project,
        applicable_roles: (project.applicable_roles as string[]) ?? [],
        competencies_developed: (project.competencies_developed as string[]) ?? [],
        strengths_leveraged: (project.strengths_leveraged as string[]) ?? [],
        expected_outcomes: (project.expected_outcomes as string[]) ?? [],
        mentor_questions: (project.mentor_questions as string[]) ?? [],
        evidence_of_success: (project.evidence_of_success as string[]) ?? [],
      }),
    );
    const referenceIdeas = rankMentoringIdeasForCompetency(developmentProjects, {
      roleTitle: roleResult.data.title,
      competencyName: competencyAssessment.competencyName,
      supportingStrengths: competencyAssessment.supportingStrengths,
      leverageStrengths: topStrengths,
      readiness: competencyAssessment.averageScore,
    })
      .slice(0, 3)
      .map((idea) => ({
        title: idea.title,
        description: idea.description,
        difficulty: idea.difficulty,
        durationDays: idea.durationDays,
        expectedOutcomes: idea.expectedOutcomes,
        mentorQuestions: idea.mentorQuestions,
      }));

    const ideas = await generateCandidateMentoringIdeas({
      candidate: {
        fullName: candidateResult.data.full_name,
        currentTitle: candidateResult.data.current_title,
        status: candidateResult.data.status,
      },
      role: {
        title: roleResult.data.title,
        description: roleResult.data.description,
      },
      competency: {
        name: competencyAssessment.competencyName,
        definition: competencyRecord.definition,
        targetScore: competencyAssessment.targetScore,
        averageScore: competencyAssessment.averageScore,
        interviewScore: competencyAssessment.interviewScore,
        strengthsScore: competencyAssessment.strengthsScore,
        weightedGap: competencyAssessment.weightedGap,
        status: competencyAssessment.status,
        evidenceNotes: competencyAssessment.evidenceNotes,
        concernNotes: competencyAssessment.concernNotes,
        strengthsRationale: competencyAssessment.strengthsRationale,
        supportingStrengths: competencyAssessment.supportingStrengths,
        behavioralIndicators:
          (competencyRecord.behavioral_indicators as string[] | null) ?? [],
        redFlags: (competencyRecord.red_flags as string[] | null) ?? [],
      },
      topStrengths,
      supportingStrengths: competencyAssessment.supportingStrengths,
      referenceIdeas,
    });

    return NextResponse.json({ ideas });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate candidate-specific mentoring ideas.",
    );
  }
}
