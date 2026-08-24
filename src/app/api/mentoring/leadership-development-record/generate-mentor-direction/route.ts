import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { generateDevelopmentRecordMentorDirection } from "@/lib/development-record-mentor-direction";
import { hasOpenAIEnv } from "@/lib/env";
import { isAdminAppRole, isCandidateSelfAccess } from "@/lib/mentor-access";

const payloadSchema = z.object({
  candidateId: z.string().uuid(),
  roleId: z.string().uuid(),
  mentorId: z.string().uuid(),
  candidateName: z.string().trim().min(1).max(200),
  targetRole: z.string().trim().min(1).max(200),
  primaryMentor: z.string().trim().min(1).max(200),
  experienceTitle: z.string().trim().max(300),
  menteeTask: z.string().trim().max(1500),
  projectSummary: z.string().trim().max(3000),
  projectPurpose: z.string().trim().max(1500),
  workingGoal: z.string().trim().max(1500),
  whyItFits: z.string().trim().max(2000),
  mentorFocus: z.string().trim().max(2000),
  firstStep: z.string().trim().max(1500),
  leadershipActionsRequired: z.array(z.string().trim().min(1).max(300)).max(30),
  successMeasures: z.array(z.string().trim().min(1).max(300)).max(30),
  growthAreas: z.array(z.string().trim().min(1).max(100)).min(1).max(9),
  selectedStrengths: z
    .array(
      z.object({
        themeName: z.string().trim().min(1).max(100),
        rank: z.number().int().min(1).max(34),
        domain: z.string().trim().min(1).max(100),
        helpDescription: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(34),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY before generating mentor direction.",
        400,
      );
    }

    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());

    const assignmentResult = await admin
      .from("mentor_role_assignments")
      .select("candidate_id")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", payload.candidateId)
      .eq("role_id", payload.roleId)
      .eq("mentor_profile_id", payload.mentorId)
      .eq("status", "active")
      .maybeSingle();

    if (assignmentResult.error) {
      throw new ApiRouteError(assignmentResult.error.message, 500);
    }
    if (!assignmentResult.data) {
      throw new ApiRouteError(
        "This project must be tied to an active mentor assignment.",
        404,
      );
    }

    const isAssignedMentor =
      profile.role === "mentor" && profile.id === payload.mentorId;
    if (
      !isAdminAppRole(profile.role) &&
      !isAssignedMentor &&
      !isCandidateSelfAccess(account, payload.candidateId)
    ) {
      throw new ApiRouteError(
        "You do not have access to generate mentor direction for this project.",
        403,
      );
    }

    const narrative = await generateDevelopmentRecordMentorDirection({
      candidateName: payload.candidateName,
      targetRole: payload.targetRole,
      mentorName: payload.primaryMentor,
      experienceTitle: payload.experienceTitle,
      menteeTask: payload.menteeTask,
      projectSummary: payload.projectSummary,
      projectPurpose: payload.projectPurpose,
      workingGoal: payload.workingGoal,
      whyItFits: payload.whyItFits,
      mentorFocus: payload.mentorFocus,
      firstStep: payload.firstStep,
      leadershipActionsRequired: payload.leadershipActionsRequired,
      successMeasures: payload.successMeasures,
      growthAreas: payload.growthAreas,
      selectedStrengths: payload.selectedStrengths,
    });

    return NextResponse.json({ narrative });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to generate mentor direction.");
  }
}
