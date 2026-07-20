import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

const generatedDevelopmentPlanSchema = z.object({
  plans: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      difficulty: z.enum(["foundational", "intermediate", "advanced"]),
      duration_days: z.number().int().min(14).max(180),
      competencies_developed: z.array(z.string().min(1)).min(1).max(3),
      strengths_leveraged: z.array(z.string().min(1)).min(1).max(5),
      expected_outcomes: z.array(z.string().min(1)).min(2).max(4),
      mentor_questions: z.array(z.string().min(1)).min(2).max(4),
      evidence_of_success: z.array(z.string().min(1)).min(2).max(4),
    }),
  ),
});

export type GeneratedDevelopmentPlanSet = z.infer<
  typeof generatedDevelopmentPlanSchema
>;

function normalizeList(items: string[]) {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter((item) => item.length > 0)),
  );
}

export async function generateDevelopmentPlansForRole(options: {
  role: {
    title: string;
    department: string | null;
    description: string | null;
    industry: string | null;
  };
  competencies: Array<{
    name: string;
    definition: string | null;
    behavioral_indicators: string[] | null;
    red_flags: string[] | null;
    target_score: number;
    weight: number;
  }>;
  strengthsLibrary: Array<{
    theme_name: string;
    domain: string;
    leadership_advantages: string;
    development_uses: string;
  }>;
  existingTitles: string[];
  count: number;
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert organizational leadership development designer. Generate practical mentoring project ideas for a leadership succession platform. Each idea must be concrete, workplace-based, and appropriate for a mentor-guided stretch assignment. Use the supplied role competencies exactly when naming competencies_developed. Use only Gallup strengths from the supplied strengths library when naming strengths_leveraged. Avoid duplicating existing project titles.",
      },
        {
          role: "user",
          content: serializeModelInput({
            role: options.role,
            target_plan_count: options.count,
            organization_context: {
              industry: options.role.industry,
            },
            role_competencies: options.competencies,
            strengths_library: options.strengthsLibrary,
            existing_project_titles: options.existingTitles,
            instructions: {
              title:
                "Create a distinct, action-oriented title for each project.",
              description:
                "Write a specific 1 to 2 sentence description grounded in organizational leadership work.",
              difficulty:
                "Choose foundational, intermediate, or advanced based on the complexity and visibility of the assignment.",
              duration_days:
                "Choose a practical whole-number duration between 14 and 180 days.",
              competencies_developed:
                "Return 1 to 3 competency names using exact competency names from the supplied role_competencies list.",
              strengths_leveraged:
                "Return 1 to 5 Gallup strengths that would help the candidate succeed in the assignment.",
              expected_outcomes:
                "Return 2 to 4 visible outputs or results a mentor could review.",
              mentor_questions:
                "Return 2 to 4 mentor prompts that would help guide reflection and accountability.",
              evidence_of_success:
                "Return 2 to 4 observable indicators that the assignment was completed well.",
            },
          }),
        },
    ],
    text: {
      format: zodTextFormat(
        generatedDevelopmentPlanSchema,
        "generated_development_plans",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no development plans.");
  }

  return response.output_parsed.plans.map((plan) => ({
    ...plan,
    title: plan.title.trim(),
    description: plan.description.trim(),
    competencies_developed: normalizeList(plan.competencies_developed),
    strengths_leveraged: normalizeList(plan.strengths_leveraged),
    expected_outcomes: normalizeList(plan.expected_outcomes),
    mentor_questions: normalizeList(plan.mentor_questions),
    evidence_of_success: normalizeList(plan.evidence_of_success),
  }));
}
