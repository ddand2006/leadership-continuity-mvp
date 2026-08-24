import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const generatedMentorDirectionSchema = z.object({
  narrative: z.string().trim().min(1).max(3000),
});

function hasCompleteEnding(narrative: string) {
  return /[.!?][\"')\]]?$/.test(narrative.trim());
}

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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await createOpenAIClient().responses.parse({
      model: getOpenAIEnv().OPENAI_MODEL,
      max_output_tokens: 1600,
      input: [
        {
          role: "system",
          content:
            "You are an expert succession mentor. Create an actionable mentor-facing narrative for one candidate's real development project. Use standard grammar, complete sentences, and polished professional language. Be specific, practical, and encouraging. Do not invent missing project facts. The mentor's role is to stretch the candidate toward meaningful growth, while providing enough support, guardrails, and checkpoints to avoid preventable failure. Explain how the candidate's named CliftonStrengths can be deliberately applied to complete the project while the mentor builds the named growth areas through coaching, stretch, observation, and reflection. Avoid generic HR language.",
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
              "Write a mentor-ready narrative under 425 words. Use short paragraphs and, when several actions or checkpoints are useful, a concise Markdown bullet list. Every bullet must be a complete grammatical sentence. Start with the mentor's overall direction for this project. Connect each named strength to a useful action in the project. Explain how the mentor should use the project to build the selected growth areas, including concrete coaching questions or checkpoints. State how the mentor can appropriately stretch the candidate while offering guardrails that turn challenge into growth rather than preventable failure. Close with evidence the mentor should look for that shows both project progress and growth. Finish with a complete sentence and final punctuation; never end mid-sentence or mid-list.",
            retry_instruction:
              attempt === 0
                ? undefined
                : "The prior response ended incompletely. Produce a fresh, concise response that ends with a complete, grammatically correct sentence.",
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

    const narrative = response.output_parsed?.narrative.trim();
    if (narrative && hasCompleteEnding(narrative)) {
      return narrative;
    }
  }

  throw new Error("OpenAI returned an incomplete mentor direction.");
}
