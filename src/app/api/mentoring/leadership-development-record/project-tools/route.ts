import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";
import { hasOpenAIEnv } from "@/lib/env";
import { isAdminAppRole, isCandidateSelfAccess } from "@/lib/mentor-access";
import { expandManualDevelopmentProject, generateMenteeWorksheet } from "@/lib/development-record-project-tools";

const payloadSchema = z.object({
  action: z.enum(["expand_project", "generate_worksheet"]), candidateId: z.string().uuid(), roleId: z.string().uuid(), mentorId: z.string().uuid(),
  candidateName: z.string().trim().min(1), targetRole: z.string().trim().min(1), primaryMentor: z.string().trim().min(1),
  experienceTitle: z.string().trim().max(300), menteeTask: z.string().trim().max(1500), projectSummary: z.string().trim().max(3000),
  projectPurpose: z.string().trim().max(1500), workingGoal: z.string().trim().max(1500), whyItFits: z.string().trim().max(2000), mentorFocus: z.string().trim().max(2000), firstStep: z.string().trim().max(1500),
  growthAreas: z.array(z.string().trim()), selectedStrengths: z.array(z.object({ themeName: z.string(), helpDescription: z.string() })),
  leadershipActionsRequired: z.array(z.string()), successMeasures: z.array(z.string()), reflectionQuestions: z.array(z.string()),
});
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!hasOpenAIEnv()) throw new ApiRouteError("Add OPENAI_API_KEY before generating project tools.", 400);
    const { account, admin, profile } = await requireApiWorkspaceProfile(); const payload = payloadSchema.parse(await request.json());
    const assignment = await admin.from("mentor_role_assignments").select("candidate_id").eq("organization_id", profile.organization_id).eq("candidate_id", payload.candidateId).eq("role_id", payload.roleId).eq("mentor_profile_id", payload.mentorId).eq("status", "active").maybeSingle();
    if (assignment.error) throw new ApiRouteError(assignment.error.message, 500);
    if (!assignment.data) throw new ApiRouteError("This project requires an active mentor assignment.", 404);
    if (!isAdminAppRole(profile.role) && !(profile.role === "mentor" && profile.id === payload.mentorId) && !isCandidateSelfAccess(account, payload.candidateId)) throw new ApiRouteError("You do not have access to this project.", 403);
    const context = { candidate: payload.candidateName, targetRole: payload.targetRole, mentor: payload.primaryMentor, project: payload, growthAreas: payload.growthAreas, strengths: payload.selectedStrengths };
    const result = payload.action === "expand_project" ? await expandManualDevelopmentProject(context) : await generateMenteeWorksheet(context);
    return NextResponse.json({ result });
  } catch (error) { return createApiErrorResponse(error, "Unable to generate this project tool."); }
}
