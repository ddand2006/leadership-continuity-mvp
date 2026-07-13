import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";
import type { RoleComposite } from "@/lib/role-composite";

export const personalLeadershipNarrativeSchema = z.object({
  professional_summary: z.string().min(1),
  leadership_style: z.string().min(1),
  communication_style: z.string().min(1),
  decision_making_style: z.string().min(1),
  success_characteristics: z.array(z.string().min(1)).min(3).max(7),
  blind_spots: z.array(z.string().min(1)).min(3).max(7),
  leadership_expectations: z.array(z.string().min(1)).min(3).max(7),
  ideal_behaviors: z.array(z.string().min(1)).min(4).max(8),
  strengths_to_leverage: z.array(z.string().min(1)).min(3).max(7),
  development_watchouts: z.array(z.string().min(1)).min(3).max(7),
});

export type PersonalLeadershipNarrative = z.infer<
  typeof personalLeadershipNarrativeSchema
>;

function trimList(items: string[]) {
  return items.map((item) => item.trim());
}

export async function generatePersonalLeadershipNarrative(options: {
  role: {
    title: string;
    department: string | null;
    description: string;
  };
  personalContext: {
    currentPositionTitle: string | null;
    yearsInRole: number | null;
    leadershipHistory: string | null;
    organizationalContext: string | null;
  };
  composite: RoleComposite;
  evidence: {
    generation_mode: string;
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  strengths: string[];
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an expert executive coach and leadership architect. Write a practical personal leadership narrative for one leader's development workspace. Base it on the supplied role profile, organizational context, structured role composite, and any available strengths. Be clear, candid, encouraging, and specific. Use concise business language. Return short paragraphs for prose fields and bullet-friendly phrases for list fields.",
      },
      {
        role: "user",
        content: serializeModelInput({
          role: options.role,
          personal_context: options.personalContext,
          structured_composite: options.composite,
          source_evidence: options.evidence,
          strengths_on_file: options.strengths,
          instructions: {
            professional_summary:
              "Write one paragraph that explains what success in this role requires and how this leader should frame their growth in it.",
            leadership_style:
              "Write one paragraph describing the leadership style that best fits this role and context.",
            communication_style:
              "Write one paragraph describing how this leader should communicate to be effective in this role.",
            decision_making_style:
              "Write one paragraph describing the decision-making approach this role requires.",
            success_characteristics:
              "Return 3 to 7 concise traits or success characteristics that should consistently show up in this role.",
            blind_spots:
              "Return 3 to 7 concise blind spots, risks, or failure patterns to watch for in this role.",
            leadership_expectations:
              "Return 3 to 7 concise expectations other leaders, teams, and stakeholders are likely to have of this role.",
            ideal_behaviors:
              "Return 4 to 8 concise, observable behaviors that represent strong day-to-day execution in this role.",
            strengths_to_leverage:
              "Return 3 to 7 concise leverage points. If strengths are supplied, incorporate them directly. If not, infer likely leverage areas from the role.",
            development_watchouts:
              "Return 3 to 7 concise development watchouts or coaching priorities for this leader.",
          },
        }),
      },
    ],
    text: {
      format: zodTextFormat(
        personalLeadershipNarrativeSchema,
        "personal_leadership_narrative",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no personal leadership narrative.");
  }

  return {
    professional_summary: response.output_parsed.professional_summary.trim(),
    leadership_style: response.output_parsed.leadership_style.trim(),
    communication_style: response.output_parsed.communication_style.trim(),
    decision_making_style: response.output_parsed.decision_making_style.trim(),
    success_characteristics: trimList(
      response.output_parsed.success_characteristics,
    ),
    blind_spots: trimList(response.output_parsed.blind_spots),
    leadership_expectations: trimList(
      response.output_parsed.leadership_expectations,
    ),
    ideal_behaviors: trimList(response.output_parsed.ideal_behaviors),
    strengths_to_leverage: trimList(
      response.output_parsed.strengths_to_leverage,
    ),
    development_watchouts: trimList(
      response.output_parsed.development_watchouts,
    ),
  };
}
