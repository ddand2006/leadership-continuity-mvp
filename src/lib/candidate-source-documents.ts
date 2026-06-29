const CANDIDATE_SOURCE_DOCUMENTS_BUCKET = "candidate-source-documents";
const STRENGTHS_UPLOAD_DOCUMENT_CATEGORY = "strengths_upload";

function slugifyFileNameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getCandidateSourceDocumentsBucket() {
  return CANDIDATE_SOURCE_DOCUMENTS_BUCKET;
}

export function getStrengthsUploadDocumentCategory() {
  return STRENGTHS_UPLOAD_DOCUMENT_CATEGORY;
}

export function buildCandidateSourceDocumentStoragePath({
  organizationId,
  candidateId,
  fileName,
}: {
  organizationId: string;
  candidateId: string;
  fileName: string;
}) {
  const timestamp = Date.now();
  const normalizedFileName = slugifyFileNameSegment(fileName) || "upload";

  return [
    organizationId,
    "candidates",
    candidateId,
    `${timestamp}-${normalizedFileName}`,
  ].join("/");
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
