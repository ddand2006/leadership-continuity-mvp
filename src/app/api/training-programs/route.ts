import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";

const programSchema = z.object({
  id: z.string().uuid().optional(),
  providerName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  deliveryFormats: z.array(z.string().trim().min(1)).default([]),
  audienceLevels: z.array(z.string().trim().min(1)).default([]),
  typicalDuration: z.string().trim().optional(),
  internalNotes: z.string().trim().optional(),
  matches: z.array(z.object({
    competencyName: z.string().trim().min(1),
    strength: z.enum(["strong", "moderate", "supporting"]),
    explanation: z.string().trim().min(1),
  })).min(1),
});

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const payload = programSchema.parse(await request.json());
    const providerResult = await admin.from("training_providers").upsert({
      organization_id: profile.organization_id, name: payload.providerName,
    }, { onConflict: "organization_id,name" }).select("id").single();
    if (providerResult.error) throw new ApiRouteError(providerResult.error.message, 500);

    const programResult = payload.id
      ? await admin.from("training_programs").update({ provider_id: providerResult.data.id, name: payload.name, description: payload.description, website_url: payload.websiteUrl || null, delivery_formats: payload.deliveryFormats, audience_levels: payload.audienceLevels, typical_duration: payload.typicalDuration || null, internal_notes: payload.internalNotes || null }).eq("organization_id", profile.organization_id).eq("id", payload.id).select("id").single()
      : await admin.from("training_programs").insert({ organization_id: profile.organization_id, provider_id: providerResult.data.id, name: payload.name, description: payload.description, website_url: payload.websiteUrl || null, delivery_formats: payload.deliveryFormats, audience_levels: payload.audienceLevels, typical_duration: payload.typicalDuration || null, internal_notes: payload.internalNotes || null }).select("id").single();
    if (programResult.error) throw new ApiRouteError(programResult.error.message, 500);
    const programId = programResult.data.id;
    const removeResult = await admin.from("training_program_competencies").delete().eq("organization_id", profile.organization_id).eq("training_program_id", programId);
    if (removeResult.error) throw new ApiRouteError(removeResult.error.message, 500);
    const matchesResult = await admin.from("training_program_competencies").insert(payload.matches.map((match) => ({ organization_id: profile.organization_id, training_program_id: programId, competency_name: match.competencyName, match_strength: match.strength, relationship_type: "primary", match_explanation: match.explanation })));
    if (matchesResult.error) throw new ApiRouteError(matchesResult.error.message, 500);
    return NextResponse.json({ message: payload.id ? "Training program updated." : "Training program added." });
  } catch (error) { return createApiErrorResponse(error, "Unable to save training program."); }
}

export async function DELETE(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const result = await admin.from("training_programs").delete().eq("organization_id", profile.organization_id).eq("id", id);
    if (result.error) throw new ApiRouteError(result.error.message, 500);
    return NextResponse.json({ message: "Training program removed." });
  } catch (error) { return createApiErrorResponse(error, "Unable to remove training program."); }
}
