function normalizeWhitespace(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeAppText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    value
      .normalize("NFKC")
      .replace(/[\uFFFD\uFEFF\u200B-\u200D\u2060]/g, "")
      .replace(/[^\x20-\x7E\r\n\t]/g, " "),
  );
}

export function sanitizeAppTextList(values: Array<string | null | undefined>) {
  return values.map((value) => sanitizeAppText(value)).filter((value) => value.length > 0);
}
