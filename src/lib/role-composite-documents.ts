const ROLE_COMPOSITE_DOCUMENTS_BUCKET = "role-composite-documents";

function slugifyFileNameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getRoleCompositeDocumentsBucket() {
  return ROLE_COMPOSITE_DOCUMENTS_BUCKET;
}

export function buildRoleCompositeDocumentStoragePath({
  organizationId,
  roleId,
  fileName,
}: {
  organizationId: string;
  roleId: string;
  fileName: string;
}) {
  const timestamp = Date.now();
  const normalizedFileName = slugifyFileNameSegment(fileName) || "role-composite.docx";

  return [organizationId, "roles", roleId, `${timestamp}-${normalizedFileName}`].join(
    "/",
  );
}

