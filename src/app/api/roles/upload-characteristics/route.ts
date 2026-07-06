import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { assertAcceptedFileType } from "@/lib/file-parsers";
import { parseRoleCharacteristicsWorkbook } from "@/lib/role-candidate-characteristics";
import { syncRoleCharacteristicLibrary } from "@/lib/role-characteristic-library";
import { normalizeRoleCandidateCharacteristics } from "@/lib/role-characteristics-normalizer";

export const runtime = "nodejs";

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

    const parsedCharacteristics = await parseRoleCharacteristicsWorkbook(
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
