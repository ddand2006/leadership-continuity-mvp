import { ApiRouteError } from "@/lib/api-route";
import { getFileExtension } from "@/lib/file-parsers";
import {
  ROLE_CHARACTERISTIC_CATEGORIES,
  type RoleCandidateCharacteristicInput,
  type RoleCharacteristicCategory,
} from "@/lib/role-characteristics";

const headerAliases: Record<RoleCharacteristicCategory, string[]> = {
  talent: ["talent", "talents", "personality", "personalities"],
  skill: [
    "skill",
    "skills",
    "knowledge",
    "knowlege",
    "requirement",
    "requirements",
  ],
  behavior: ["behavior", "behaviors", "behaviour", "behaviours"],
};

const rowCategoryAliases = new Map<string, RoleCharacteristicCategory>(
  Object.entries(headerAliases).flatMap(([category, aliases]) =>
    aliases.map((alias) => [alias, category as RoleCharacteristicCategory]),
  ),
);

function normalizeCellValue(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .trim();
}

function normalizeHeader(value: unknown) {
  return normalizeCellValue(value)
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}

function normalizeMatcherText(value: string) {
  return cleanListItem(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanListItem(value: string) {
  return value
    .replace(/^[\s\-*•\d.)]+/, "")
    .trim();
}

function dedupeCharacteristics(items: RoleCandidateCharacteristicInput[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.category}:${item.characteristic.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getCategoryFromHeader(header: string) {
  return rowCategoryAliases.get(header) ?? null;
}

const behaviorMatchers = [
  /\bability to\b/,
  /\bworks? well with others\b/,
  /\bfollow through\b/,
  /\baccountab/i,
  /\bowns? mistakes?\b/,
  /\bgrows? from\b/,
  /\binspire confidence\b/,
  /\bself aware\b/,
  /\blead teams?\b/,
  /\bcommunicate outcomes\b/,
  /\bholds? teams? accountable\b/,
  /\baware of coworkers\b/,
  /\bmaximize a team\b/,
  /\bgood listener\b/,
  /\bseeks? (for )?clarity\b/,
];

const talentMatchers = [
  /\bempathy\b/,
  /\bemotional intelligence\b/,
  /\blearner mindset\b/,
  /\bcontinual improvement mindset\b/,
  /\bcommunity mindset\b/,
  /\bgood judgement\b/,
  /\bgood judgment\b/,
  /\bcredibility\b/,
  /\bhumble\b/,
  /\bethics\b/,
  /\borganized\b/,
  /\battention to detail(s)?\b/,
];

const skillMatchers = [
  /\bhipaa\b/,
  /\bcompliance\b/,
  /\bcontracts?\b/,
  /\bconstruction management\b/,
  /\bmaterials management\b/,
  /\bbusiness office\b/,
  /\bfinance\b/,
  /\bfinancial acumen\b/,
  /\binformation technology\b/,
  /\bhealth information technology\b/,
  /\behr\b/,
  /\bimplementation\b/,
  /\bsystems thinking\b/,
  /\bproject management\b/,
  /\badvanced degree\b/,
  /\bequivelant experience\b/,
  /\bequivalent experience\b/,
  /\bai skills\b/,
  /\boperations in healthcare\b/,
];

function matchesAny(value: string, matchers: RegExp[]) {
  return matchers.some((matcher) => matcher.test(value));
}

function inferCategoryFromCompetencyText(
  characteristic: string,
  fallbackCategory: RoleCharacteristicCategory | null,
): RoleCharacteristicCategory {
  const normalizedText = normalizeMatcherText(characteristic);

  if (!normalizedText) {
    return fallbackCategory ?? "skill";
  }

  if (fallbackCategory === "behavior") {
    return "behavior";
  }

  if (matchesAny(normalizedText, skillMatchers)) {
    return "skill";
  }

  if (matchesAny(normalizedText, behaviorMatchers)) {
    return "behavior";
  }

  if (fallbackCategory === "talent" || matchesAny(normalizedText, talentMatchers)) {
    return "talent";
  }

  return fallbackCategory ?? "skill";
}

function pushCharacteristic(
  characteristics: RoleCandidateCharacteristicInput[],
  sortOrderByCategory: Map<RoleCharacteristicCategory, number>,
  category: RoleCharacteristicCategory,
  characteristic: string,
) {
  const nextSortOrder = sortOrderByCategory.get(category) ?? 0;

  characteristics.push({
    category,
    characteristic,
    sort_order: nextSortOrder,
  });
  sortOrderByCategory.set(category, nextSortOrder + 1);
}

function getHeaderRowIndex(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const normalizedHeaders = row.map((header) => normalizeHeader(header));

    return normalizedHeaders.some((header) =>
      [
        "category",
        "type",
        "bucket",
        "typeofset",
        "competency",
        "competencies",
        "talents",
        "skills",
        "behaviors",
      ].includes(header),
    );
  });
}

function parseWorkbookColumnLayout(rows: unknown[][]) {
  const headerRow = rows[0] ?? [];
  const headerMap = headerRow.map((header) => normalizeHeader(header));
  const characteristics: RoleCandidateCharacteristicInput[] = [];
  const sortOrderByCategory = new Map<RoleCharacteristicCategory, number>();

  ROLE_CHARACTERISTIC_CATEGORIES.forEach((category) => {
    const columnIndex = headerMap.findIndex((header) =>
      headerAliases[category].includes(header),
    );

    if (columnIndex === -1) {
      return;
    }

    rows.slice(1).forEach((row) => {
      const rawValue = normalizeCellValue(row[columnIndex]);
      const characteristic = cleanListItem(rawValue);

      if (!characteristic) {
        return;
      }

      const inferredCategory = inferCategoryFromCompetencyText(
        characteristic,
        category,
      );

      pushCharacteristic(
        characteristics,
        sortOrderByCategory,
        inferredCategory,
        characteristic,
      );
    });
  });

  return dedupeCharacteristics(characteristics);
}

function parseWorkbookRowLayout(rows: unknown[][]) {
  const headerRow = rows[0] ?? [];
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));
  const categoryColumnIndex = normalizedHeaders.findIndex((header) =>
    ["category", "type", "bucket", "typeofset", "settype"].includes(header),
  );
  const valueColumnIndex = normalizedHeaders.findIndex((header) =>
    [
      "characteristic",
      "characteristics",
      "competency",
      "competencies",
      "trait",
      "item",
      "value",
      "description",
    ].includes(header),
  );

  if (categoryColumnIndex === -1 || valueColumnIndex === -1) {
    return [];
  }

  const characteristics: RoleCandidateCharacteristicInput[] = [];
  const sortOrderByCategory = new Map<RoleCharacteristicCategory, number>();
  let previousCategory: RoleCharacteristicCategory | null = null;

  rows.slice(1).forEach((row) => {
    const explicitCategory = getCategoryFromHeader(
      normalizeHeader(row[categoryColumnIndex]),
    );
    const characteristic = cleanListItem(normalizeCellValue(row[valueColumnIndex]));

    if (explicitCategory) {
      previousCategory = explicitCategory;
    }

    if (!characteristic) {
      return;
    }

    const inferredCategory = inferCategoryFromCompetencyText(
      characteristic,
      explicitCategory ?? previousCategory,
    );

    if (!inferredCategory) {
      return;
    }

    pushCharacteristic(
      characteristics,
      sortOrderByCategory,
      inferredCategory,
      characteristic,
    );
  });

  return dedupeCharacteristics(characteristics);
}

function parseCsvText(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  function pushCell() {
    currentRow.push(currentCell);
    currentCell = "";
  }

  function pushRow() {
    pushCell();
    const hasAnyValue = currentRow.some((value) => normalizeCellValue(value).length > 0);

    if (hasAnyValue) {
      rows.push(currentRow);
    }

    currentRow = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      pushCell();
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      pushRow();
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  return rows;
}

function getExcelCellValueText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value && value.result !== undefined) {
      return String(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((item) => (typeof item?.text === "string" ? item.text : ""))
        .join("");
    }
  }

  return String(value);
}

async function parseXlsxRows(buffer: Buffer) {
  const excelJsModule = await import("exceljs").catch(() => null);

  if (!excelJsModule?.default) {
    throw new ApiRouteError(
      "The server could not load the XLSX parser. Please try saving the spreadsheet as CSV and upload it again.",
      500,
    );
  }

  const workbook = new excelJsModule.default.Workbook();

  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new ApiRouteError(
      "This spreadsheet could not be read as XLSX. Open it in Excel or Numbers, save it again as .xlsx or CSV, and upload it again.",
      400,
    );
  }

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new ApiRouteError("The uploaded file does not contain any sheets.", 400);
  }

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const normalizedValues = rowValues.map((value) => getExcelCellValueText(value));

    if (normalizedValues.some((value) => normalizeCellValue(value).length > 0)) {
      rows.push(normalizedValues);
    }
  });

  return rows;
}

export async function parseRoleCharacteristicsWorkbook(
  buffer: Buffer,
  fileName: string,
) {
  const extension = getFileExtension(fileName);
  let rows: unknown[][];

  if (extension === "csv") {
    rows = parseCsvText(buffer.toString("utf8"));
  } else if (extension === "xlsx") {
    rows = await parseXlsxRows(buffer);
  } else if (extension === "xls") {
    throw new ApiRouteError(
      "Legacy XLS files are no longer supported. Please resave the spreadsheet as XLSX or CSV and upload it again.",
      400,
    );
  } else {
    throw new ApiRouteError("Unsupported file type. Use CSV or XLSX.", 400);
  }

  if (rows.length < 2) {
    throw new ApiRouteError(
      "The uploaded file needs a header row and at least one competency row.",
      400,
    );
  }

  const headerRowIndex = getHeaderRowIndex(rows);

  if (headerRowIndex === -1) {
    throw new ApiRouteError(
      "Could not detect a competency header row in the uploaded file.",
      400,
    );
  }

  const normalizedRows = rows.slice(headerRowIndex);

  const rowLayoutCharacteristics = parseWorkbookRowLayout(normalizedRows);

  if (rowLayoutCharacteristics.length > 0) {
    return rowLayoutCharacteristics;
  }

  const columnLayoutCharacteristics = parseWorkbookColumnLayout(normalizedRows);

  if (columnLayoutCharacteristics.length > 0) {
    return columnLayoutCharacteristics;
  }

  throw new ApiRouteError(
    "Could not detect role competencies in the uploaded file. Use columns like Competency or Talents, Skills, Behaviors, or rows with Type of Set and Competency headers.",
    400,
  );
}
