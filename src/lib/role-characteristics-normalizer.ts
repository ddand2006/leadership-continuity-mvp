import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { hasOpenAIEnv, getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";
import {
  type RoleCandidateCharacteristicInput,
  type RoleCharacteristicCategory,
} from "@/lib/role-characteristics";

const normalizedCharacteristicsSchema = z.object({
  items: z.array(
    z.object({
      category: z.enum(["talent", "skill", "behavior"]),
      characteristic: z.string().min(1),
    }),
  ),
});

function cleanCharacteristicText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*•\s*/g, " ")
    .trim();
}

function dedupeAndResequence(items: RoleCandidateCharacteristicInput[]) {
  const seen = new Set<string>();
  const nextSortOrder = new Map<RoleCharacteristicCategory, number>();

  return items.flatMap((item) => {
    const category = item.category;
    const characteristic = cleanCharacteristicText(item.characteristic);
    const key = `${category}:${characteristic.toLowerCase()}`;

    if (!characteristic || seen.has(key)) {
      return [];
    }

    seen.add(key);

    const sortOrder = nextSortOrder.get(category) ?? 0;
    nextSortOrder.set(category, sortOrder + 1);

    return [
      {
        category,
        characteristic,
        sort_order: sortOrder,
      },
    ];
  });
}

export async function normalizeRoleCandidateCharacteristics(
  items: RoleCandidateCharacteristicInput[],
) {
  const cleanedItems = dedupeAndResequence(items);

  if (cleanedItems.length === 0 || !hasOpenAIEnv()) {
    return cleanedItems;
  }

  try {
    const openAIEnv = getOpenAIEnv();
    const openai = createOpenAIClient();
    const response = await openai.responses.parse({
      model: openAIEnv.OPENAI_FAST_MODEL,
      input: [
        {
          role: "system",
          content:
            "You clean imported leadership competencies. Correct spelling, punctuation, and obvious OCR mistakes while preserving meaning. Do not expand them into longer phrases unless needed to fix a clear typo. Keep each item concise. Keep the supplied category exactly as provided.",
        },
        {
          role: "user",
          content: serializeModelInput({
            items: cleanedItems.map((item) => ({
              category: item.category,
              characteristic: item.characteristic,
            })),
          }),
        },
      ],
      text: {
        format: zodTextFormat(
          normalizedCharacteristicsSchema,
          "normalized_role_candidate_characteristics",
        ),
      },
    });

    if (!response.output_parsed) {
      return cleanedItems;
    }

    return dedupeAndResequence(
      response.output_parsed.items.map((item, index) => ({
        category: item.category,
        characteristic: item.characteristic,
        sort_order: index,
      })),
    );
  } catch (error) {
    console.error("Unable to normalize role candidate characteristics.", error);
    return cleanedItems;
  }
}
