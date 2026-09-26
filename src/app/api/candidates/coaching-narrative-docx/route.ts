import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";
import { isAdminAppRole, mentorHasCandidateAccess } from "@/lib/mentor-access";
import { saveMentoringDocument } from "@/lib/mentoring-documents";

const schema = z.object({
  candidateId: z.string().uuid(), roleId: z.string().uuid(), competencyId: z.string().uuid(),
  narrative: z.object({ progress_over_time: z.string(), strengths_application: z.string(), mentor_guidance: z.string(), suggested_projects: z.array(z.string()), coaching_checkpoints: z.array(z.string()) }),
});

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "coaching-narrative"; }

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile();
    const payload = schema.parse(await request.json());
    const [candidate, role, competency, assignments] = await Promise.all([
      admin.from("candidates").select("id,full_name").eq("organization_id", profile.organization_id).eq("id", payload.candidateId).maybeSingle(),
      admin.from("roles").select("id,title").eq("organization_id", profile.organization_id).eq("id", payload.roleId).maybeSingle(),
      admin.from("role_competencies").select("id,name").eq("organization_id", profile.organization_id).eq("id", payload.competencyId).maybeSingle(),
      admin.from("mentor_role_assignments").select("candidate_id,role_id,mentor_profile_id,status").eq("organization_id", profile.organization_id).eq("candidate_id", payload.candidateId).eq("role_id", payload.roleId),
    ]);
    if (candidate.error || role.error || competency.error || assignments.error) throw new ApiRouteError(candidate.error?.message ?? role.error?.message ?? competency.error?.message ?? assignments.error?.message ?? "Unable to load context.", 500);
    if (!candidate.data || !role.data || !competency.data) throw new ApiRouteError("Candidate, role, or competency not found.", 404);
    if (!isAdminAppRole(profile.role) && !mentorHasCandidateAccess({ profileId: profile.id, candidateId: payload.candidateId, roleId: payload.roleId, mentorAssignments: assignments.data ?? [] })) throw new ApiRouteError("You do not have access to this candidate.", 403);
    const sections = [
      ["Progress Over Time", payload.narrative.progress_over_time],
      ["Using Strengths To Close The Gap", payload.narrative.strengths_application],
      ["Mentor Coaching Guidance", payload.narrative.mentor_guidance],
      ["Suggested Stretch Projects", payload.narrative.suggested_projects.join("\n")],
      ["Coaching Checkpoints", payload.narrative.coaching_checkpoints.join("\n")],
    ];
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: `${competency.data.name} — Coaching Narrative`, heading: HeadingLevel.TITLE }), new Paragraph({ text: `Candidate: ${candidate.data.full_name}\nRole: ${role.data.title}` }), ...sections.flatMap(([title, text]) => [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun(text)] })])] }] }));
    const fileName = `${slug(candidate.data.full_name)}-${slug(competency.data.name)}-coaching-narrative.docx`;
    const documentId = await saveMentoringDocument({ admin, organizationId: profile.organization_id, candidateId: payload.candidateId, roleId: payload.roleId, profileId: profile.id, title: `${competency.data.name} — Coaching Narrative`, fileName, buffer });
    return new NextResponse(new Uint8Array(buffer), { headers: { "X-Mentoring-Document-Id": documentId, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return createApiErrorResponse(error, "Unable to generate the coaching narrative document."); }
}
