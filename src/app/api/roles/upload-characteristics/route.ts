import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { syncRoleCharacteristicLibrary } from "@/lib/role-characteristic-library";
import { normalizeRoleCandidateCharacteristics } from "@/lib/role-characteristics-normalizer";

export const runtime = "nodejs";
const MAX_COMPETENCY_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments.at(-1) ?? "" : "";
}

function assertAcceptedFileType(file: File, allowedExtensions: string[]) {
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    throw new ApiRouteError("Unsupported file type. Use CSV or XLSX.", 400);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const formData = await request.formData();
    const file = formData.get("file");
    const roleIdValue = formData.get("roleId");
    const roleId = typeof roleIdValue === "string" && roleIdValue ? roleIdValue : null;

    if (!roleId) {
      throw new ApiRouteError("Select a role first.", 400);
    }

    if (!(file instanceof File)) {
      throw new ApiRouteError("Upload a CSV or XLSX competency file first.", 400);
    }

    if (file.size === 0) {
      throw new ApiRouteError("Uploaded file is empty.", 400);
    }

    if (file.size > MAX_COMPETENCY_UPLOAD_SIZE_BYTES) {
      throw new ApiRouteError("Uploaded file must be 50 MB or smaller.", 400);
    }

    assertAcceptedFileType(file, ["csv", "xlsx", "xls"]);

    const roleResult = await admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", profile.organization_id)
      .eq("id", roleId)
      .maybeSingle();

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    const parserModule = await import("@/lib/role-candidate-characteristics").catch(
      () => null,
    );

    if (!parserModule?.parseRoleCharacteristicsWorkbook) {
      throw new ApiRouteError(
        "The server could not load the spreadsheet upload parser. Please try saving the file as CSV and upload it again.",
        500,
      );
    }

    const parsedCharacteristics = await parserModule.parseRoleCharacteristicsWorkbook(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    );
    const characteristics = await normalizeRoleCandidateCharacteristics(
      parsedCharacteristics,
    );

    await syncRoleCharacteristicLibrary({
      admin,
      organizationId: profile.organization_id,
      items: characteristics,
    });

    const deleteResult = await admin
      .from("role_candidate_characteristics")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId);

    if (deleteResult.error) {
      throw new ApiRouteError(deleteResult.error.message, 500);
    }

    const insertResult = await admin
      .from("role_candidate_characteristics")
      .insert(
        characteristics.map((item) => ({
          organization_id: profile.organization_id,
          role_id: roleId,
          category: item.category,
          characteristic: item.characteristic,
          sort_order: item.sort_order,
        })),
      );

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Imported ${characteristics.length} ideal-candidate competencies into "${roleResult.data.title}".`,
      roleId,
      count: characteristics.length,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected role competencies upload failure.",
    );
  }
}
