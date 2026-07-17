import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isMissingCandidateGeneratedMentoringIdeaSetTableError } from "@/lib/candidate-generated-mentoring-idea-set";
import {
  buildLeadershipDevelopmentRecordFromProject,
  buildCandidateSpecificProjectDescription,
  buildMentoringSourceProject,
  buildMentoringProjectAssignmentNotes,
} from "@/lib/mentoring-source-project";
import { isAdminAppRole, mentorHasCandidateAccess } from "@/lib/mentor-access";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const payloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorProfileId: z.string().uuid().optional(),
  competencyId: z.string().uuid(),
  idea: z.object({
    title: z.string().min(1),
    project_type: z.enum(["departmental", "cross_departmental"]),
    purpose: z.string().min(1),
    description: z.string().min(1),
    working_goal: z.string().min(1),
    why_it_fits: z.string().min(1),
    strengths_application: z.string().min(1),
    mentor_focus: z.string().min(1),
    first_step: z.string().min(1),
    key_partners: z.array(z.string().min(1)).min(2).max(6),
    leadership_actions_required: z.array(z.string().min(1)).min(2).max(5),
    mentor_preparation: z.array(z.string().min(1)).min(2).max(4),
    mentee_preparation: z.array(z.string().min(1)).min(2).max(4),
    anticipated_challenges: z.array(z.string().min(1)).min(2).max(4),
    success_measures: z.array(z.string().min(1)).min(3).max(5),
    reflection_questions: z.array(z.string().min(1)).min(2).max(4),
    duration_days: z.number().int().min(14).max(120),
    success_signals: z.array(z.string().min(1)).min(2).max(6),
  }),
});

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function choosePreferredMentorAssignment(options: {
  activeAssignments: Array<{
    candidate_id: string;
    mentor_profile_id: string | null;
    role_id: string;
    status: string;
  }>;
  currentProfileId: string;
  requestedMentorProfileId?: string;
  validMentorProfileIds: Set<string>;
}) {
  const {
    activeAssignments,
    currentProfileId,
    requestedMentorProfileId,
    validMentorProfileIds,
  } = options;

  return (
    (requestedMentorProfileId
      ? activeAssignments.find(
          (assignment) =>
            assignment.mentor_profile_id === requestedMentorProfileId &&
            validMentorProfileIds.has(requestedMentorProfileId),
        ) ?? null
      : null) ??
    activeAssignments.find(
      (assignment) =>
        assignment.mentor_profile_id === currentProfileId &&
        validMentorProfileIds.has(currentProfileId),
    ) ??
    activeAssignments.find(
      (assignment) =>
        assignment.mentor_profile_id !== null &&
        validMentorProfileIds.has(assignment.mentor_profile_id),
    ) ??
    activeAssignments.find((assignment) => assignment.mentor_profile_id !== null) ??
    null
  );
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const [
      candidateResult,
      roleResult,
      competencyResult,
      mentorAssignmentsResult,
      existingProjectResult,
    ] = await Promise.all([
      admin
        .from("candidates")
        .select("id, full_name, target_role_id")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.candidateId)
        .maybeSingle(),
      admin
        .from("roles")
        .select("id, title")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .maybeSingle(),
      admin
        .from("role_competencies")
        .select("id, name")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.competencyId)
        .maybeSingle(),
      admin
        .from("mentor_role_assignments")
        .select("candidate_id, mentor_profile_id, role_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", payload.candidateId)
        .eq("role_id", payload.roleId),
      admin
        .from("development_projects")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("title", payload.idea.title)
        .maybeSingle(),
    ]);

    for (const result of [
      candidateResult,
      roleResult,
      competencyResult,
      mentorAssignmentsResult,
      existingProjectResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data || !roleResult.data || !competencyResult.data) {
      throw new ApiRouteError("Unable to locate the candidate, role, or competency.", 404);
    }

    const mentorHasAccess = mentorHasCandidateAccess({
      profileId: profile.id,
      candidateId: payload.candidateId,
      roleId: payload.roleId,
      mentorAssignments: mentorAssignmentsResult.data ?? [],
    });

    if (!isAdminAppRole(profile.role) && !mentorHasAccess) {
      throw new ApiRouteError(
        "You do not have access to choose mentoring projects for this candidate.",
        403,
      );
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);
    const activeMentorAssignments = (mentorAssignmentsResult.data ?? []).filter(
      (assignment) => assignment.status === "active",
    );
    const mentorProfileIds = Array.from(
      new Set(
        activeMentorAssignments
          .map((assignment) => assignment.mentor_profile_id)
          .filter((mentorProfileId): mentorProfileId is string =>
            Boolean(mentorProfileId),
          ),
      ),
    );
    const mentorProfilesResult =
      mentorProfileIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name")
            .eq("organization_id", profile.organization_id)
            .in("id", mentorProfileIds)
        : { data: [], error: null };

    if (mentorProfilesResult.error) {
      throw new ApiRouteError(mentorProfilesResult.error.message, 500);
    }

    const validMentorProfileIds = new Set(
      (mentorProfilesResult.data ?? []).map((mentorProfile) => mentorProfile.id),
    );
    const mentorNameById = new Map(
      (mentorProfilesResult.data ?? []).map((mentorProfile) => [
        mentorProfile.id,
        mentorProfile.full_name ?? "",
      ]),
    );
    const selectedMentorAssignment = choosePreferredMentorAssignment({
      activeAssignments: activeMentorAssignments,
      currentProfileId: profile.id,
      requestedMentorProfileId: payload.mentorProfileId,
      validMentorProfileIds,
    });

    if (!selectedMentorAssignment?.mentor_profile_id) {
      throw new ApiRouteError(
        "Assign a mentor to this candidate-role track before choosing a project.",
        409,
      );
    }

    const mentoringTrackMentorProfileId = selectedMentorAssignment.mentor_profile_id;
    let developmentProjectId = existingProjectResult.data?.id ?? null;
    const projectDescription = buildCandidateSpecificProjectDescription(payload.idea);

    if (!developmentProjectId) {
      const insertProjectResult = await admin
        .from("development_projects")
        .insert({
          organization_id: profile.organization_id,
          title: payload.idea.title,
          description: projectDescription,
          difficulty: "intermediate",
          duration_days: payload.idea.duration_days,
          applicable_roles: [roleTitle],
          competencies_developed: [competencyResult.data.name],
          strengths_leveraged: [],
          expected_outcomes: payload.idea.success_measures,
          mentor_questions: payload.idea.reflection_questions,
          evidence_of_success: payload.idea.success_signals,
        })
        .select("id")
        .single();

      if (insertProjectResult.error) {
        throw new ApiRouteError(insertProjectResult.error.message, 500);
      }

      developmentProjectId = insertProjectResult.data.id;
    }

    const matchingAssignmentsResult = await admin
      .from("candidate_project_assignments")
      .select("id, mentor_profile_id, status, start_date, due_date, created_at")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("development_project_id", developmentProjectId)
      .eq("mentor_profile_id", mentoringTrackMentorProfileId)
      .order("created_at", { ascending: false });

    if (matchingAssignmentsResult.error) {
      throw new ApiRouteError(matchingAssignmentsResult.error.message, 500);
    }

    const reusableMatchingAssignment =
      (matchingAssignmentsResult.data ?? []).find(
        (assignment) => assignment.status !== "completed",
      ) ?? null;

    const unscopedAssignmentsResult = reusableMatchingAssignment
      ? { data: [], error: null }
      : await admin
          .from("candidate_project_assignments")
          .select("id, status, start_date, due_date, created_at")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", payload.candidateId)
          .eq("development_project_id", developmentProjectId)
          .is("mentor_profile_id", null)
          .order("created_at", { ascending: false });

    if (unscopedAssignmentsResult.error) {
      throw new ApiRouteError(unscopedAssignmentsResult.error.message, 500);
    }

    const reusableUnscopedAssignment =
      (unscopedAssignmentsResult.data ?? []).find(
        (assignment) => assignment.status !== "completed",
      ) ?? null;

    const assignmentNotes = buildMentoringProjectAssignmentNotes({
      roleTitle,
      competencyName: competencyResult.data.name,
    });
    let candidateProjectAssignmentId =
      reusableMatchingAssignment?.id ?? reusableUnscopedAssignment?.id ?? null;
    let assignmentStartDate =
      reusableMatchingAssignment?.start_date ?? reusableUnscopedAssignment?.start_date ?? null;
    let assignmentDueDate =
      reusableMatchingAssignment?.due_date ?? reusableUnscopedAssignment?.due_date ?? null;

    if (reusableUnscopedAssignment) {
      const updateAssignmentResult = await admin
        .from("candidate_project_assignments")
        .update({
          mentor_profile_id: mentoringTrackMentorProfileId,
          mentor_notes: assignmentNotes,
          status: "assigned",
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", reusableUnscopedAssignment.id)
        .select("id, start_date, due_date")
        .single();

      if (updateAssignmentResult.error) {
        throw new ApiRouteError(updateAssignmentResult.error.message, 500);
      }

      candidateProjectAssignmentId = updateAssignmentResult.data.id;
      assignmentStartDate = updateAssignmentResult.data.start_date;
      assignmentDueDate = updateAssignmentResult.data.due_date;
    } else if (!reusableMatchingAssignment) {
      const today = new Date();
      const dueDate = addDays(today, payload.idea.duration_days);
      const assignmentResult = await admin
        .from("candidate_project_assignments")
        .insert({
          organization_id: profile.organization_id,
          candidate_id: payload.candidateId,
          mentor_profile_id: mentoringTrackMentorProfileId,
          development_project_id: developmentProjectId,
          status: "assigned",
          start_date: toIsoDate(today),
          due_date: toIsoDate(dueDate),
          mentor_notes: assignmentNotes,
        })
        .select("id, start_date, due_date")
        .single();

      if (assignmentResult.error) {
        throw new ApiRouteError(assignmentResult.error.message, 500);
      }

      candidateProjectAssignmentId = assignmentResult.data.id;
      assignmentStartDate = assignmentResult.data.start_date;
      assignmentDueDate = assignmentResult.data.due_date;
    } else {
      const updateAssignmentResult = await admin
        .from("candidate_project_assignments")
        .update({
          mentor_notes: assignmentNotes,
          status:
            reusableMatchingAssignment.status === "completed"
              ? "assigned"
              : reusableMatchingAssignment.status,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", reusableMatchingAssignment.id)
        .select("id, start_date, due_date")
        .single();

      if (updateAssignmentResult.error) {
        throw new ApiRouteError(updateAssignmentResult.error.message, 500);
      }

      assignmentStartDate = updateAssignmentResult.data.start_date;
      assignmentDueDate = updateAssignmentResult.data.due_date;
    }

    const selectedProject = buildMentoringSourceProject({
      id: candidateProjectAssignmentId ?? developmentProjectId,
      projectId: developmentProjectId,
      title: payload.idea.title,
      description: projectDescription,
      durationDays: payload.idea.duration_days,
      competencyNames: [competencyResult.data.name],
      applicableRoles: [roleTitle],
      successMeasures: payload.idea.success_measures,
      reflectionQuestions: payload.idea.reflection_questions,
      successSignals: payload.idea.success_signals,
      startDate: assignmentStartDate,
      dueDate: assignmentDueDate,
      status: "assigned",
      mentorNotes: assignmentNotes,
    });
    const selectedProjectDraft = buildLeadershipDevelopmentRecordFromProject({
      assignment: {
        candidateId: payload.candidateId,
        roleId: payload.roleId,
        mentorProfileId: mentoringTrackMentorProfileId,
        candidateName: candidateResult.data.full_name,
        roleTitle,
        mentorName: mentorNameById.get(mentoringTrackMentorProfileId) ?? "Unknown mentor",
        startDate: assignmentStartDate,
      },
      project: selectedProject,
    });
    const timestamp = new Date().toISOString();
    const existingDraftRecordResult = await admin
      .from("development_records")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("role_id", payload.roleId)
      .eq("mentor_id", mentoringTrackMentorProfileId)
      .eq("experience_title", selectedProjectDraft.experienceTitle)
      .in("status", ["assigned", "in_progress", "ready_for_review"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingDraftRecordResult.error) {
      throw new ApiRouteError(existingDraftRecordResult.error.message, 500);
    }

    const baseRecord = {
      organization_id: profile.organization_id,
      candidate_id: payload.candidateId,
      role_id: payload.roleId,
      mentor_id: mentoringTrackMentorProfileId,
      target_role: roleTitle,
      date_assigned: selectedProjectDraft.dateAssigned,
      status: "assigned",
      growth_areas: selectedProjectDraft.growthAreas,
      assignment_reason: selectedProjectDraft.assignmentReason || null,
      experience_title: selectedProjectDraft.experienceTitle,
      mentee_task: selectedProjectDraft.menteeTask || null,
      readiness_signal: null,
      mentor_improvement_observed: null,
      mentor_development_needed: null,
      next_recommended_experience: null,
      mentor_review_date: null,
      average_feedback_score: null,
      created_by_profile_id: profile.id,
      updated_at: timestamp,
    };
    const existingDraftRecordId = existingDraftRecordResult.data?.[0]?.id ?? null;
    const draftRecordResult = existingDraftRecordId
      ? await admin
          .from("development_records")
          .update(baseRecord)
          .eq("organization_id", profile.organization_id)
          .eq("id", existingDraftRecordId)
          .select("id")
          .single()
      : await admin
          .from("development_records")
          .insert({
            ...baseRecord,
            created_at: timestamp,
          })
          .select("id")
          .single();

    if (draftRecordResult.error) {
      throw new ApiRouteError(draftRecordResult.error.message, 500);
    }

    const draftRecordId = draftRecordResult.data.id;

    const deleteExistingLeadersResult = await admin
      .from("development_record_leaders")
      .delete()
      .eq("development_record_id", draftRecordId);

    if (deleteExistingLeadersResult.error) {
      throw new ApiRouteError(deleteExistingLeadersResult.error.message, 500);
    }

    const filteredLeaderEngagements = selectedProjectDraft.leaderEngagements.filter(
      (leader) => leader.leaderName.trim().length > 0,
    );

    if (filteredLeaderEngagements.length > 0) {
      const insertLeadersResult = await admin
        .from("development_record_leaders")
        .insert(
          filteredLeaderEngagements.map((leader) => ({
            development_record_id: draftRecordId,
            leader_name: leader.leaderName,
            department: leader.department || null,
            purpose: leader.purpose || null,
            meeting_completed: leader.meetingCompleted,
            created_at: timestamp,
            updated_at: timestamp,
          })),
        );

      if (insertLeadersResult.error) {
        throw new ApiRouteError(insertLeadersResult.error.message, 500);
      }
    }

    const updateSavedIdeaSetResult = await admin
      .from("candidate_generated_mentoring_idea_sets")
      .update({
        selected_idea_title: payload.idea.title,
        selected_project_assignment_id: candidateProjectAssignmentId,
        selected_development_record_id: draftRecordId,
      })
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("role_id", payload.roleId)
      .eq("competency_id", payload.competencyId);

    if (
      updateSavedIdeaSetResult.error &&
      !isMissingCandidateGeneratedMentoringIdeaSetTableError(
        updateSavedIdeaSetResult.error,
      )
    ) {
      throw new ApiRouteError(updateSavedIdeaSetResult.error.message, 500);
    }

    return NextResponse.json({
      message: `"${payload.idea.title}" has been chosen for ${candidateResult.data.full_name}.`,
      navigation: {
        href: `/mentoring?section=leadership-development-record&candidateId=${payload.candidateId}&roleId=${payload.roleId}&mentorProfileId=${mentoringTrackMentorProfileId}&projectId=${candidateProjectAssignmentId ?? developmentProjectId}&recordId=${draftRecordId}`,
      },
      projectAssignmentId: candidateProjectAssignmentId,
      recordId: draftRecordId,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to choose this mentoring project.");
  }
}
