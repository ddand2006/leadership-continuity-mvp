import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const aiTrainingMappingsSchema = z.object({
  mappings: z.array(z.object({
    competencyName: z.string().min(1),
    strength: z.enum(["strong", "moderate", "supporting"]),
    explanation: z.string().min(1).max(320),
  })).max(20),
});

export type TrainingCompetencyOption = {
  name: string;
  definition: string | null;
};

export async function generateTrainingProgramMappings(options: {
  program: { name: string; provider: string; description: string; deliveryFormat: string; intendedAudience: string };
  competencies: TrainingCompetencyOption[];
}) {
  const openai = createOpenAIClient();
  const env = getOpenAIEnv();
  const response = await openai.responses.parse({
    model: env.OPENAI_FAST_MODEL,
    input: [
      {
        role: "system",
        content: "You are a careful leadership-development analyst. Map a training program only to organization competencies it genuinely develops. Do not infer a match from a vague association or from a role title. Return no more than 20 mappings. Prefer a smaller, high-confidence set. Strong means the program directly teaches or practices the competency; moderate means it materially supports it; supporting means it reinforces it as a secondary outcome. Use a concise, program-specific rationale. Use competency names exactly as supplied.",
      },
      {
        role: "user",
        content: serializeModelInput({
          trainingProgram: options.program,
          organizationCompetencies: options.competencies,
        }),
      },
    ],
    text: { format: zodTextFormat(aiTrainingMappingsSchema, "training_program_competency_mappings") },
  });

  const allowedCompetencies = new Map(
    options.competencies.map((competency) => [competency.name.trim().toLowerCase(), competency.name]),
  );
  const uniqueMappings = new Map<string, z.infer<typeof aiTrainingMappingsSchema>["mappings"][number]>();

  for (const mapping of response.output_parsed?.mappings ?? []) {
    const exactName = allowedCompetencies.get(mapping.competencyName.trim().toLowerCase());
    if (exactName && !uniqueMappings.has(exactName)) {
      uniqueMappings.set(exactName, { ...mapping, competencyName: exactName });
    }
  }

  return Array.from(uniqueMappings.values());
}
