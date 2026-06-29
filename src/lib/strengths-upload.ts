import { ApiRouteError } from "@/lib/api-route";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

type StrengthTheme = {
  theme_name: string;
  domain: string;
};

type StrengthRanking = StrengthTheme & {
  rank: number;
  notes?: string | null;
};

type StrengthDocument = {
  fileName: string;
  text: string;
};

const strengthsDocumentAnalysisSchema = z.object({
  candidate_name: z.string().trim().min(1).nullable().optional(),
  import_summary: z.string().trim().min(1).nullable().optional(),
  ranked_themes: z
    .array(
      z.object({
        rank: z.number().int().min(1).max(34),
        theme_name: z.string().trim().min(1),
        note: z.string().trim().min(1).nullable().optional(),
      }),
    )
    .min(5)
    .max(34),
});

function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/^\d+\s*[-.)]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectThemeName(
  value: string,
  themesByNormalizedName: Map<string, StrengthTheme>,
) {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  const directMatch = themesByNormalizedName.get(normalizedValue);
  if (directMatch) {
    return directMatch;
  }

  for (const [normalizedTheme, theme] of themesByNormalizedName.entries()) {
    const escapedTheme = normalizedTheme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const themePattern = new RegExp(`(^|[^a-z])${escapedTheme}([^a-z]|$)`, "i");

    if (themePattern.test(normalizedValue)) {
      return theme;
    }
  }

  return null;
}

function buildThemeMap(themes: StrengthTheme[]) {
  return new Map(themes.map((theme) => [normalizeValue(theme.theme_name), theme]));
}

function extractStrengthsFromText(
  text: string,
  themes: StrengthTheme[],
) {
  const themesByNormalizedName = buildThemeMap(themes);
  const orderedThemes: StrengthTheme[] = [];
  const seen = new Set<string>();
  const rows = text.split(/\n+/);

  for (const row of rows) {
    const cells = row.split(/,|\t|;/g);

    for (const cell of cells) {
      const detectedTheme = detectThemeName(cell, themesByNormalizedName);

      if (detectedTheme && !seen.has(detectedTheme.theme_name)) {
        seen.add(detectedTheme.theme_name);
        orderedThemes.push(detectedTheme);
      }
    }
  }

  return orderedThemes.map((theme, index) => ({
    ...theme,
    rank: index + 1,
  }));
}

function mergeStrengthNotes(
  rankings: StrengthRanking[],
  rankingsWithNotes: StrengthRanking[],
) {
  const notesByTheme = new Map(
    rankingsWithNotes
      .filter((item) => item.notes)
      .map((item) => [item.theme_name, item.notes ?? null]),
  );

  return rankings.map((item) => ({
    ...item,
    notes: notesByTheme.get(item.theme_name) ?? item.notes ?? null,
  }));
}

function coerceAnalyzedStrengths(
  rankedThemes: z.infer<typeof strengthsDocumentAnalysisSchema>["ranked_themes"],
  themes: StrengthTheme[],
) {
  const themesByNormalizedName = buildThemeMap(themes);
  const normalizedRankings = [...rankedThemes].sort((left, right) => left.rank - right.rank);
  const seenThemes = new Set<string>();
  const strengths: StrengthRanking[] = [];

  for (const item of normalizedRankings) {
    const detectedTheme = detectThemeName(item.theme_name, themesByNormalizedName);

    if (!detectedTheme || seenThemes.has(detectedTheme.theme_name)) {
      continue;
    }

    seenThemes.add(detectedTheme.theme_name);
    strengths.push({
      ...detectedTheme,
      rank: strengths.length + 1,
      notes: item.note?.trim() ?? null,
    });
  }

  return strengths;
}

export function parseStrengthsFromText(
  text: string,
  themes: StrengthTheme[],
) {
  const orderedThemes = extractStrengthsFromText(text, themes);

  if (orderedThemes.length < 5) {
    throw new ApiRouteError(
      "Could not detect enough CliftonStrengths themes from the uploaded file. Use a CSV or TXT file that includes ranked theme names.",
      400,
    );
  }

  return orderedThemes;
}

export async function analyzeStrengthsDocuments({
  candidateName,
  documents,
  themes,
}: {
  candidateName: string;
  documents: StrengthDocument[];
  themes: StrengthTheme[];
}) {
  const combinedText = documents.map((document) => document.text).join("\n\n");
  const heuristicRankings = extractStrengthsFromText(combinedText, themes);
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You analyze Gallup CliftonStrengths reports. Use only the provided document text. Prefer exact rank order from ALL_34-style reports when available. Use only official theme names from the strengths library. Return concise notes only when a document gives narrative detail about a theme.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            candidate_name_hint: candidateName,
            strengths_library: themes.map((theme) => ({
              theme_name: theme.theme_name,
              domain: theme.domain,
            })),
            heuristic_rank_hint: heuristicRankings.map((item) => ({
              rank: item.rank,
              theme_name: item.theme_name,
            })),
            documents: documents.map((document) => ({
              file_name: document.fileName,
              text: document.text,
            })),
            instructions: {
              ranked_themes:
                "Return the strongest available rank order from the documents. If ALL_34 is present, include all 34 themes in order. If only top-five evidence is present, return those top five in rank order.",
              notes:
                "Use short plain-language notes for themes with narrative evidence, typically the top five only.",
            },
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: zodTextFormat(
        strengthsDocumentAnalysisSchema,
        "strengths_document_analysis",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new ApiRouteError(
      "OpenAI could not analyze the uploaded strengths documents.",
      502,
    );
  }

  const analyzedRankings = coerceAnalyzedStrengths(
    response.output_parsed.ranked_themes,
    themes,
  );
  const finalRankings =
    heuristicRankings.length >= 5
      ? mergeStrengthNotes(heuristicRankings, analyzedRankings)
      : analyzedRankings;

  if (finalRankings.length < 5) {
    throw new ApiRouteError(
      "Could not detect enough CliftonStrengths themes from the uploaded documents. Upload the Gallup ALL_34, Signature Theme, or Top 5 report PDFs.",
      400,
    );
  }

  return {
    candidateName: response.output_parsed.candidate_name ?? null,
    importSummary: response.output_parsed.import_summary ?? null,
    rankings: finalRankings,
  };
}
