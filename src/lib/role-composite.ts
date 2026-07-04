import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";

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

function roundToHundredths(value: number) {
  return Number(value.toFixed(2));
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
        content: JSON.stringify(
          {
            file_name: options.fileName,
            composite_text: options.text,
            extraction_rules: {
              title: "Required",
              department: "Optional",
              description: "Summarize the role in 2 to 5 sentences",
              competencies:
                "Return the most important competencies with a definition, weight, target_score, behavioral_indicators, and red_flags",
            },
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: zodTextFormat(roleCompositeSchema, "role_composite"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed role composite.");
  }

  return normalizeRoleComposite(response.output_parsed);
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
        content: JSON.stringify(
          {
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
          },
          null,
          2,
        ),
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
