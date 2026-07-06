import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ApiRouteError } from "@/lib/api-route";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments.at(-1) ?? "" : "";
}

function normalizeExtractedText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function ensureExtractedText(value: string, fileName: string) {
  const normalizedValue = normalizeExtractedText(value);

  if (!normalizedValue) {
    throw new ApiRouteError(
      `Could not read any text from ${fileName}. Try a text-based export instead.`,
      400,
    );
  }

  return normalizedValue;
}

async function extractPdfTextWithNodeProcess(file: File) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const result = await parser.getText();
    return ensureExtractedText(result.text || "", file.name);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function formatAllowedExtensions(extensions: string[]) {
  return extensions.map((extension) => extension.toUpperCase()).join(", ");
}

export function assertAcceptedFileType(file: File, allowedExtensions: string[]) {
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    throw new ApiRouteError(
      `Unsupported file type. Use ${formatAllowedExtensions(allowedExtensions)}.`,
      400,
    );
  }
}

export async function extractTextFromUploadedFile(
  file: File,
  allowedExtensions?: string[],
) {
  if (file.size === 0) {
    throw new ApiRouteError("Uploaded file is empty.", 400);
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new ApiRouteError("Uploaded file must be 10 MB or smaller.", 400);
  }

  const extension = getFileExtension(file.name);

  if (allowedExtensions) {
    assertAcceptedFileType(file, allowedExtensions);
  }

  if (extension === "txt" || extension === "csv") {
    return ensureExtractedText(await file.text(), file.name);
  }

  if (extension === "docx") {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({
      buffer: fileBuffer,
    });

    return ensureExtractedText(result.value, file.name);
  }

  if (extension === "pdf") {
    try {
      return await extractPdfTextWithNodeProcess(file);
    } catch (error) {
      console.error("Failed to extract PDF text", {
        fileName: file.name,
        error,
      });
      throw new ApiRouteError(
        "Unable to read text from this PDF. If it is image-only or scanned, upload a text-based PDF, DOCX, CSV, or TXT version instead.",
        400,
      );
    }
  }

  throw new ApiRouteError(
    "Unsupported file type. Use PDF, DOCX, TXT, or CSV.",
    400,
  );
}
