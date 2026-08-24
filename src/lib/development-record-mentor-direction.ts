import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const generatedMentorDirectionSchema = z.object({
  narrative: z.string().trim().min(1).max(3000),
});

export type DevelopmentRecordMentorDirectionInput = {
  candidateName: string;
  targetRole: string;
  mentorName: string;
  experienceTitle: string;
  menteeTask: string;
  projectSummary: string;
  projectPurpose: string;
  workingGoal: string;
  whyItFits: string;
  mentorFocus: string;
  firstStep: string;
  leadershipActionsRequired: string[];
  successMeasures: string[];
  growthAreas: string[];
  selectedStrengths: Array<{
    themeName: string;
    rank: number;
    domain: string;
    helpDescription: string;
  }>;
};

export async function generateDevelopmentRecordMentorDirection(
  input: DevelopmentRecordMentorDirectionInput,
) {
  const response = await createOpenAIClient().responses.parse({
    model: getOpenAIEnv().OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert succession mentor. Create an actionable mentor-facing narrative for one candidate's real development project. Be specific, practical, and encouraging. Do not invent missing project facts. Explain how the candidate's named CliftonStrengths can be deliberately applied to complete the project while the mentor builds the named growth areas through coaching, stretch, observation, and reflection. Avoid generic HR language.",
      },
      {
        role: "user",
        content: serializeModelInput({
          candidate: input.candidateName,
          target_role: input.targetRole,
          mentor: input.mentorName,
          project: {
            title: input.experienceTitle,
            mentee_task: input.menteeTask,
            summary: input.projectSummary,
            purpose: input.projectPurpose,
            working_goal: input.workingGoal,
            why_it_fits: input.whyItFits,
            existing_mentor_focus: input.mentorFocus,
            first_step: input.firstStep,
            leadership_actions_required: input.leadershipActionsRequired,
            success_measures: input.successMeasures,
          },
          selected_growth_areas: input.growthAreas,
          strengths_to_apply: input.selectedStrengths,
          instructions:
            "Write 3 to 5 short paragraphs under 550 words. Start with the mentor's overall direction for this project. Then connect each named strength to a useful action in the project. Explain how the mentor should use the project to build the selected growth areas, including concrete coaching questions or checkpoints. Close with evidence the mentor should look for that shows both project progress and growth. Return prose only; do not include a title, greeting, or markdown bullets.",
        }),
      },
    ],
    text: {
      format: zodTextFormat(
        generatedMentorDirectionSchema,
        "development_record_mentor_direction",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no mentor direction.");
  }

  return response.output_parsed.narrative.trim();
}
