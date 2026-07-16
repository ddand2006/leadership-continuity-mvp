import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  buildRoleCompositeDocumentStoragePath,
  getRoleCompositeDocumentsBucket,
} from "@/lib/role-composite-documents";
import {
  buildRoleCompositeDocumentBuffer,
  generateRoleCompositeDocumentContent,
} from "@/lib/role-composite-document";
import { generateRoleCompositeFromIdealCompetencies } from "@/lib/role-composite";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const payloadSchema = z.object({
  roleId: z.string().uuid(),
});

function createSafeFileName(title: string) {
  return title
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = payloadSchema.parse(await request.json());

    const [
      organizationResult,
      roleResult,
      idealCompetenciesResult,
      existingCompetenciesResult,
      existingDocumentResult,
    ] = await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .single(),
      admin
        .from("roles")
        .select("id, title, department, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", payload.roleId)
        .maybeSingle(),
      admin
        .from("role_candidate_characteristics")
        .select("category, characteristic, sort_order")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("role_competencies")
        .select(
          "id, name, definition, target_score, weight, behavioral_indicators, red_flags",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .order("created_at", { ascending: true }),
      admin
        .from("role_composite_documents")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", payload.roleId)
        .maybeSingle(),
    ]);

    for (const result of [
      organizationResult,
      roleResult,
      idealCompetenciesResult,
      existingCompetenciesResult,
      existingDocumentResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const roleTitle = canonicalizeRoleTitle(roleResult.data.title);

    if (existingDocumentResult.data) {
      throw new ApiRouteError(
        "A role composite document already exists for this role. Download it, edit it in Word, and upload corrections manually instead of regenerating.",
        409,
      );
    }

    const idealCompetencies = groupCharacteristicsByCategory(
      idealCompetenciesResult.data ?? [],
    );
    const idealCompetencyCount =
      idealCompetencies.talents.length +
      idealCompetencies.skills.length +
      idealCompetencies.behaviors.length;

    if (idealCompetencyCount === 0) {
      throw new ApiRouteError(
        "Upload ideal candidate competencies before generating a role composite.",
        400,
      );
    }

    let roleCompetencies = existingCompetenciesResult.data ?? [];

    if (roleCompetencies.length === 0) {
      const generatedComposite = await generateRoleCompositeFromIdealCompetencies({
        title: roleTitle,
        department: roleResult.data.department,
        description: roleResult.data.description,
        talents: idealCompetencies.talents,
        skills: idealCompetencies.skills,
        behaviors: idealCompetencies.behaviors,
      });

      const insertCompetenciesResult = await admin
        .from("role_competencies")
        .insert(
          generatedComposite.competencies.map((competency, index) => ({
            organization_id: profile.organization_id,
            role_id: payload.roleId,
            created_at: new Date(Date.now() + index * 1000).toISOString(),
            ...competency,
          })),
        )
        .select(
          "id, name, definition, target_score, weight, behavioral_indicators, red_flags",
        );

      if (insertCompetenciesResult.error) {
        throw new ApiRouteError(insertCompetenciesResult.error.message, 500);
      }

      roleCompetencies = insertCompetenciesResult.data ?? [];
    }

    const organizationName =
      organizationResult.data?.name ?? "Organization";
    const documentContent = await generateRoleCompositeDocumentContent({
      organizationName,
      roleTitle,
      roleDepartment: roleResult.data.department,
      roleDescription: roleResult.data.description,
      idealCompetencies,
      roleCompetencies: roleCompetencies.map((competency) => ({
        name: competency.name,
        definition: competency.definition,
        target_score: competency.target_score,
        weight: competency.weight,
        behavioral_indicators: competency.behavioral_indicators as string[],
        red_flags: competency.red_flags as string[],
      })),
    });

    const buffer = await buildRoleCompositeDocumentBuffer({
      organizationName,
      roleTitle,
      content: documentContent,
    });

    const bucket = getRoleCompositeDocumentsBucket();
    const fileName = `${createSafeFileName(roleTitle)}-role-composite.docx`;
    const storagePath = buildRoleCompositeDocumentStoragePath({
      organizationId: profile.organization_id,
      roleId: payload.roleId,
      fileName,
    });

    const uploadResult = await admin.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ApiRouteError(uploadResult.error.message, 500);
    }

    const insertDocumentResult = await admin
      .from("role_composite_documents")
      .insert({
        organization_id: profile.organization_id,
        role_id: payload.roleId,
        created_by_profile_id: profile.id,
        document_source: "generated",
        file_name: fileName,
        file_extension: "docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size_bytes: buffer.length,
        storage_bucket: bucket,
        storage_path: storagePath,
      });

    if (insertDocumentResult.error) {
      await admin.storage.from(bucket).remove([storagePath]);
      throw new ApiRouteError(insertDocumentResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Role composite created for "${roleTitle}". Download the Word file, make any edits manually, and upload the corrected version if needed.`,
      roleId: payload.roleId,
      competenciesCreated: roleCompetencies.length,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected generated role composite failure.",
    );
  }
}
