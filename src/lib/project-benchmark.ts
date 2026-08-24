import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const benchmarkProjectSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(3000),
  purpose: z.string().trim().max(1500),
  workingGoal: z.string().trim().max(1500),
  mentorFocus: z.string().trim().max(2000),
  firstStep: z.string().trim().max(1500),
  leadershipActions: z.array(z.string().trim().min(1).max(300)).max(10),
  successMeasures: z.array(z.string().trim().min(1).max(300)).max(10),
});

export type IndustryBenchmarkProject = z.infer<typeof benchmarkProjectSchema>;

export async function anonymizeProjectForIndustryBenchmark(input: unknown) {
  const response = await createOpenAIClient().responses.parse({
    model: getOpenAIEnv().OPENAI_FAST_MODEL,
    max_output_tokens: 1400,
    input: [
      {
        role: "system",
        content:
          "You anonymize leadership-development projects for a shared industry benchmark library. Remove or generalize every person name, company name, facility name, location, email, identifier, and uniquely identifying operational detail. Preserve only reusable leadership-development content. Never add facts.",
      },
      {
        role: "user",
        content: serializeModelInput({ project: input }),
      },
    ],
    text: { format: zodTextFormat(benchmarkProjectSchema, "industry_benchmark_project") },
  });

  if (!response.output_parsed) throw new Error("Unable to anonymize this project.");
  return response.output_parsed;
}
