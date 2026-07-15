import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

export const roleCompositeSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1).nullable(),
  description: z.string().min(1),
  competencies: z
    .array(
      z.object({
        name: z.string().min(1),
        definition: z.string().min(1),
        weight: z.number().positive(),
        target_score: z.number().min(1).max(5),
        behavioral_indicators: z.array(z.string().min(1)).min(1).max(6),
        red_flags: z.array(z.string().min(1)).min(1).max(6),
      }),
    )
    .min(3)
    .max(10),
});

export type RoleComposite = z.infer<typeof roleCompositeSchema>;
export type ExtractedRoleComposite = RoleComposite & {
  source_document_type: "role_composite" | "interview_scorecard";
};

type InterviewScorecardSection = {
  title: string;
  questions: string[];
  validations: string[];
};

type ParsedInterviewScorecard = {
  organizationName: string | null;
  roleTitle: string;
  purpose: string | null;
  sections: InterviewScorecardSection[];
};

function roundToHundredths(value: number) {
  return Number(value.toFixed(2));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function lowerCaseFirst(value: string) {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function toSentenceCaseList(values: string[]) {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function uniqueNonEmpty(values: string[], maxItems?: number) {
  const uniqueValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalizedValue = normalizeWhitespace(value);

    if (!normalizedValue) {
      continue;
    }

    const dedupeKey = normalizedValue.toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    uniqueValues.push(normalizedValue);

    if (maxItems && uniqueValues.length >= maxItems) {
      break;
    }
  }

  return uniqueValues;
}

function isScoreLine(value: string) {
  return /^Score \(circle\):/i.test(value);
}

function isNotesLine(value: string) {
  return /^Notes:/i.test(value);
}

function buildScorecardCompetencyDefinition(section: InterviewScorecardSection) {
  const validations = uniqueNonEmpty(section.validations, 4);

  if (validations.length === 0) {
    return `Demonstrates strong ${section.title.toLowerCase()} in a senior healthcare leadership context.`;
  }

  return `Demonstrates ${toSentenceCaseList(
    validations.map((item) => lowerCaseFirst(item)),
  )}.`;
}

function buildScorecardBehavioralIndicators(section: InterviewScorecardSection) {
  const validations = uniqueNonEmpty(section.validations, 6);

  if (validations.length > 0) {
    return validations;
  }

  return uniqueNonEmpty(
    section.questions.map(
      (question) => `Provides specific leadership evidence related to: ${question}`,
    ),
    6,
  );
}

function buildScorecardRedFlags(section: InterviewScorecardSection) {
  const validationBasedRedFlags = uniqueNonEmpty(section.validations, 4).map(
    (validation) => `Shows limited evidence of ${lowerCaseFirst(validation)}.`,
  );
  const questionBasedRedFlags = uniqueNonEmpty(section.questions, 2).map(
    (question) =>
      `Cannot give a specific example that addresses: ${question}`,
  );

  const redFlags = uniqueNonEmpty(
    [
      ...validationBasedRedFlags,
      ...questionBasedRedFlags,
      `Answers stay theoretical instead of showing ${section.title.toLowerCase()} in practice.`,
      `Avoids clear ownership, reflection, or measurable outcomes when discussing ${section.title.toLowerCase()}.`,
    ],
    6,
  );

  return redFlags.length > 0
    ? redFlags
    : [
        `Shows limited evidence of ${section.title.toLowerCase()}.`,
        `Cannot describe a clear leadership example tied to ${section.title.toLowerCase()}.`,
      ];
}

function buildScorecardDescription(scorecard: ParsedInterviewScorecard) {
  const sectionTitles = uniqueNonEmpty(
    scorecard.sections.map((section) => section.title),
  );
  const normalizedPurpose = scorecard.purpose
    ? normalizeWhitespace(scorecard.purpose.replace(/^Purpose:\s*/i, ""))
    : null;

  if (normalizedPurpose) {
    return `${scorecard.roleTitle} is assessed through ${toSentenceCaseList(
      sectionTitles,
    )}. ${normalizedPurpose}`;
  }

  return `${scorecard.roleTitle} is assessed through ${toSentenceCaseList(
    sectionTitles,
  )}, with emphasis on behavioral evidence, leadership judgment, and operational credibility.`;
}

function parseInterviewScorecardText(text: string): ParsedInterviewScorecard | null {
  if (!/interview scorecard/i.test(text) || !/Section\s+1:/i.test(text)) {
    return null;
  }

  const normalizedText = text.replace(/\r/g, "");
  const lines = normalizedText
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  const purposeLineIndex = lines.findIndex((line) => /^Purpose:/i.test(line));
  const prePurposeLines =
    purposeLineIndex === -1 ? lines : lines.slice(0, purposeLineIndex);
  const titleLine = [...prePurposeLines]
    .reverse()
    .find(
      (line) =>
        /Interview Scorecard$/i.test(line) && !/^Appendix\b/i.test(line),
    );

  if (!titleLine) {
    return null;
  }

  const titleLineIndex = lines.indexOf(titleLine);
  const organizationName =
    [...lines.slice(0, titleLineIndex)]
      .reverse()
      .find(
        (line) =>
          !/^Appendix\b/i.test(line) && !/Interview Scorecard$/i.test(line),
      ) ?? null;
  const roleTitle = normalizeWhitespace(
    titleLine.replace(/\s+Interview Scorecard$/i, ""),
  );
  const purposeMatch = normalizedText.match(
    /Purpose:\s*([\s\S]*?)(?=\n\s*Section\s+\d+:|\n\s*Final Evaluation Summary|\s*$)/i,
  );
  const purpose = purposeMatch ? normalizeWhitespace(purposeMatch[1]) : null;
  const sections = Array.from(
    normalizedText.matchAll(
      /Section\s+\d+:\s+([^\n]+)\n([\s\S]*?)(?=\n\s*Section\s+\d+:|\n\s*Final Evaluation Summary|\s*$)/gi,
    ),
  )
    .map((match) => {
      const title = normalizeWhitespace(match[1] ?? "");
      const sectionLines = (match[2] ?? "")
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);
      const questions: string[] = [];
      const validations: string[] = [];

      for (let index = 0; index < sectionLines.length; index += 1) {
        const line = sectionLines[index];

        if (isScoreLine(line) || isNotesLine(line)) {
          continue;
        }

        if (/^What this validates:/i.test(line)) {
          validations.push(line.replace(/^What this validates:\s*/i, ""));
          continue;
        }

        const nextLine = sectionLines[index + 1] ?? "";

        if (/^What this validates:/i.test(nextLine)) {
          questions.push(line);
        }
      }

      return {
        title,
        questions: uniqueNonEmpty(questions, 6),
        validations: uniqueNonEmpty(validations, 6),
      };
    })
    .filter((section) => section.title && section.questions.length > 0);

  if (sections.length < 3 || !roleTitle) {
    return null;
  }

  return {
    organizationName,
    roleTitle,
    purpose,
    sections,
  };
}

function convertInterviewScorecardToRoleComposite(
  scorecard: ParsedInterviewScorecard,
): RoleComposite {
  return normalizeRoleComposite({
    title: scorecard.roleTitle,
    department: null,
    description: buildScorecardDescription(scorecard),
    competencies: scorecard.sections.map((section) => ({
      name: section.title,
      definition: buildScorecardCompetencyDefinition(section),
      weight: 1,
      target_score: 4,
      behavioral_indicators: buildScorecardBehavioralIndicators(section),
      red_flags: buildScorecardRedFlags(section),
    })),
  });
}

export function normalizeRoleComposite(composite: RoleComposite) {
  const normalizedWeights = composite.competencies.map((competency) => ({
    ...competency,
    weight: roundToHundredths(competency.weight),
    target_score: roundToHundredths(competency.target_score),
    behavioral_indicators: competency.behavioral_indicators.map((item) => item.trim()),
    red_flags: competency.red_flags.map((item) => item.trim()),
  }));

  return {
    ...composite,
    title: composite.title.trim(),
    department: composite.department?.trim() || null,
    description: composite.description.trim(),
    competencies: normalizedWeights,
  };
}

export async function extractRoleCompositeFromText(options: {
  fileName: string;
  text: string;
}) {
  const parsedScorecard = parseInterviewScorecardText(options.text);

  if (parsedScorecard) {
    return {
      ...convertInterviewScorecardToRoleComposite(parsedScorecard),
      source_document_type: "interview_scorecard" as const,
    };
  }

  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You extract organizational leadership role composites into structured data. Return only supported information from the document. If the document does not explicitly give weights or target scores, infer practical values for an organizational leadership role. Prefer 4 to 7 competencies. Keep target scores between 1.0 and 5.0. Keep weights positive and relative, usually between 0.5 and 5.0.",
      },
        {
          role: "user",
          content: serializeModelInput({
            file_name: options.fileName,
            composite_text: options.text,
            extraction_rules: {
              title: "Required",
              department: "Optional",
              description: "Summarize the role in 2 to 5 sentences",
              competencies:
                "Return the most important competencies with a definition, weight, target_score, behavioral_indicators, and red_flags",
            },
          }),
        },
    ],
    text: {
      format: zodTextFormat(roleCompositeSchema, "role_composite"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed role composite.");
  }

  return {
    ...normalizeRoleComposite(response.output_parsed),
    source_document_type: "role_composite" as const,
  };
}

export async function generateRoleCompositeFromIdealCompetencies(options: {
  title: string;
  department: string | null;
  description: string;
  talents: string[];
  skills: string[];
  behaviors: string[];
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert organizational leadership architect. Generate a practical role composite from the supplied role description and ideal candidate competencies. Create 4 to 7 role competencies. Each competency must include a strong definition, a positive weight, a target_score between 1 and 5, 3 to 6 behavioral indicators, and 3 to 6 red flags. Use the supplied ideal talents, skills, and behaviors as evidence for what success should look like.",
      },
        {
          role: "user",
          content: serializeModelInput({
            role: {
              title: options.title,
              department: options.department,
              description: options.description,
            },
            ideal_candidate_competencies: {
              talents: options.talents,
              skills: options.skills,
              behaviors: options.behaviors,
            },
            instructions: {
              title: "Return the same role title unless the supplied title is clearly incomplete.",
              department: "Use the supplied department when available.",
              description: "Keep the description grounded in the supplied role information.",
              competencies:
                "Infer the strongest 4 to 7 role competencies from the supplied ideal competencies and role description.",
            },
          }),
        },
    ],
    text: {
      format: zodTextFormat(roleCompositeSchema, "generated_role_composite"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no generated role composite.");
  }

  return normalizeRoleComposite(response.output_parsed);
}

export async function generateRoleCompositeFromRoleProfile(options: {
  title: string;
  department: string | null;
  description: string;
  organizationalContext?: string | null;
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert organizational leadership architect. Generate a practical leadership role composite from the supplied role context. Create 4 to 7 role competencies. Each competency must include a strong definition, a positive weight, a target_score between 1 and 5, 3 to 6 behavioral indicators, and 3 to 6 red flags. Keep the description grounded in the supplied role and organizational context, and write with executive-level clarity.",
      },
      {
        role: "user",
        content: serializeModelInput({
          role: {
            title: options.title,
            department: options.department,
            description: options.description,
            organizational_context: options.organizationalContext ?? null,
          },
          instructions: {
            title: "Return the same role title unless the supplied title is clearly incomplete.",
            department: "Use the supplied department when available.",
            description:
              "Summarize the role in 2 to 5 sentences using the supplied role description and organizational context.",
            competencies:
              "Infer the strongest 4 to 7 leadership competencies from the supplied role context alone.",
          },
        }),
      },
    ],
    text: {
      format: zodTextFormat(roleCompositeSchema, "generated_role_composite"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no generated role composite.");
  }

  return normalizeRoleComposite(response.output_parsed);
}
