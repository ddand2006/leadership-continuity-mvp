import { createRequire } from "node:module";

const ROLE_COMPOSITE_DOCUMENTS_BUCKET = "role-composite-documents";
const require = createRequire(import.meta.url);

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

function normalizeCompositeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

export async function extractRoleCompositeDocumentText(options: {
  buffer: Buffer;
  fileName: string;
}) {
  const extension = options.fileName.split(".").at(-1)?.toLowerCase() ?? "docx";

  if (extension === "txt") {
    return normalizeCompositeText(options.buffer.toString("utf-8"));
  }

  if (extension === "docx") {
    const mammoth = require("mammoth") as typeof import("mammoth");
    const result = await mammoth.extractRawText({
      buffer: options.buffer,
    });

    return normalizeCompositeText(result.value);
  }

  return "";
}

export function splitRoleCompositeNarrative(text: string) {
  const normalized = normalizeCompositeText(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);
}
