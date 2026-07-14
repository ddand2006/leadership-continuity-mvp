import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { groupCharacteristicsByCategory } from "@/lib/role-characteristics";
import {
  extractRoleCompositeDocumentText,
  splitRoleCompositeNarrative,
} from "@/lib/role-composite-documents";
import {
  buildPrintableRoleNarrativeDocumentBuffer,
  resolvePrintableRoleNarrative,
} from "@/lib/role-printable-narrative";

type RouteContext = {
  params: Promise<{
    roleId: string;
  }>;
};

function createSafeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { roleId } = await context.params;

    const [
      organizationResult,
      roleResult,
      characteristicsResult,
      competenciesResult,
      compositeDocumentResult,
      assignmentsResult,
      mentorsResult,
    ] = await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .maybeSingle(),
      admin
        .from("roles")
        .select("id, title, department, description, status")
        .eq("organization_id", profile.organization_id)
        .eq("id", roleId)
        .maybeSingle(),
      admin
        .from("role_candidate_characteristics")
        .select("category, characteristic, sort_order")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("role_competencies")
        .select(
          "name, definition, weight, target_score, behavioral_indicators, red_flags",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .order("created_at", { ascending: true }),
      admin
        .from("role_composite_documents")
        .select("file_name, storage_bucket, storage_path")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .maybeSingle(),
      admin
        .from("role_mentor_assignments")
        .select("mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId),
      admin
        .from("profiles")
        .select("id, full_name, position_title")
        .eq("organization_id", profile.organization_id)
        .eq("role", "mentor"),
    ]);

    for (const result of [
      organizationResult,
      roleResult,
      characteristicsResult,
      competenciesResult,
      compositeDocumentResult,
      assignmentsResult,
      mentorsResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    let compositeNarrativeParagraphs: string[] = [];

    if (compositeDocumentResult.data?.storage_bucket && compositeDocumentResult.data.storage_path) {
      const storageResult = await admin.storage
        .from(compositeDocumentResult.data.storage_bucket)
        .download(compositeDocumentResult.data.storage_path);

      if (!storageResult.error) {
        const compositeBuffer = Buffer.from(await storageResult.data.arrayBuffer());
        const extractedCompositeText = await extractRoleCompositeDocumentText({
          buffer: compositeBuffer,
          fileName: compositeDocumentResult.data.file_name ?? "role-composite.docx",
        });
        compositeNarrativeParagraphs = splitRoleCompositeNarrative(
          extractedCompositeText,
        );
      } else {
        console.error("Unable to load stored role composite document for printable narrative export", {
          roleId,
          storagePath: compositeDocumentResult.data.storage_path,
          error: storageResult.error,
        });
      }
    }

    const mentorMap = new Map(
      (mentorsResult.data ?? []).map((mentor) => [mentor.id, mentor]),
    );
    const assignedMentors = Array.from(
      new Set(
        (assignmentsResult.data ?? [])
          .filter((assignment) => assignment.status === "active")
          .flatMap((assignment) => {
            const mentor = mentorMap.get(assignment.mentor_profile_id);

            if (!mentor) {
              return [];
            }

            return [
              mentor.position_title
                ? `${mentor.full_name} • ${mentor.position_title}`
                : mentor.full_name,
            ];
          }),
      ),
    );

    const narrative = resolvePrintableRoleNarrative({
      roleTitle: roleResult.data.title,
      roleDepartment: roleResult.data.department,
      roleDescription: roleResult.data.description,
      roleStatus: roleResult.data.status,
      assignedMentors,
      idealCompetencies: groupCharacteristicsByCategory(
        characteristicsResult.data ?? [],
      ),
      roleCompetencies: (competenciesResult.data ?? []).map((competency) => ({
        name: competency.name,
        definition: competency.definition ?? "",
        target_score: competency.target_score,
        weight: competency.weight,
        behavioral_indicators:
          (competency.behavioral_indicators as string[] | null) ?? [],
        red_flags: (competency.red_flags as string[] | null) ?? [],
      })),
      compositeNarrativeParagraphs,
    });

    const buffer = await buildPrintableRoleNarrativeDocumentBuffer({
      organizationName: organizationResult.data?.name ?? "Organization",
      narrative,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${createSafeFileName(roleResult.data.title)}-printable-role-narrative.docx"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to generate the printable role narrative Word document.",
    );
  }
}
