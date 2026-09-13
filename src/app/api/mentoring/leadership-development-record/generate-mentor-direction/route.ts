import { buildMentorDirectionDocumentBuffer } from "@/lib/mentor-direction-document";
import { saveMentoringDocument } from "@/lib/mentoring-documents";
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
  action: z.enum(["generate", "save_document"]).default("generate"),
  mentorDirectionNarrative: z.string().trim().max(3000).default(""),
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
  growthAreas: z.array(z.string().trim().min(1).max(100)).max(9),
  selectedStrengths: z
    .array(
      z.object({
        themeName: z.string().trim().min(1).max(100),
        rank: z.number().int().min(1).max(34),
        domain: z.string().trim().min(1).max(100),
        helpDescription: z.string().trim().min(1).max(1000),
      }),
    )
    .max(34),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const payload = payloadSchema.parse(await request.json());
    if (payload.action === "generate" && !hasOpenAIEnv()) {
      throw new ApiRouteError(
        "Add OPENAI_API_KEY before generating mentor direction.",
        400,
      );
    }

    if (payload.action === "generate" && (!payload.growthAreas.length || !payload.selectedStrengths.length)) throw new ApiRouteError("Select a growth area and strength before generating mentor direction.", 400);
    if (payload.action === "save_document" && !payload.mentorDirectionNarrative) throw new ApiRouteError("Generate mentor direction before saving a Word document.", 400);

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

    const narrative = payload.action === "save_document" ? payload.mentorDirectionNarrative : await generateDevelopmentRecordMentorDirection({
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

    try {
      const buffer = await buildMentorDirectionDocumentBuffer({
        candidateName: payload.candidateName, targetRole: payload.targetRole, mentorName: payload.primaryMentor,
        projectTitle: payload.experienceTitle || payload.menteeTask, narrative,
      });
      const slug = `${payload.candidateName}-${payload.experienceTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
      const documentId = await saveMentoringDocument({ admin, organizationId: profile.organization_id,
        candidateId: payload.candidateId, roleId: payload.roleId, profileId: profile.id,
        title: `${payload.experienceTitle || "Development project"} — Mentor direction`, fileName: `${slug || "project"}-mentor-direction.docx`, buffer,
      });
      return NextResponse.json({ narrative, documentId });
    } catch (error) {
      return NextResponse.json({ narrative, documentError: error instanceof Error ? error.message : "Unable to save the Word document." });
    }
  } catch (error) {
    return createApiErrorResponse(error, "Unable to generate mentor direction.");
  }
}
