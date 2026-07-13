const PERSONAL_SOURCE_DOCUMENTS_BUCKET = "personal-source-documents";
const PERSONAL_STRENGTHS_UPLOAD_DOCUMENT_CATEGORY = "strengths_upload";

function slugifyFileNameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getPersonalSourceDocumentsBucket() {
  return PERSONAL_SOURCE_DOCUMENTS_BUCKET;
}

export function getPersonalStrengthsUploadDocumentCategory() {
  return PERSONAL_STRENGTHS_UPLOAD_DOCUMENT_CATEGORY;
}

export function buildPersonalSourceDocumentStoragePath({
  organizationId,
  personalDevelopmentProfileId,
  fileName,
}: {
  organizationId: string;
  personalDevelopmentProfileId: string;
  fileName: string;
}) {
  const timestamp = Date.now();
  const normalizedFileName = slugifyFileNameSegment(fileName) || "upload";

  return [
    organizationId,
    "personal-development",
    personalDevelopmentProfileId,
    `${timestamp}-${normalizedFileName}`,
  ].join("/");
}
