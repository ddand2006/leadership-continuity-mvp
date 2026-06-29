import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { assertAcceptedFileType, extractTextFromUploadedFile } from "@/lib/file-parsers";
import { extractRoleCompositeFromText } from "@/lib/role-composite";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const formData = await request.formData();
    const file = formData.get("file");
    const roleIdValue = formData.get("roleId");
    const statusValue = formData.get("status");
    const roleId = typeof roleIdValue === "string" && roleIdValue ? roleIdValue : null;
    const status =
      statusValue === "active" || statusValue === "draft" ? statusValue : "active";

    if (!(file instanceof File)) {
      throw new ApiRouteError("Upload a composite file first.", 400);
    }

    assertAcceptedFileType(file, ["pdf", "docx", "txt"]);

    const compositeText = await extractTextFromUploadedFile(file, ["pdf", "docx", "txt"]);

    if (!compositeText) {
      throw new ApiRouteError(
        "No readable text was found in the uploaded composite.",
        400,
      );
    }

    const extractedComposite = await extractRoleCompositeFromText({
      fileName: file.name,
      text: compositeText,
    });

    let currentRoleId = roleId;

    if (currentRoleId) {
      const existingRoleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("id", currentRoleId)
        .maybeSingle();

      if (existingRoleResult.error) {
        throw new ApiRouteError(existingRoleResult.error.message, 500);
      }

      if (!existingRoleResult.data) {
        throw new ApiRouteError("Selected role could not be found.", 404);
      }

      const conflictingRoleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("title", extractedComposite.title)
        .neq("id", currentRoleId)
        .maybeSingle();

      if (conflictingRoleResult.error) {
        throw new ApiRouteError(conflictingRoleResult.error.message, 500);
      }

      if (conflictingRoleResult.data) {
        throw new ApiRouteError(
          "Another role already uses the extracted title. Choose a different role or edit the title manually first.",
          409,
        );
      }

      const updateResult = await admin
        .from("roles")
        .update({
          title: extractedComposite.title,
          department: extractedComposite.department,
          description: extractedComposite.description,
          status,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", currentRoleId);

      if (updateResult.error) {
        throw new ApiRouteError(updateResult.error.message, 500);
      }

      const deleteCompetenciesResult = await admin
        .from("role_competencies")
        .delete()
        .eq("organization_id", profile.organization_id)
        .eq("role_id", currentRoleId);

      if (deleteCompetenciesResult.error) {
        throw new ApiRouteError(deleteCompetenciesResult.error.message, 500);
      }
    } else {
      const existingRoleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("title", extractedComposite.title)
        .maybeSingle();

      if (existingRoleResult.error) {
        throw new ApiRouteError(existingRoleResult.error.message, 500);
      }

      if (existingRoleResult.data) {
        throw new ApiRouteError(
          "A role with the extracted title already exists. Select that role in the upload form to update it.",
          409,
        );
      }

      const insertRoleResult = await admin
        .from("roles")
        .insert({
          organization_id: profile.organization_id,
          title: extractedComposite.title,
          department: extractedComposite.department,
          description: extractedComposite.description,
          status,
        })
        .select("id")
        .single();

      if (insertRoleResult.error) {
        throw new ApiRouteError(insertRoleResult.error.message, 500);
      }

      currentRoleId = insertRoleResult.data.id;
    }

    const insertCompetenciesResult = await admin.from("role_competencies").insert(
      extractedComposite.competencies.map((competency) => ({
        organization_id: profile.organization_id,
        role_id: currentRoleId,
        ...competency,
      })),
    );

    if (insertCompetenciesResult.error) {
      throw new ApiRouteError(insertCompetenciesResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Composite imported into "${extractedComposite.title}".`,
      roleId: currentRoleId,
      competenciesCreated: extractedComposite.competencies.length,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected role composite upload failure.");
  }
}
