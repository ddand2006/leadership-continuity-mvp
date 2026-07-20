import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const generatedCandidateCoachingNarrativeSchema = z.object({
  progress_over_time: z.string().min(1),
  strengths_application: z.string().min(1),
  mentor_guidance: z.string().min(1),
  suggested_projects: z.array(z.string().min(1)).min(3).max(5),
  coaching_checkpoints: z.array(z.string().min(1)).min(3).max(5),
});

export type GeneratedCandidateCoachingNarrative = z.infer<
  typeof generatedCandidateCoachingNarrativeSchema
>;

export async function generateCandidateCoachingNarrative(options: {
  candidate: {
    fullName: string;
    currentTitle: string | null;
    status: string;
  };
  role: {
    title: string;
    description: string | null;
    industry?: string | null;
  };
  competency: {
    name: string;
    definition: string | null;
    targetScore: number;
    averageScore: number;
    interviewScore: number | null;
    strengthsScore: number | null;
    weightedGap: number;
    status: string;
    evidenceNotes: string[];
    concernNotes: string[];
    strengthsRationale: string | null;
    supportingStrengths: string[];
    behavioralIndicators: string[];
    redFlags: string[];
  };
  scoreHistory: Array<{
    panelName: string;
    dateCompleted: string | null;
    scoreNumeric: number;
    evidenceNotes: string | null;
    concernNotes: string | null;
  }>;
  topStrengths: string[];
  supportingStrengths: string[];
  referenceIdeas: Array<{
    title: string;
    description: string;
    difficulty: string;
    industry?: string | null;
    durationDays: number;
    expectedOutcomes: string[];
    mentorQuestions: string[];
  }>;
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert executive coach and succession mentor. Write a coaching document for a leader mentoring an internal candidate against one leadership competency. Use the candidate's score progression over time, strengths profile, competency expectations, and interview evidence. The tone should be practical, encouraging, and candid. Focus on how the mentor can help the candidate improve, not on generic HR language.",
      },
        {
          role: "user",
          content: serializeModelInput({
            candidate: options.candidate,
            target_role: options.role,
            organization_context: {
              industry: options.role.industry,
            },
            competency_focus: options.competency,
            score_history: options.scoreHistory,
            strengths_profile: {
              top_strengths: options.topStrengths,
              strengths_supporting_this_competency: options.supportingStrengths,
            },
            reference_project_ideas: options.referenceIdeas,
            instructions: {
              progress_over_time:
                "Write one paragraph that explains how this competency score has changed across interview rounds, what the trend suggests, how far the candidate is from the role goal, and what should matter most next.",
              strengths_application:
                "Write one paragraph explaining how the candidate can use their strengths to close the gap in this competency. Be specific about the strengths named in the input and how each can help in practice.",
              mentor_guidance:
                "Write one paragraph for the mentoring leader explaining how to coach this candidate in this competency, including where to challenge, where to support, and what habits to reinforce.",
              suggested_projects:
                "Return 3 to 5 bullet-friendly project or stretch-assignment ideas tailored to this competency gap, written as concise action phrases rather than full paragraphs.",
              coaching_checkpoints:
                "Return 3 to 5 bullet-friendly checkpoints the mentor can use to monitor progress over the next few weeks or months.",
            },
          }),
        },
    ],
    text: {
      format: zodTextFormat(
        generatedCandidateCoachingNarrativeSchema,
        "candidate_coaching_narrative",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no coaching narrative.");
  }

  return {
    progress_over_time: response.output_parsed.progress_over_time.trim(),
    strengths_application: response.output_parsed.strengths_application.trim(),
    mentor_guidance: response.output_parsed.mentor_guidance.trim(),
    suggested_projects: response.output_parsed.suggested_projects.map((item) =>
      item.trim(),
    ),
    coaching_checkpoints: response.output_parsed.coaching_checkpoints.map((item) =>
      item.trim(),
    ),
  };
}
