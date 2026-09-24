import { extractTextFromUploadedFile } from "@/lib/file-parsers";
const BUCKET = "role-job-descriptions";

export function getRoleJobDescriptionsBucket() {
  return BUCKET;
}

export function buildRoleJobDescriptionStoragePath({ organizationId, roleId, fileName }: { organizationId: string; roleId: string; fileName: string }) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "job-description";
  return [organizationId, "roles", roleId, `${Date.now()}-${safeName}`].join("/");
}

export async function extractRoleJobDescriptionText(file: File) {
  return extractTextFromUploadedFile(file, ["pdf", "docx", "txt"]);
}
