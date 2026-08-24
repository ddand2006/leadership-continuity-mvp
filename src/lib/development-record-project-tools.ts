import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const list = z.array(z.string().trim().min(1).max(300)).max(10);
const expandedProjectSchema = z.object({
  projectSummary: z.string().trim().min(1).max(3000), projectPurpose: z.string().trim().max(1500),
  workingGoal: z.string().trim().max(1500), whyItFits: z.string().trim().max(2000),
  mentorFocus: z.string().trim().max(2000), firstStep: z.string().trim().max(1500),
  keyPartners: list, leadershipActionsRequired: list, anticipatedChallenges: list,
  successMeasures: list, mentorPreparation: list, menteePreparation: list,
  reflectionQuestions: list, successSignals: list,
});
export type ExpandedProject = z.infer<typeof expandedProjectSchema>;

const worksheetSchema = z.object({
  assignmentSummary: z.string().trim().min(1).max(1500),
  firstSteps: list, weeklyCheckpoints: list, reportBackPrompts: list, reflectionQuestions: list,
});
export type GeneratedMenteeWorksheet = z.infer<typeof worksheetSchema>;

async function generate<T extends z.ZodType>(schema: T, name: string, system: string, input: unknown) {
  const response = await createOpenAIClient().responses.parse({
    model: getOpenAIEnv().OPENAI_MODEL, max_output_tokens: 1800,
    input: [{ role: "system", content: system }, { role: "user", content: serializeModelInput(input) }],
    text: { format: zodTextFormat(schema, name) },
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no project content.");
  return response.output_parsed;
}

export function expandManualDevelopmentProject(input: unknown) {
  return generate(expandedProjectSchema, "expanded_manual_development_project", "You are an executive development designer. Expand a manually entered development project into clear, practical fields. Use only supplied facts, write plain professional language, and make the project appropriately challenging with mentor guardrails.", input);
}
export function generateMenteeWorksheet(input: unknown) {
  return generate(worksheetSchema, "mentee_project_worksheet", "You create a concise, practical worksheet for a mentee. Clearly state what they were assigned, immediate actions, weekly checkpoints, and notes they should bring back to the mentor. Use complete sentences and do not invent facts.", input);
}
