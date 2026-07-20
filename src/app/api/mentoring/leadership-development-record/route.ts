import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { buildCompetencyAssessments } from "@/lib/fit-analysis";
import {
  isAdminAppRole,
  isCandidateSelfAccess,
} from "@/lib/mentor-access";
import type { OrganizationUserRecord } from "@/lib/organization-users";
import {
  calculateLeadershipDevelopmentGapRemaining,
  calculateLeadershipDevelopmentImprovement,
  computeLeadershipDevelopmentAverageFeedbackScore,
  formatLeadershipDevelopmentScore,
  isFilledLeadershipDevelopmentCompetency,
  isFilledLeadershipDevelopmentFeedback,
  isFilledLeadershipDevelopmentLeader,
  isLeadershipDevelopmentMentorReviewComplete,
  isMissingLeadershipDevelopmentRecordTableError,
  leadershipDevelopmentRecordPayloadSchema,
  parseLeadershipDevelopmentScore,
  type LeadershipDevelopmentFeedbackInput,
  type LeadershipDevelopmentRecordRecord,
} from "@/lib/leadership-development-record";
import {
  buildDevelopmentProjectFieldsFromLeadershipRecord,
  DEFAULT_PROJECT_DURATION_DAYS,
  inferProjectDifficulty,
} from "@/lib/development-project-library";
import {
  buildMentoringSourceProject,
  mentoringSourceProjectMatchesRoleTitle,
} from "@/lib/mentoring-source-project";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const leadershipDevelopmentQuerySchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
});

function assertScore(value: string, fieldLabel: string) {
  const parsed = parseLeadershipDevelopmentScore(value);

  if (
    parsed === null ||
    Number.isNaN(parsed) ||
    parsed < 1 ||
    parsed > 5 ||
    !/^(?:[1-4](?:\.\d{1,2})?|5(?:\.0{1,2})?)$/.test(value.trim())
  ) {
    throw new ApiRouteError(
      `${fieldLabel} must be a number from 1 to 5, with up to 2 decimals.`,
      400,
    );
  }

  return parsed;
}

function ensureUserCanAccessRecord(options: {
  account: Pick<
    OrganizationUserRecord,
    "candidate_id" | "is_candidate" | "is_mentor" | "admin_role"
  > | null;
  profile: { id: string; role: string };
  candidateId: string;
  mentorId: string;
}) {
  if (isAdminAppRole(options.profile.role)) {
    return;
  }

  if (
    options.profile.role === "mentor" &&
    options.mentorId === options.profile.id
  ) {
    return;
  }

  if (isCandidateSelfAccess(options.account, options.candidateId)) {
    return;
  }

  throw new ApiRouteError(
    "You do not have access to this leadership development record.",
    403,
  );
}

async function ensureAssignmentExists(options: {
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"];
  organizationId: string;
  candidateId: string;
  roleId: string;
  mentorId: string;
}) {
  const assignmentResult = await options.admin
    .from("mentor_role_assignments")
    .select("candidate_id")
    .eq("organization_id", options.organizationId)
    .eq("candidate_id", options.candidateId)
    .eq("role_id", options.roleId)
    .eq("mentor_profile_id", options.mentorId)
    .eq("status", "active")
    .maybeSingle();

  if (assignmentResult.error) {
    throw new ApiRouteError(assignmentResult.error.message, 500);
  }

  if (!assignmentResult.data) {
    throw new ApiRouteError(
      "This development record must be tied to an active mentor assignment.",
      404,
    );
  }
}

function normalizeRecordFromDatabase(record: {
  id: string;
  source_project_assignment_id: string | null;
  candidate_id: string;
  role_id: string;
  mentor_id: string;
  target_role: string;
  date_assigned: string;
  status: LeadershipDevelopmentRecordRecord["status"];
  growth_areas: string[] | null;
  assignment_reason: string | null;
  experience_title: string;
  mentee_task: string | null;
  project_summary: string | null;
  project_purpose: string | null;
  working_goal: string | null;
  why_it_fits: string | null;
  mentor_focus: string | null;
  first_step: string | null;
  key_partners: string[] | null;
  leadership_actions_required: string[] | null;
  anticipated_challenges: string[] | null;
  success_measures: string[] | null;
  mentor_preparation: string[] | null;
  mentee_preparation: string[] | null;
  reflection_questions: string[] | null;
  success_signals: string[] | null;
  readiness_signal: LeadershipDevelopmentRecordRecord["readinessSignal"] | null;
  mentor_improvement_observed: string | null;
  mentor_development_needed: string | null;
  next_recommended_experience: string | null;
  mentor_review_date: string | null;
  updated_at: string;
  average_feedback_score: number | null;
  candidate_name: string;
  primary_mentor: string;
  competencies: Array<{
    competency_name: string;
    baseline_score: number;
    target_score: number;
    current_score: number | null;
  }>;
  leaders: Array<{
    leader_name: string;
    department: string | null;
    purpose: string | null;
    meeting_completed: boolean | null;
  }>;
  feedback: Array<{
    reviewer_name: string;
    reviewer_role: string;
    review_date: string;
    growth_score: number;
    communication_score: number;
    collaboration_score: number;
    feedback_application_score: number;
    readiness_score: number;
    evidence_comments: string | null;
  }>;
}, resolvedTargetRole?: string | null): LeadershipDevelopmentRecordRecord {
  return {
    id: record.id,
    sourceProjectAssignmentId: record.source_project_assignment_id ?? "",
    candidateId: record.candidate_id,
    roleId: record.role_id,
    mentorId: record.mentor_id,
    candidateName: record.candidate_name,
    targetRole: resolvedTargetRole?.trim() || record.target_role,
    primaryMentor: record.primary_mentor,
    dateAssigned: record.date_assigned,
    status: record.status,
    growthAreas: (record.growth_areas ?? []) as LeadershipDevelopmentRecordRecord["growthAreas"],
    assignmentReason: record.assignment_reason ?? "",
    experienceTitle: record.experience_title,
    menteeTask: record.mentee_task ?? "",
    projectSummary: record.project_summary ?? "",
    projectPurpose: record.project_purpose ?? "",
    workingGoal: record.working_goal ?? "",
    whyItFits: record.why_it_fits ?? "",
    mentorFocus: record.mentor_focus ?? "",
    firstStep: record.first_step ?? "",
    keyPartners: record.key_partners ?? [],
    leadershipActionsRequired: record.leadership_actions_required ?? [],
    anticipatedChallenges: record.anticipated_challenges ?? [],
    successMeasures: record.success_measures ?? [],
    mentorPreparation: record.mentor_preparation ?? [],
    menteePreparation: record.mentee_preparation ?? [],
    reflectionQuestions: record.reflection_questions ?? [],
    successSignals: record.success_signals ?? [],
    leaderEngagements:
      record.leaders.length > 0
        ? record.leaders.map((leader) => ({
            leaderName: leader.leader_name,
            department: leader.department ?? "",
            purpose: leader.purpose ?? "",
            meetingCompleted: Boolean(leader.meeting_completed),
          }))
        : [],
    competencies:
      record.competencies.length > 0
        ? record.competencies.map((competency) => ({
            competencyName: competency.competency_name,
            baselineScore: formatLeadershipDevelopmentScore(competency.baseline_score),
            targetScore: formatLeadershipDevelopmentScore(competency.target_score),
            currentScore:
              competency.current_score === null
                ? ""
                : formatLeadershipDevelopmentScore(competency.current_score),
          }))
        : [],
    reviewerFeedback:
      record.feedback.length > 0
        ? record.feedback.map((feedback) => ({
            reviewerName: feedback.reviewer_name,
            reviewerRole: feedback.reviewer_role,
            reviewDate: feedback.review_date,
            growthScore: String(feedback.growth_score),
            communicationScore: String(feedback.communication_score),
            collaborationScore: String(feedback.collaboration_score),
            feedbackApplicationScore: String(feedback.feedback_application_score),
            readinessScore: String(feedback.readiness_score),
            evidenceComments: feedback.evidence_comments ?? "",
          }))
        : [],
    mentorImprovementObserved: record.mentor_improvement_observed ?? "",
    mentorDevelopmentNeeded: record.mentor_development_needed ?? "",
    readinessSignal: record.readiness_signal ?? "",
    nextRecommendedExperience: record.next_recommended_experience ?? "",
    mentorReviewDate: record.mentor_review_date ?? "",
    updatedAt: record.updated_at,
    averageFeedbackScore: record.average_feedback_score,
  };
}

export async function GET(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const url = new URL(request.url);
    const query = leadershipDevelopmentQuerySchema.parse({
      candidateId: url.searchParams.get("candidateId"),
      roleId: url.searchParams.get("roleId"),
      mentorId: url.searchParams.get("mentorId"),
      projectId: url.searchParams.get("projectId") ?? undefined,
    });

    ensureUserCanAccessRecord({
      account,
      profile,
      candidateId: query.candidateId,
      mentorId: query.mentorId,
    });
    await ensureAssignmentExists({
      admin,
      organizationId: profile.organization_id,
      candidateId: query.candidateId,
      roleId: query.roleId,
      mentorId: query.mentorId,
    });

    const [candidateResult, mentorResult, roleResult] = await Promise.all([
      admin
        .from("candidates")
        .select("full_name")
        .eq("organization_id", profile.organization_id)
        .eq("id", query.candidateId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name")
        .eq("organization_id", profile.organization_id)
        .eq("id", query.mentorId)
        .maybeSingle(),
      admin
        .from("roles")
        .select("title")
        .eq("organization_id", profile.organization_id)
        .eq("id", query.roleId)
        .maybeSingle(),
    ]);

    for (const result of [candidateResult, mentorResult, roleResult]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    const canonicalRoleTitle = canonicalizeRoleTitle(roleResult.data?.title ?? null);

    const [roleCompetenciesResult, panelsResult, strengthAssessmentsResult] =
      await Promise.all([
        admin
          .from("role_competencies")
          .select("id, name, target_score, weight")
          .eq("organization_id", profile.organization_id)
          .eq("role_id", query.roleId)
          .order("created_at", { ascending: true }),
        admin
          .from("interview_panels")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", query.candidateId)
          .eq("role_id", query.roleId),
        admin
          .from("candidate_role_strength_assessments")
          .select("competency_id, strength_score, supporting_strengths, rationale")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", query.candidateId)
          .eq("role_id", query.roleId),
      ]);

    for (const result of [
      roleCompetenciesResult,
      panelsResult,
      strengthAssessmentsResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
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
      throw new ApiRouteError(scoresResult.error.message, 500);
    }

    const competencyAssessments = buildCompetencyAssessments(
      (roleCompetenciesResult.data ?? []).map((competency) => ({
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
    ).map((assessment) => ({
      competencyId: assessment.competencyId,
      competencyName: assessment.competencyName,
      candidateScore: assessment.averageScore,
      targetScore: assessment.targetScore,
    }));

    const recordsResult = await admin
      .from("development_records")
      .select(
        "id, source_project_assignment_id, candidate_id, role_id, mentor_id, target_role, date_assigned, status, growth_areas, assignment_reason, experience_title, mentee_task, project_summary, project_purpose, working_goal, why_it_fits, mentor_focus, first_step, key_partners, leadership_actions_required, anticipated_challenges, success_measures, mentor_preparation, mentee_preparation, reflection_questions, success_signals, readiness_signal, mentor_improvement_observed, mentor_development_needed, next_recommended_experience, mentor_review_date, updated_at, average_feedback_score",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", query.candidateId)
      .eq("role_id", query.roleId)
      .eq("mentor_id", query.mentorId)
      .order("updated_at", { ascending: false });

    if (recordsResult.error) {
      if (isMissingLeadershipDevelopmentRecordTableError(recordsResult.error)) {
        throw new ApiRouteError(
          "Leadership development record storage is not available yet. Run the latest Supabase migration first.",
          503,
        );
      }

      throw new ApiRouteError(recordsResult.error.message, 500);
    }

    const recordIds = (recordsResult.data ?? []).map((record) => record.id);

    const [competenciesResult, leadersResult, feedbackResult] =
      recordIds.length > 0
        ? await Promise.all([
            admin
              .from("development_record_competencies")
              .select(
                "development_record_id, competency_name, baseline_score, target_score, current_score",
              )
              .in("development_record_id", recordIds)
              .order("created_at", { ascending: true }),
            admin
              .from("development_record_leaders")
              .select(
                "development_record_id, leader_name, department, purpose, meeting_completed",
              )
              .in("development_record_id", recordIds)
              .order("created_at", { ascending: true }),
            admin
              .from("development_record_feedback")
              .select(
                "development_record_id, reviewer_name, reviewer_role, review_date, growth_score, communication_score, collaboration_score, feedback_application_score, readiness_score, evidence_comments",
              )
              .in("development_record_id", recordIds)
              .order("created_at", { ascending: true }),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    for (const result of [competenciesResult, leadersResult, feedbackResult]) {
      if (result.error) {
        if (isMissingLeadershipDevelopmentRecordTableError(result.error)) {
          throw new ApiRouteError(
            "Leadership development record storage is not available yet. Run the latest Supabase migration first.",
            503,
          );
        }

        throw new ApiRouteError(result.error.message, 500);
      }
    }

    const projectAssignmentsResult = await admin
      .from("candidate_project_assignments")
      .select(
        "id, development_project_id, status, start_date, due_date, mentor_notes, created_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", query.candidateId)
      .eq("mentor_profile_id", query.mentorId)
      .order("created_at", { ascending: false });

    if (projectAssignmentsResult.error) {
      throw new ApiRouteError(projectAssignmentsResult.error.message, 500);
    }

    const developmentProjectIds = Array.from(
      new Set(
        (projectAssignmentsResult.data ?? []).map(
          (assignment) => assignment.development_project_id,
        ),
      ),
    );
    const developmentProjectsResult =
      developmentProjectIds.length > 0
        ? await admin
            .from("development_projects")
            .select(
              "id, title, description, purpose, working_goal, why_it_fits, strengths_application, mentor_focus, first_step, key_partners, leadership_actions_required, mentor_preparation, mentee_preparation, anticipated_challenges, duration_days, competencies_developed, expected_outcomes, mentor_questions, evidence_of_success, applicable_roles",
            )
            .eq("organization_id", profile.organization_id)
            .in("id", developmentProjectIds)
        : { data: [], error: null };

    if (developmentProjectsResult.error) {
      throw new ApiRouteError(developmentProjectsResult.error.message, 500);
    }

    const competenciesByRecordId = new Map<string, typeof competenciesResult.data>();
    const leadersByRecordId = new Map<string, typeof leadersResult.data>();
    const feedbackByRecordId = new Map<string, typeof feedbackResult.data>();

    for (const competency of competenciesResult.data ?? []) {
      const current = competenciesByRecordId.get(competency.development_record_id) ?? [];
      current.push(competency);
      competenciesByRecordId.set(competency.development_record_id, current);
    }

    for (const leader of leadersResult.data ?? []) {
      const current = leadersByRecordId.get(leader.development_record_id) ?? [];
      current.push(leader);
      leadersByRecordId.set(leader.development_record_id, current);
    }

    for (const feedback of feedbackResult.data ?? []) {
      const current = feedbackByRecordId.get(feedback.development_record_id) ?? [];
      current.push(feedback);
      feedbackByRecordId.set(feedback.development_record_id, current);
    }

    const projectById = new Map(
      (developmentProjectsResult.data ?? []).map((project) => [project.id, project]),
    );
    const projects = (projectAssignmentsResult.data ?? [])
      .map((assignment) => {
        const project = projectById.get(assignment.development_project_id);

        if (!project) {
          return null;
        }

        const sourceProject = buildMentoringSourceProject({
          id: assignment.id,
          projectId: project.id,
          title: project.title,
          description: project.description,
          purpose: project.purpose,
          workingGoal: project.working_goal,
          whyItFits: project.why_it_fits,
          strengthsApplication: project.strengths_application,
          mentorFocus: project.mentor_focus,
          firstStep: project.first_step,
          keyPartners: (project.key_partners as string[] | null) ?? [],
          leadershipActionsRequired:
            (project.leadership_actions_required as string[] | null) ?? [],
          mentorPreparation: (project.mentor_preparation as string[] | null) ?? [],
          menteePreparation: (project.mentee_preparation as string[] | null) ?? [],
          anticipatedChallenges:
            (project.anticipated_challenges as string[] | null) ?? [],
          durationDays: project.duration_days,
          competencyNames: project.competencies_developed,
          applicableRoles: project.applicable_roles,
          successMeasures: project.expected_outcomes,
          reflectionQuestions: project.mentor_questions,
          successSignals: project.evidence_of_success,
          startDate: assignment.start_date,
          dueDate: assignment.due_date,
          status: assignment.status,
          mentorNotes: assignment.mentor_notes,
        });

        const matchesRequestedProject =
          query.projectId === assignment.id || query.projectId === project.id;

        return matchesRequestedProject ||
          mentoringSourceProjectMatchesRoleTitle(
            sourceProject,
            canonicalRoleTitle,
          )
          ? sourceProject
          : null;
      })
      .filter((project): project is NonNullable<typeof project> => project !== null);

    const competencyNamesUsedByRecords = new Set(
      (recordsResult.data ?? []).flatMap((record) =>
        (competenciesByRecordId.get(record.id) ?? []).map(
          (competency) => competency.competency_name,
        ),
      ),
    );
    const sourceProjectsWithFallbackCompetencies = projects.map((project) => ({
      ...project,
      competencyNames:
        project.competencyNames.length > 0
          ? project.competencyNames
          : Array.from(competencyNamesUsedByRecords).slice(0, 1),
    }));

    return NextResponse.json({
      records: (recordsResult.data ?? []).map((record) =>
        normalizeRecordFromDatabase({
          ...record,
          candidate_name: candidateResult.data?.full_name ?? "",
          primary_mentor: mentorResult.data?.full_name ?? "",
          competencies: competenciesByRecordId.get(record.id) ?? [],
          leaders: leadersByRecordId.get(record.id) ?? [],
          feedback: feedbackByRecordId.get(record.id) ?? [],
        }, canonicalRoleTitle),
      ),
      projects: sourceProjectsWithFallbackCompetencies,
      competencyAssessments,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to load the leadership development records.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = leadershipDevelopmentRecordPayloadSchema.parse(await request.json());

    ensureUserCanAccessRecord({
      account,
      profile,
      candidateId: payload.candidateId,
      mentorId: payload.mentorId,
    });
    await ensureAssignmentExists({
      admin,
      organizationId: profile.organization_id,
      candidateId: payload.candidateId,
      roleId: payload.roleId,
      mentorId: payload.mentorId,
    });

    const roleResult = await admin
      .from("roles")
      .select("title")
      .eq("organization_id", profile.organization_id)
      .eq("id", payload.roleId)
      .maybeSingle();

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Target role could not be found.", 404);
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);
    const filledCompetencies = payload.competencies.filter(
      isFilledLeadershipDevelopmentCompetency,
    );

    if (filledCompetencies.length === 0) {
      throw new ApiRouteError(
        "Add at least one scored competency before saving this record.",
        400,
      );
    }

    const normalizedCompetencies = filledCompetencies.map((competency, index) => {
      if (competency.competencyName.trim().length === 0) {
        throw new ApiRouteError(
          `Competency #${index + 1} needs a competency name.`,
          400,
        );
      }

      const baselineScore = assertScore(
        competency.baselineScore,
        `Competency #${index + 1} baseline score`,
      );
      const targetScore = assertScore(
        competency.targetScore,
        `Competency #${index + 1} target score`,
      );
      const currentScore =
        competency.currentScore.trim().length > 0
          ? assertScore(
              competency.currentScore,
              `Competency #${index + 1} current score`,
            )
          : null;

      return {
        competency_name: competency.competencyName,
        baseline_score: baselineScore,
        target_score: targetScore,
        current_score: currentScore,
        improvement:
          currentScore === null
            ? null
            : calculateLeadershipDevelopmentImprovement(
                competency.baselineScore,
                competency.currentScore,
              ),
        gap_remaining:
          currentScore === null
            ? null
            : calculateLeadershipDevelopmentGapRemaining(
                competency.targetScore,
                competency.currentScore,
              ),
      };
    });

    const normalizedLeaders = payload.leaderEngagements
      .filter(isFilledLeadershipDevelopmentLeader)
      .map((leader) => ({
        leader_name: leader.leaderName,
        department: leader.department || null,
        purpose: leader.purpose || null,
        meeting_completed: leader.meetingCompleted,
      }));

    const normalizedFeedback = payload.reviewerFeedback
      .filter(isFilledLeadershipDevelopmentFeedback)
      .map((feedback, index) => {
        if (
          feedback.reviewerName.trim().length === 0 ||
          feedback.reviewerRole.trim().length === 0 ||
          feedback.reviewDate.trim().length === 0
        ) {
          throw new ApiRouteError(
            `Reviewer feedback #${index + 1} needs a reviewer name, role, and review date.`,
            400,
          );
        }

        return {
          reviewer_name: feedback.reviewerName,
          reviewer_role: feedback.reviewerRole,
          review_date: feedback.reviewDate,
          growth_score: assertScore(
            feedback.growthScore,
            `Reviewer feedback #${index + 1} growth score`,
          ),
          communication_score: assertScore(
            feedback.communicationScore,
            `Reviewer feedback #${index + 1} communication score`,
          ),
          collaboration_score: assertScore(
            feedback.collaborationScore,
            `Reviewer feedback #${index + 1} collaboration score`,
          ),
          feedback_application_score: assertScore(
            feedback.feedbackApplicationScore,
            `Reviewer feedback #${index + 1} feedback application score`,
          ),
          readiness_score: assertScore(
            feedback.readinessScore,
            `Reviewer feedback #${index + 1} readiness score`,
          ),
          evidence_comments: feedback.evidenceComments || null,
        };
      });

    if (payload.status === "completed" && !isLeadershipDevelopmentMentorReviewComplete(payload)) {
      throw new ApiRouteError(
        "Complete all mentor review fields before marking this record completed.",
        400,
      );
    }

    const timestamp = new Date().toISOString();
    const averageFeedbackScore = computeLeadershipDevelopmentAverageFeedbackScore(
      payload.reviewerFeedback.filter(isFilledLeadershipDevelopmentFeedback) as LeadershipDevelopmentFeedbackInput[],
    );

    const baseRecord = {
      organization_id: profile.organization_id,
      candidate_id: payload.candidateId,
      role_id: payload.roleId,
      mentor_id: payload.mentorId,
      source_project_assignment_id: payload.sourceProjectAssignmentId || null,
      target_role: roleTitle,
      date_assigned: payload.dateAssigned,
      status: payload.status,
      growth_areas: payload.growthAreas,
      assignment_reason: payload.assignmentReason || null,
      experience_title: payload.experienceTitle,
      mentee_task: payload.menteeTask || null,
      project_summary: payload.projectSummary || null,
      project_purpose: payload.projectPurpose || null,
      working_goal: payload.workingGoal || null,
      why_it_fits: payload.whyItFits || null,
      mentor_focus: payload.mentorFocus || null,
      first_step: payload.firstStep || null,
      key_partners: payload.keyPartners,
      leadership_actions_required: payload.leadershipActionsRequired,
      anticipated_challenges: payload.anticipatedChallenges,
      success_measures: payload.successMeasures,
      mentor_preparation: payload.mentorPreparation,
      mentee_preparation: payload.menteePreparation,
      reflection_questions: payload.reflectionQuestions,
      success_signals: payload.successSignals,
      readiness_signal: payload.readinessSignal || null,
      mentor_improvement_observed: payload.mentorImprovementObserved || null,
      mentor_development_needed: payload.mentorDevelopmentNeeded || null,
      next_recommended_experience: payload.nextRecommendedExperience || null,
      mentor_review_date: payload.mentorReviewDate || null,
      average_feedback_score: averageFeedbackScore,
      created_by_profile_id: profile.id,
      updated_at: timestamp,
    };

    const existingProjectRecordResult =
      !payload.id &&
      payload.sourceProjectAssignmentId &&
      payload.experienceTitle.trim().length > 0
        ? await admin
            .from("development_records")
            .select("id")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", payload.candidateId)
            .eq("role_id", payload.roleId)
            .eq("mentor_id", payload.mentorId)
            .eq("experience_title", payload.experienceTitle)
            .order("updated_at", { ascending: false })
            .limit(1)
        : { data: [], error: null };

    if (existingProjectRecordResult.error) {
      if (isMissingLeadershipDevelopmentRecordTableError(existingProjectRecordResult.error)) {
        throw new ApiRouteError(
          "Leadership development record storage is not available yet. Run the latest Supabase migration first.",
          503,
        );
      }

      throw new ApiRouteError(existingProjectRecordResult.error.message, 500);
    }

    const targetRecordId =
      payload.id || existingProjectRecordResult.data?.[0]?.id || null;

    const recordResult = targetRecordId
      ? await admin
          .from("development_records")
          .update(baseRecord)
          .eq("organization_id", profile.organization_id)
          .eq("id", targetRecordId)
          .select("id, updated_at")
          .single()
      : await admin
          .from("development_records")
          .insert({
            ...baseRecord,
            created_at: timestamp,
          })
          .select("id, updated_at")
          .single();

    if (recordResult.error) {
      if (isMissingLeadershipDevelopmentRecordTableError(recordResult.error)) {
        throw new ApiRouteError(
          "Leadership development record storage is not available yet. Run the latest Supabase migration first.",
          503,
        );
      }

      throw new ApiRouteError(recordResult.error.message, 500);
    }

    const recordId = recordResult.data.id;
    const assignmentStatus =
      payload.status === "ready_for_review" ? "in_progress" : payload.status;

    if (payload.sourceProjectAssignmentId) {
      const updateProjectAssignmentResult = await admin
        .from("candidate_project_assignments")
        .update({
          status: assignmentStatus,
          start_date: payload.dateAssigned,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.sourceProjectAssignmentId)
        .eq("candidate_id", payload.candidateId)
        .eq("mentor_profile_id", payload.mentorId);

      if (updateProjectAssignmentResult.error) {
        throw new ApiRouteError(updateProjectAssignmentResult.error.message, 500);
      }
    }

    for (const tableName of [
      "development_record_competencies",
      "development_record_leaders",
      "development_record_feedback",
    ]) {
      const deleteResult = await admin
        .from(tableName)
        .delete()
        .eq("development_record_id", recordId);

      if (deleteResult.error) {
        if (isMissingLeadershipDevelopmentRecordTableError(deleteResult.error)) {
          throw new ApiRouteError(
            "Leadership development record storage is not available yet. Run the latest Supabase migration first.",
            503,
          );
        }

        throw new ApiRouteError(deleteResult.error.message, 500);
      }
    }

    if (normalizedCompetencies.length > 0) {
      const insertCompetenciesResult = await admin
        .from("development_record_competencies")
        .insert(
          normalizedCompetencies.map((competency) => ({
            development_record_id: recordId,
            ...competency,
            created_at: timestamp,
            updated_at: timestamp,
          })),
        );

      if (insertCompetenciesResult.error) {
        throw new ApiRouteError(insertCompetenciesResult.error.message, 500);
      }
    }

    if (normalizedLeaders.length > 0) {
      const insertLeadersResult = await admin
        .from("development_record_leaders")
        .insert(
          normalizedLeaders.map((leader) => ({
            development_record_id: recordId,
            ...leader,
            created_at: timestamp,
            updated_at: timestamp,
          })),
        );

      if (insertLeadersResult.error) {
        throw new ApiRouteError(insertLeadersResult.error.message, 500);
      }
    }

    if (normalizedFeedback.length > 0) {
      const insertFeedbackResult = await admin
        .from("development_record_feedback")
        .insert(
          normalizedFeedback.map((feedback) => ({
            development_record_id: recordId,
            ...feedback,
            created_at: timestamp,
          })),
        );

      if (insertFeedbackResult.error) {
        throw new ApiRouteError(insertFeedbackResult.error.message, 500);
      }
    }

    const organizationResult = await admin
      .from("organizations")
      .select("industry")
      .eq("id", profile.organization_id)
      .maybeSingle();

    if (organizationResult.error) {
      throw new ApiRouteError(organizationResult.error.message, 500);
    }

    const sourceAssignmentResult =
      payload.sourceProjectAssignmentId.trim().length > 0
        ? await admin
            .from("candidate_project_assignments")
            .select("development_project_id")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", payload.candidateId)
            .eq("mentor_profile_id", payload.mentorId)
            .eq("id", payload.sourceProjectAssignmentId)
            .maybeSingle()
        : { data: null, error: null };

    if (sourceAssignmentResult.error) {
      throw new ApiRouteError(sourceAssignmentResult.error.message, 500);
    }

    const sourceProjectResult =
      sourceAssignmentResult.data?.development_project_id
        ? await admin
            .from("development_projects")
            .select(
              "id, organization_id, duration_days, difficulty, strengths_leveraged, applicable_roles",
            )
            .eq("id", sourceAssignmentResult.data.development_project_id)
            .maybeSingle()
        : { data: null, error: null };

    if (sourceProjectResult.error) {
      throw new ApiRouteError(sourceProjectResult.error.message, 500);
    }

    const existingOrgProjectResult = await admin
      .from("development_projects")
      .select("id, duration_days, strengths_leveraged, applicable_roles")
      .eq("organization_id", profile.organization_id)
      .eq("title", payload.experienceTitle)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingOrgProjectResult.error) {
      throw new ApiRouteError(existingOrgProjectResult.error.message, 500);
    }

    const existingOrgProject =
      (sourceProjectResult.data &&
      sourceProjectResult.data.organization_id === profile.organization_id
        ? {
            id: sourceProjectResult.data.id,
            duration_days: sourceProjectResult.data.duration_days,
            strengths_leveraged: sourceProjectResult.data.strengths_leveraged,
            applicable_roles: sourceProjectResult.data.applicable_roles,
          }
        : null) ??
      existingOrgProjectResult.data?.[0] ??
      null;

    const syncedProjectFields = buildDevelopmentProjectFieldsFromLeadershipRecord({
      record: payload,
      roleTitle,
      competencyNames: normalizedCompetencies.map(
        (competency) => competency.competency_name,
      ),
      industryName: organizationResult.data?.industry ?? null,
      durationDays:
        existingOrgProject?.duration_days ??
        sourceProjectResult.data?.duration_days ??
        DEFAULT_PROJECT_DURATION_DAYS,
      strengthsLeveraged:
        (existingOrgProject?.strengths_leveraged as string[] | null) ??
        (sourceProjectResult.data?.strengths_leveraged as string[] | null) ??
        [],
      existingRoles:
        (existingOrgProject?.applicable_roles as string[] | null) ??
        (sourceProjectResult.data?.applicable_roles as string[] | null) ??
        [],
    });

    const syncedProjectPayload = {
      organization_id: profile.organization_id,
      source_development_record_id: recordId,
      source_project_assignment_id: payload.sourceProjectAssignmentId || null,
      ...syncedProjectFields,
      difficulty:
        syncedProjectFields.difficulty ||
        sourceProjectResult.data?.difficulty ||
        inferProjectDifficulty(
          syncedProjectFields.duration_days || DEFAULT_PROJECT_DURATION_DAYS,
        ),
    };

    const syncProjectResult = existingOrgProject
      ? await admin
          .from("development_projects")
          .update(syncedProjectPayload)
          .eq("organization_id", profile.organization_id)
          .eq("id", existingOrgProject.id)
      : await admin.from("development_projects").insert(syncedProjectPayload);

    if (syncProjectResult.error) {
      throw new ApiRouteError(syncProjectResult.error.message, 500);
    }

    return NextResponse.json({
      message:
        payload.status === "completed"
          ? "Leadership development record completed."
          : payload.status === "ready_for_review"
            ? "Reviewer feedback submitted and record saved."
            : "Leadership development record saved.",
      record: {
        id: recordResult.data.id,
        updatedAt: recordResult.data.updated_at,
        averageFeedbackScore,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to save the leadership development record.",
    );
  }
}
