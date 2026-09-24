import { NextResponse } from "next/server";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";
import { assertAcceptedFileType } from "@/lib/file-parsers";
import { buildRoleJobDescriptionStoragePath, extractRoleJobDescriptionText, getRoleJobDescriptionsBucket } from "@/lib/role-job-descriptions";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requireAdmin: true });
    const form = await request.formData();
    const roleId = String(form.get("roleId") ?? "");
    const file = form.get("file");
    if (!roleId || !(file instanceof File)) throw new ApiRouteError("Select a role and upload a job description.", 400);
    assertAcceptedFileType(file, ["pdf", "docx", "txt"]);
    if (file.size > 50 * 1024 * 1024) throw new ApiRouteError("Job descriptions must be 50 MB or smaller.", 400);
    const role = await admin.from("roles").select("id").eq("id", roleId).eq("organization_id", profile.organization_id).maybeSingle();
    if (role.error) throw new ApiRouteError(role.error.message, 500);
    if (!role.data) throw new ApiRouteError("Selected role could not be found.", 404);
    const text = await extractRoleJobDescriptionText(file);
    if (!text) throw new ApiRouteError("No readable text was found in the job description.", 400);
    const bucket = getRoleJobDescriptionsBucket();
    const existing = await admin
      .from("role_job_descriptions")
      .select("storage_path")
      .eq("organization_id", profile.organization_id)
      .eq("role_id", roleId)
      .maybeSingle();
    if (existing.error) throw new ApiRouteError(existing.error.message, 500);
    const path = buildRoleJobDescriptionStoragePath({ organizationId: profile.organization_id, roleId, fileName: file.name });
    const upload = await admin.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream", upsert: true });
    if (upload.error) throw new ApiRouteError(upload.error.message, 500);
    const saved = await admin.from("role_job_descriptions").upsert({ organization_id: profile.organization_id, role_id: roleId, file_name: file.name, file_extension: file.name.split(".").at(-1)?.toLowerCase() ?? "", mime_type: file.type || null, file_size_bytes: file.size, storage_bucket: bucket, storage_path: path, extracted_text: text, created_by_profile_id: profile.id, updated_at: new Date().toISOString() }, { onConflict: "role_id" });
    if (saved.error) {
      if (existing.data?.storage_path !== path) {
        await admin.storage.from(bucket).remove([path]);
      }
      throw new ApiRouteError(saved.error.message, 500);
    }
    if (existing.data?.storage_path && existing.data.storage_path !== path) {
      await admin.storage.from(bucket).remove([existing.data.storage_path]);
    }
    return NextResponse.json({ message: "Job description uploaded and extracted.", roleId });
  } catch (error) { return createApiErrorResponse(error, "Unable to upload job description."); }
}
