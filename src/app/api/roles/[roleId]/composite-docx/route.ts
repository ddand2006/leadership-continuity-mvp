import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { assertAcceptedFileType } from "@/lib/upload-file-utils";
import {
  buildRoleCompositeDocumentStoragePath,
  getRoleCompositeDocumentsBucket,
} from "@/lib/role-composite-documents";

type RouteContext = {
  params: Promise<{
    roleId: string;
  }>;
};

async function replaceStoredCompositeDocument(options: {
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"];
  organizationId: string;
  profileId: string;
  roleId: string;
  file: File;
}) {
  const bucket = getRoleCompositeDocumentsBucket();
  const existingDocumentResult = await options.admin
    .from("role_composite_documents")
    .select("id, storage_path")
    .eq("organization_id", options.organizationId)
    .eq("role_id", options.roleId)
    .maybeSingle();

  if (existingDocumentResult.error) {
    throw new ApiRouteError(existingDocumentResult.error.message, 500);
  }

  const storagePath = buildRoleCompositeDocumentStoragePath({
    organizationId: options.organizationId,
    roleId: options.roleId,
    fileName: options.file.name,
  });
  const uploadResult = await options.admin.storage
    .from(bucket)
    .upload(storagePath, Buffer.from(await options.file.arrayBuffer()), {
      contentType: options.file.type || undefined,
      upsert: false,
    });

  if (uploadResult.error) {
    throw new ApiRouteError(uploadResult.error.message, 500);
  }

  const fileNameParts = options.file.name.split(".");
  const fileExtension =
    fileNameParts.length > 1 ? fileNameParts.at(-1)?.toLowerCase() ?? "docx" : "docx";
  const insertResult = await options.admin
    .from("role_composite_documents")
    .upsert(
      {
        organization_id: options.organizationId,
        role_id: options.roleId,
        created_by_profile_id: options.profileId,
        document_source: "manual",
        file_name: options.file.name,
        file_extension: fileExtension,
        mime_type: options.file.type || null,
        file_size_bytes: options.file.size,
        storage_bucket: bucket,
        storage_path: storagePath,
      },
      { onConflict: "role_id" },
    );

  if (insertResult.error) {
    await options.admin.storage.from(bucket).remove([storagePath]);
    throw new ApiRouteError(insertResult.error.message, 500);
  }

  const oldStoragePath = existingDocumentResult.data?.storage_path;

  if (oldStoragePath) {
    const removeOldFileResult = await options.admin.storage
      .from(bucket)
      .remove([oldStoragePath]);

    if (removeOldFileResult.error) {
      console.error("Failed to remove superseded role composite document", {
        roleId: options.roleId,
        storagePath: oldStoragePath,
        error: removeOldFileResult.error,
      });
    }
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { roleId } = await context.params;

    const [roleResult, documentResult] = await Promise.all([
      admin
        .from("roles")
        .select("id, title")
        .eq("organization_id", profile.organization_id)
        .eq("id", roleId)
        .maybeSingle(),
      admin
        .from("role_composite_documents")
        .select(
          "file_name, mime_type, storage_bucket, storage_path, file_extension",
        )
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .maybeSingle(),
    ]);

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }

    if (documentResult.error) {
      throw new ApiRouteError(documentResult.error.message, 500);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    if (!documentResult.data) {
      throw new ApiRouteError(
        "No role composite document exists yet. Generate it once first, then download or replace it manually.",
        404,
      );
    }

    const storageResult = await admin.storage
      .from(documentResult.data.storage_bucket)
      .download(documentResult.data.storage_path);

    if (storageResult.error) {
      throw new ApiRouteError(storageResult.error.message, 500);
    }

    const buffer = Buffer.from(await storageResult.data.arrayBuffer());

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          documentResult.data.mime_type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=\"${documentResult.data.file_name}\"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected role composite document download failure.",
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const { roleId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiRouteError("Upload the corrected Word document first.", 400);
    }

    assertAcceptedFileType(file, ["docx"]);

    const [roleResult, roleCompetenciesResult] = await Promise.all([
      admin
        .from("roles")
        .select("id, title")
        .eq("organization_id", profile.organization_id)
        .eq("id", roleId)
        .maybeSingle(),
      admin
        .from("role_competencies")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", roleId)
        .limit(1),
    ]);

    if (roleResult.error) {
      throw new ApiRouteError(roleResult.error.message, 500);
    }

    if (roleCompetenciesResult.error) {
      throw new ApiRouteError(roleCompetenciesResult.error.message, 500);
    }

    if (!roleResult.data) {
      throw new ApiRouteError("Selected role could not be found.", 404);
    }

    if ((roleCompetenciesResult.data ?? []).length === 0) {
      throw new ApiRouteError(
        "Generate the role composite first so the role has a structured competency model before uploading a corrected Word document.",
        400,
      );
    }

    await replaceStoredCompositeDocument({
      admin,
      organizationId: profile.organization_id,
      profileId: profile.id,
      roleId,
      file,
    });

    return NextResponse.json({
      message: `Manual role composite uploaded for "${roleResult.data.title}". This role composite is now maintained through Word uploads only.`,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected role composite document upload failure.",
    );
  }
}
