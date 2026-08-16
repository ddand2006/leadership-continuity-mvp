import { NextResponse } from "next/server";
import { z } from "zod";
import { createRolePrintableCompetencySignature } from "@/lib/role-printable-signature";
import { createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";

type Context = { params: Promise<{ roleId: string }> };
const schema = z.object({ documentType: z.enum(["role_composite", "condensed_profile", "printable_narrative", "interview_scorecard"]) });

export async function POST(request: Request, context: Context) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const { roleId } = await context.params;
    const { documentType } = schema.parse(await request.json());
    const competencies = await admin.from("role_competencies").select("name,definition,weight,target_score,behavioral_indicators,red_flags").eq("organization_id", profile.organization_id).eq("role_id", roleId).order("created_at");
    if (competencies.error) throw competencies.error;
    const saved = await admin.from("role_printable_generations").upsert({ organization_id: profile.organization_id, role_id: roleId, document_type: documentType, competency_signature: createRolePrintableCompetencySignature(competencies.data ?? []), generated_at: new Date().toISOString(), generated_by_profile_id: profile.id }, { onConflict: "role_id,document_type" });
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true });
  } catch (error) { return createApiErrorResponse(error, "Unable to record the printable document generation."); }
}
