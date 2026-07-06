import { ApiRouteError } from "@/lib/api-route";

export function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments.at(-1) ?? "" : "";
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
