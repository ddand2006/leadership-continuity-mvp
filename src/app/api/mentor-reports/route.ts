import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import {
  buildCompetencyAssessments,
  categorizeStrengths,
  computeOverallReadiness,
  rankDevelopmentProjects,
} from "@/lib/fit-analysis";
import {
  buildMentorReportNarrative,
  buildRoleMatchesWeakestToStrongest,
  mentorReportSchema,
} from "@/lib/mentor-report";
import { estimateOpenAICost } from "@/lib/openaiCost";
import { createOpenAIClient } from "@/lib/openai";
import { syncCandidateRoleStrengthAssessments } from "@/lib/strengths-role-fit";
import { createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";
import { isAdminAppRole, mentorHasCandidateAccess } from "@/lib/mentor-access";

export async function POST(request: Request) {
  try {
    const requestJson = (await request.json()) as {
      candidateId?: string;
      roleId?: string;
    };
    const candidateId = requestJson.candidateId;
    const roleId = requestJson.roleId;

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required." },
        { status: 400 },
      );
    }

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required." },
        { status: 400 },
      );
    }

    const { admin, profile } = await requireApiWorkspaceProfile();
    const isAdmin = isAdminAppRole(profile.role);
    const [candidateResult, candidateRoleResult, mentorAssignmentAccessResult] =
      await Promise.all([
        admin
          .from("candidates")
          .select("id, full_name, current_title, target_role_id, status")
          .eq("organization_id", profile.organization_id)
          .eq("id", candidateId)
          .single(),
        admin
          .from("candidate_role_considerations")
          .select("candidate_id, role_id")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", candidateId)
          .eq("role_id", roleId)
          .maybeSingle(),
        isAdmin
          ? Promise.resolve({ data: { candidate_id: candidateId }, error: null })
          : admin
              .from("mentor_role_assignments")
              .select("candidate_id, role_id, mentor_profile_id, status")
              .eq("organization_id", profile.organization_id)
              .eq("candidate_id", candidateId)
              .eq("role_id", roleId)
              .eq("mentor_profile_id", profile.id),
      ]);

    if (candidateResult.error) {
      return NextResponse.json(
        { error: candidateResult.error.message },
        { status: 404 },
      );
    }

    if (candidateRoleResult.error) {
      return NextResponse.json(
        { error: candidateRoleResult.error.message },
        { status: 500 },
      );
    }

    if (mentorAssignmentAccessResult.error) {
      return NextResponse.json(
        { error: mentorAssignmentAccessResult.error.message },
        { status: 500 },
      );
    }

    if (!candidateRoleResult.data) {
      return NextResponse.json(
        { error: "This candidate is not currently under consideration for that role." },
        { status: 400 },
      );
    }

    const mentorHasAccess = isAdmin
      ? true
      : mentorHasCandidateAccess({
          profileId: profile.id,
          candidateId,
          roleId,
          mentorAssignments: Array.isArray(mentorAssignmentAccessResult.data)
            ? mentorAssignmentAccessResult.data
            : [],
        });

    if (!mentorHasAccess) {
      return NextResponse.json(
        {
          error:
            "You do not have access to generate a mentor report for this candidate-role assignment.",
        },
        { status: 403 },
      );
    }

    const candidate = candidateResult.data;

    const [
      roleResult,
      competenciesResult,
      strengthsResult,
      strengthsLibraryResult,
      panelsResult,
      projectsResult,
      existingReportsResult,
      strengthAssessmentsResult,
    ] = await Promise.all([
      admin
        .from("roles")
        .select("id, title, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", roleId)
        .single(),
      admin
        .from("role_competencies")
        .select(
          "id, name, definition, target_score, weight, behavioral_indicators, red_flags",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .order("created_at", { ascending: true }),
      admin
        .from("candidate_strengths")
        .select("theme_name, rank, domain, notes")
        .eq("candidate_id", candidate.id)
        .order("rank", { ascending: true }),
      admin
        .from("strengths_library")
        .select(
          "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses, coaching_questions",
        ),
      admin
        .from("interview_panels")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidate.id)
        .eq("role_id", roleId),
      admin
        .from("development_projects")
        .select(
          "title, description, difficulty, duration_days, applicable_roles, competencies_developed, strengths_leveraged, expected_outcomes, mentor_questions, evidence_of_success",
        )
        .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`),
      admin
        .from("mentor_reports")
        .select("version")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidate.id)
        .eq("role_id", roleId)
        .order("version", { ascending: false })
        .limit(1),
      admin
        .from("candidate_role_strength_assessments")
        .select("competency_id, strength_score, supporting_strengths, rationale")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidate.id)
        .eq("role_id", roleId),
    ]);

    for (const result of [
      roleResult,
      competenciesResult,
      strengthsResult,
      strengthsLibraryResult,
      panelsResult,
      projectsResult,
      existingReportsResult,
      strengthAssessmentsResult,
    ]) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
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
      return NextResponse.json(
        { error: scoresResult.error.message },
        { status: 500 },
      );
    }

    const role = roleResult.data;

    if (!role) {
      return NextResponse.json(
        { error: "Target role could not be loaded for this candidate." },
        { status: 404 },
      );
    }

    const strengthAssessments =
      (strengthAssessmentsResult.data ?? []).length > 0
        ? (strengthAssessmentsResult.data ?? []).map((assessment) => ({
            competency_id: assessment.competency_id,
            strength_score: Number(assessment.strength_score),
            supporting_strengths: assessment.supporting_strengths as string[],
            rationale: assessment.rationale,
          }))
        : await syncCandidateRoleStrengthAssessments({
            admin,
            organizationId: profile.organization_id,
            candidateId: candidate.id,
            roleId: role.id,
            candidateName: candidate.full_name,
            roleTitle: role.title,
            roleDescription: role.description,
            competencies: (competenciesResult.data ?? []).map((competency) => ({
              ...competency,
              behavioral_indicators: competency.behavioral_indicators as string[],
              red_flags: competency.red_flags as string[],
            })),
            strengths: strengthsResult.data ?? [],
            strengthsLibrary: (strengthsLibraryResult.data ?? []).map((theme) => ({
              theme_name: theme.theme_name,
              domain: theme.domain,
              leadership_advantages: theme.leadership_advantages,
              possible_blind_spots: theme.possible_blind_spots,
              development_uses: theme.development_uses,
            })),
          });

    const competencyAssessments = buildCompetencyAssessments(
      competenciesResult.data ?? [],
      scoresResult.data ?? [],
      strengthAssessments,
    );
    const readiness = computeOverallReadiness(competencyAssessments);
    const strengths = strengthsResult.data ?? [];
    const strengthBuckets = categorizeStrengths(strengths);
    const developmentPriorities = competencyAssessments
      .filter((assessment) => assessment.status !== "Strong Match")
      .slice(0, 5);
    const leverageStrengths = strengths
      .filter((strength) => strength.rank <= 15)
      .map((strength) => strength.theme_name);
    const rankedProjects = rankDevelopmentProjects(
      (projectsResult.data ?? []).map((project) => ({
        ...project,
        applicable_roles: project.applicable_roles as string[],
        competencies_developed: project.competencies_developed as string[],
        strengths_leveraged: project.strengths_leveraged as string[],
        expected_outcomes: (project.expected_outcomes as string[]) ?? [],
        mentor_questions: (project.mentor_questions as string[]) ?? [],
        evidence_of_success: (project.evidence_of_success as string[]) ?? [],
      })),
      role.title,
      developmentPriorities.map((priority) => priority.competencyName),
      leverageStrengths,
      readiness,
    ).slice(0, 5);

    const openai = createOpenAIClient();
    const openAIEnv = getOpenAIEnv();
    const response = await openai.responses.parse({
      model: openAIEnv.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are an expert organizational leadership development advisor. Create a mentor-facing development report that is practical, specific, constructive, and grounded in the supplied evidence. Do not invent unsupported facts. Use only the supplied ranked project matches when recommending projects.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              role: {
                title: role.title,
                description: role.description,
                competencies: competenciesResult.data,
              },
              candidate: {
                full_name: candidate.full_name,
                current_title: candidate.current_title,
                status: candidate.status,
                target_role_title: role.title,
              },
              readiness_score: readiness,
              competency_assessments: competencyAssessments,
              candidate_strengths: strengths,
              strengths_buckets: {
                primary: strengthBuckets.primary,
                supporting: strengthBuckets.supporting,
                stretch: strengthBuckets.stretch,
              },
              strengths_library: strengthsLibraryResult.data,
              ranked_project_matches: rankedProjects,
              instructions: {
                development_priorities: "Return 3 to 5 priorities.",
                recommended_projects: "Return 3 to 5 projects using only supplied project titles.",
                strengths_to_leverage:
                  "For every development priority, connect at least one specific strength.",
              },
            },
            null,
            2,
          ),
        },
      ],
      text: {
        format: zodTextFormat(mentorReportSchema, "mentor_report"),
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "OpenAI returned no parsed mentor report." },
        { status: 502 },
      );
    }

    const normalizedReport = {
      ...response.output_parsed,
      strongest_role_matches:
        buildRoleMatchesWeakestToStrongest(competencyAssessments),
    };

    const promptTokens = response.usage?.input_tokens ?? 0;
    const completionTokens = response.usage?.output_tokens ?? 0;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const model = response.model ?? openAIEnv.OPENAI_MODEL;
    const estimatedCost = estimateOpenAICost({
      model,
      promptTokens,
      completionTokens,
    });

    const nextVersion = (existingReportsResult.data?.[0]?.version ?? 0) + 1;
    const insertResult = await admin
      .from("mentor_reports")
      .insert({
        organization_id: profile.organization_id,
        candidate_id: candidate.id,
        role_id: role.id,
        version: nextVersion,
        report_json: normalizedReport,
        narrative_text: buildMentorReportNarrative(normalizedReport),
        generated_by: profile.id,
      })
      .select("id, version")
      .single();

    if (insertResult.error) {
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 },
      );
    }

    const usageLogResult = await admin.from("openai_usage_logs").insert({
      feature_name: "mentor_report",
      report_id: insertResult.data.id,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
    });

    if (usageLogResult.error) {
      console.error("Failed to save OpenAI usage log for mentor report", {
        candidateId: candidate.id,
        reportId: insertResult.data.id,
        error: usageLogResult.error,
      });
    }

    return NextResponse.json({
      message: `Mentor report v${insertResult.data.version} generated successfully.`,
      reportId: insertResult.data.id,
      version: insertResult.data.version,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected mentor report failure.");
  }
}
