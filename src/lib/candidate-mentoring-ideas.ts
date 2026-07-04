import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";

const generatedCandidateMentoringIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().min(1),
      project_type: z.enum(["departmental", "cross_departmental"]),
      purpose: z.string().min(1),
      description: z.string().min(1),
      working_goal: z.string().min(1),
      why_it_fits: z.string().min(1),
      strengths_application: z.string().min(1),
      mentor_focus: z.string().min(1),
      first_step: z.string().min(1),
      key_partners: z.array(z.string().min(1)).min(2).max(6),
      leadership_actions_required: z.array(z.string().min(1)).min(2).max(5),
      mentor_preparation: z.array(z.string().min(1)).min(2).max(4),
      mentee_preparation: z.array(z.string().min(1)).min(2).max(4),
      anticipated_challenges: z.array(z.string().min(1)).min(2).max(4),
      success_measures: z.array(z.string().min(1)).min(3).max(5),
      reflection_questions: z.array(z.string().min(1)).min(2).max(4),
      duration_days: z.number().int().min(14).max(120),
      success_signals: z.array(z.string().min(1)).min(2).max(4),
    }),
  ),
});

export type GeneratedCandidateMentoringIdea = z.infer<
  typeof generatedCandidateMentoringIdeasSchema
>["ideas"][number];

export async function generateCandidateMentoringIdeas(options: {
  candidate: {
    fullName: string;
    currentTitle: string | null;
    status: string;
  };
  role: {
    title: string;
    description: string | null;
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
  topStrengths: string[];
  supportingStrengths: string[];
  referenceIdeas: Array<{
    title: string;
    description: string;
    difficulty: string;
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
          "You are an expert organizational leadership mentor. Generate candidate-specific mentoring assignments for one competency gap. Make the ideas concrete, role-relevant, and shaped by the candidate's strengths. Do not simply repeat the reference library ideas. Use them only as inspiration. Each idea should feel personal to this candidate's readiness profile, current role, and strengths pattern. Structure every idea like a mentoring working document inspired by leadership development worksheets, not a short summary.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            candidate: options.candidate,
            target_role: options.role,
            competency_focus: options.competency,
            strengths_profile: {
              top_strengths: options.topStrengths,
              strengths_supporting_this_competency: options.supportingStrengths,
            },
            reference_library_ideas: options.referenceIdeas,
            instructions: {
              count: "Return exactly 3 ideas.",
              project_type:
                "Choose either departmental or cross_departmental based on the best learning experience for this candidate.",
              purpose:
                "Write a one-sentence purpose statement that sounds like a mentoring worksheet.",
              title:
                "Use specific, non-generic titles that sound like real mentoring assignments.",
              description:
                "Describe a practical stretch assignment or project in 1 to 2 sentences.",
              working_goal:
                "State the concrete improvement, project, or leadership outcome the mentee should own.",
              why_it_fits:
                "Explain why this idea fits this candidate specifically, considering strengths, readiness, and competency gap.",
              strengths_application:
                "Explain clearly how the candidate should use their specific strengths to succeed in this assignment.",
              mentor_focus:
                "Describe what the mentor should watch, coach, or reinforce.",
              first_step:
                "Give a strong first action the candidate can take within the next week.",
              key_partners:
                "List the departments, leaders, or partners the mentee should work with.",
              leadership_actions_required:
                "List 2 to 5 leadership actions this assignment requires, written like observable leadership behaviors.",
              mentor_preparation:
                "List what the mentor should do to prepare or frame this assignment well.",
              mentee_preparation:
                "List what the mentee should prepare, reflect on, or gather before or during the work.",
              anticipated_challenges:
                "List the likely stretch points or obstacles the mentee will face.",
              success_measures:
                "List 3 to 5 measurable or observable outcomes that show the project worked.",
              reflection_questions:
                "List 2 to 4 mentor-and-mentee reflection prompts for debriefing the assignment.",
              duration_days:
                "Choose a realistic duration between 14 and 120 days.",
              success_signals:
                "Return 2 to 4 observable signs that the mentoring assignment is working.",
            },
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: zodTextFormat(
        generatedCandidateMentoringIdeasSchema,
        "candidate_mentoring_ideas",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no candidate mentoring ideas.");
  }

  return response.output_parsed.ideas.map((idea) => ({
    ...idea,
    title: idea.title.trim(),
    purpose: idea.purpose.trim(),
    description: idea.description.trim(),
    working_goal: idea.working_goal.trim(),
    why_it_fits: idea.why_it_fits.trim(),
    strengths_application: idea.strengths_application.trim(),
    mentor_focus: idea.mentor_focus.trim(),
    first_step: idea.first_step.trim(),
    key_partners: idea.key_partners.map((item) => item.trim()),
    leadership_actions_required: idea.leadership_actions_required.map((item) =>
      item.trim(),
    ),
    mentor_preparation: idea.mentor_preparation.map((item) => item.trim()),
    mentee_preparation: idea.mentee_preparation.map((item) => item.trim()),
    anticipated_challenges: idea.anticipated_challenges.map((item) => item.trim()),
    success_measures: idea.success_measures.map((item) => item.trim()),
    reflection_questions: idea.reflection_questions.map((item) => item.trim()),
    success_signals: idea.success_signals.map((signal) => signal.trim()),
  }));
}
