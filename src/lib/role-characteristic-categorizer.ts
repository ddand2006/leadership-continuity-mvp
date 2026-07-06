import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv, hasOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";
import type { RoleCharacteristicCategory } from "@/lib/role-characteristics";

const categorizedCharacteristicSchema = z.object({
  category: z.enum(["talent", "skill", "behavior"]),
  characteristic: z.string().min(1),
});

function cleanCharacteristic(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/^[\s\-*•\d.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scorePatterns(value: string, patterns: RegExp[]) {
  return patterns.reduce(
    (score, pattern) => score + (pattern.test(value) ? 1 : 0),
    0,
  );
}

function guessRoleCharacteristicCategory(
  characteristic: string,
): RoleCharacteristicCategory {
  const normalized = characteristic.toLowerCase();

  const behaviorScore = scorePatterns(normalized, [
    /^ability to\b/,
    /^willingness to\b/,
    /^builds?\b/,
    /^communicates?\b/,
    /^works?\b/,
    /^coaches?\b/,
    /^collaborates?\b/,
    /^demonstrates?\b/,
    /^holds?\b/,
    /^leads?\b/,
    /^listens?\b/,
    /^owns?\b/,
    /^receives?\b/,
    /\bunder pressure\b/,
    /\bwith accountability\b/,
    /\bwith others\b/,
  ]);

  const skillScore = scorePatterns(normalized, [
    /\bknowledge\b/,
    /\bexperience\b/,
    /\btraining\b/,
    /\bcertification\b/,
    /\bplanning\b/,
    /\bfinance\b/,
    /\bfinancial\b/,
    /\boperations?\b/,
    /\bcompliance\b/,
    /\bhipaa\b/,
    /\bimplementation\b/,
    /\bproject management\b/,
    /\bstrategic\b/,
    /\banalytical\b/,
    /\breview contracts?\b/,
    /\bconstruction management\b/,
    /\bdegree\b/,
  ]);

  const talentScore = scorePatterns(normalized, [
    /\badaptable\b/,
    /\barranger\b/,
    /\bachiever\b/,
    /\bbelief\b/,
    /\bdeveloper\b/,
    /\bdiscipline\b/,
    /\bemotional intelligence\b/,
    /\bempathetic?\b/,
    /\bfuturistic\b/,
    /\bgood listener\b/,
    /\bhumble\b/,
    /\bhumility\b/,
    /\bindividualization\b/,
    /\bintellect(ion)?\b/,
    /\blearner\b/,
    /\bpositiv(e|ity)\b/,
    /\bresilient\b/,
    /\bself-aware\b/,
    /\bself awareness\b/,
    /\bstrong judgment\b/,
  ]);

  if (behaviorScore >= skillScore && behaviorScore >= talentScore && behaviorScore > 0) {
    return "behavior";
  }

  if (skillScore >= talentScore && skillScore > 0) {
    return "skill";
  }

  return "talent";
}

export async function categorizeRoleCharacteristic(input: string) {
  const cleaned = cleanCharacteristic(input);

  if (!cleaned) {
    throw new Error("Add a competency before categorizing it.");
  }

  if (!hasOpenAIEnv()) {
    return {
      category: guessRoleCharacteristicCategory(cleaned),
      characteristic: cleaned,
    };
  }

  try {
    const openai = createOpenAIClient();
    const openAIEnv = getOpenAIEnv();
    const response = await openai.responses.parse({
      model: openAIEnv.OPENAI_FAST_MODEL,
      input: [
        {
          role: "system",
          content:
            "Classify a single leadership competency into one category: talent, skill, or behavior. A talent is a natural tendency, trait, or recurring strength. A skill is a learned capability, area of knowledge, or technical/professional ability. A behavior is an observable action or way of showing up at work. Correct obvious spelling or OCR mistakes, keep the phrase concise, and return only the corrected competency in the best-fit category.",
        },
        {
          role: "user",
          content: cleaned,
        },
      ],
      text: {
        format: zodTextFormat(
          categorizedCharacteristicSchema,
          "categorized_role_characteristic",
        ),
      },
    });

    if (response.output_parsed) {
      return {
        category: response.output_parsed.category,
        characteristic: cleanCharacteristic(response.output_parsed.characteristic),
      };
    }
  } catch (error) {
    console.error("Unable to categorize role characteristic.", error);
  }

  return {
    category: guessRoleCharacteristicCategory(cleaned),
    characteristic: cleaned,
  };
}
