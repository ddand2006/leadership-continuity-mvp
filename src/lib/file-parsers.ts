import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ApiRouteError } from "@/lib/api-route";
import { assertAcceptedFileType, getFileExtension } from "@/lib/upload-file-utils";

export { assertAcceptedFileType, getFileExtension } from "@/lib/upload-file-utils";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const PDF_EXTRACTOR_SCRIPT_PATH_CANDIDATES = [
  join(process.cwd(), "scripts", "extract-pdf-text.cjs"),
  fileURLToPath(new URL("../../scripts/extract-pdf-text.cjs", import.meta.url)),
];

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

function getPdfExtractorScriptPath() {
  const scriptPath = PDF_EXTRACTOR_SCRIPT_PATH_CANDIDATES.find((candidate) =>
    existsSync(candidate),
  );

  if (!scriptPath) {
    throw new Error("PDF extractor script could not be located.");
  }

  return scriptPath;
}

async function extractPdfTextWithPdfParse(file: File) {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const result = await parser.getText({ pageJoiner: "" });
    return ensureExtractedText(result.text, file.name);
  } finally {
    await parser.destroy();
  }
}

async function extractPdfTextWithNodeProcess(file: File) {
  const tempDirectory = await mkdtemp(join(tmpdir(), "lc-pdf-"));
  const tempFilePath = join(tempDirectory, file.name || "upload.pdf");

  try {
    await writeFile(tempFilePath, Buffer.from(await file.arrayBuffer()));

    const { stdout } = await execFileAsync(
      process.execPath,
      [getPdfExtractorScriptPath(), tempFilePath],
      {
        maxBuffer: MAX_UPLOAD_SIZE_BYTES * 4,
      },
    );

    return ensureExtractedText(stdout, file.name);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
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
    const mammoth = require("mammoth") as typeof import("mammoth");
    const result = await mammoth.extractRawText({
      buffer: fileBuffer,
    });

    return ensureExtractedText(result.value, file.name);
  }

  if (extension === "pdf") {
    try {
      return await extractPdfTextWithPdfParse(file);
    } catch (primaryError) {
      try {
        return await extractPdfTextWithNodeProcess(file);
      } catch (fallbackError) {
        console.error("Failed to extract PDF text", {
          fileName: file.name,
          primaryError,
          fallbackError,
        });
      }

      console.error("Failed to extract PDF text", {
        fileName: file.name,
        error: primaryError,
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
