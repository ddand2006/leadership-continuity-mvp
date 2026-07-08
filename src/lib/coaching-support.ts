import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

export const coachingChallengeAreas = [
  "team_conflict",
  "retention",
  "delegation",
  "communication",
  "burnout",
  "accountability",
  "culture_change",
  "change_management",
  "physician_alignment",
  "strategic_priorities",
  "performance",
  "other",
] as const;

export const coachingUrgencies = ["low", "medium", "high"] as const;
export const coachingSupportPaths = [
  "ai_guidance",
  "coach_request",
  "both",
] as const;
export const coachingStatuses = [
  "new",
  "ai_guidance_ready",
  "coach_requested",
  "in_review",
  "coach_matched",
  "closed",
] as const;

export const coachingChallengeAreaSchema = z.enum(coachingChallengeAreas);
export const coachingUrgencySchema = z.enum(coachingUrgencies);
export const coachingSupportPathSchema = z.enum(coachingSupportPaths);
export const coachingStatusSchema = z.enum(coachingStatuses);

const coachingGuidanceSchema = z.object({
  situation_summary: z.string().min(1),
  likely_root_causes: z.array(z.string().min(1)).min(2).max(4),
  first_actions: z.array(z.string().min(1)).min(3).max(5),
  coaching_prompts: z.array(z.string().min(1)).min(3).max(5),
  thirty_day_plan: z.array(z.string().min(1)).min(3).max(5),
  risks_to_watch: z.array(z.string().min(1)).min(2).max(4),
  when_to_seek_human_coach: z.string().min(1),
  recommended_coach_profile: z.string().min(1),
});

export type CoachingGuidance = z.infer<typeof coachingGuidanceSchema>;

export type CoachingRequestRecord = {
  id: string;
  requester_profile_id: string;
  challenge_area: z.infer<typeof coachingChallengeAreaSchema>;
  challenge_title: string;
  challenge_summary: string;
  organizational_context: string | null;
  desired_outcome: string | null;
  urgency: z.infer<typeof coachingUrgencySchema>;
  support_path: z.infer<typeof coachingSupportPathSchema>;
  status: z.infer<typeof coachingStatusSchema>;
  ai_guidance: CoachingGuidance | Record<string, never> | null;
  ai_generated_at: string | null;
  assigned_coach_name: string | null;
  internal_notes: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getCoachingChallengeAreaLabel(
  value: z.infer<typeof coachingChallengeAreaSchema>,
) {
  const labels: Record<z.infer<typeof coachingChallengeAreaSchema>, string> = {
    team_conflict: "Team conflict",
    retention: "Retention",
    delegation: "Delegation",
    communication: "Communication",
    burnout: "Burnout",
    accountability: "Accountability",
    culture_change: "Culture change",
    change_management: "Change management",
    physician_alignment: "Stakeholder alignment",
    strategic_priorities: "Strategic priorities",
    performance: "Performance",
    other: "Other",
  };

  return labels[value];
}

export function getCoachingUrgencyLabel(
  value: z.infer<typeof coachingUrgencySchema>,
) {
  const labels: Record<z.infer<typeof coachingUrgencySchema>, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };

  return labels[value];
}

export function getCoachingSupportPathLabel(
  value: z.infer<typeof coachingSupportPathSchema>,
) {
  const labels: Record<z.infer<typeof coachingSupportPathSchema>, string> = {
    ai_guidance: "AI guidance",
    coach_request: "Coach request",
    both: "AI guidance + coach request",
  };

  return labels[value];
}

export function getCoachingStatusLabel(
  value: z.infer<typeof coachingStatusSchema>,
) {
  const labels: Record<z.infer<typeof coachingStatusSchema>, string> = {
    new: "New",
    ai_guidance_ready: "AI guidance ready",
    coach_requested: "Coach requested",
    in_review: "In review",
    coach_matched: "Coach matched",
    closed: "Closed",
  };

  return labels[value];
}

export function getInitialCoachingStatus(
  supportPath: z.infer<typeof coachingSupportPathSchema>,
  hasGuidance: boolean,
): z.infer<typeof coachingStatusSchema> {
  if (supportPath === "coach_request" || supportPath === "both") {
    return "coach_requested";
  }

  if (hasGuidance) {
    return "ai_guidance_ready";
  }

  return "new";
}

export function parseCoachingGuidance(
  value: unknown,
): CoachingGuidance | Record<string, never> {
  const parsed = coachingGuidanceSchema.safeParse(value);
  if (!parsed.success) {
    return {};
  }

  return {
    situation_summary: sanitizeAppText(parsed.data.situation_summary),
    likely_root_causes: sanitizeAppTextList(parsed.data.likely_root_causes),
    first_actions: sanitizeAppTextList(parsed.data.first_actions),
    coaching_prompts: sanitizeAppTextList(parsed.data.coaching_prompts),
    thirty_day_plan: sanitizeAppTextList(parsed.data.thirty_day_plan),
    risks_to_watch: sanitizeAppTextList(parsed.data.risks_to_watch),
    when_to_seek_human_coach: sanitizeAppText(
      parsed.data.when_to_seek_human_coach,
    ),
    recommended_coach_profile: sanitizeAppText(
      parsed.data.recommended_coach_profile,
    ),
  };
}

export function isMissingCoachingRequestsTableError(error: { message: string } | null) {
  return Boolean(error?.message.includes("coaching_requests"));
}

export async function generateLeadershipCoachingGuidance(options: {
  organizationName: string;
  requesterName: string;
  challengeArea: z.infer<typeof coachingChallengeAreaSchema>;
  challengeTitle: string;
  challengeSummary: string;
  organizationalContext: string | null;
  desiredOutcome: string | null;
  urgency: z.infer<typeof coachingUrgencySchema>;
  supportPath: z.infer<typeof coachingSupportPathSchema>;
}) {
  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_FAST_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are an experienced executive coach helping organizational leaders think clearly about current workplace challenges. Give practical, calm, action-oriented guidance. Do not diagnose mental health conditions. Focus on leadership behavior, communication, decision-making, and organizational follow-through.",
      },
      {
        role: "user",
        content: serializeModelInput({
          organization_name: options.organizationName,
          requester_name: options.requesterName,
          challenge_area: getCoachingChallengeAreaLabel(options.challengeArea),
          challenge_title: options.challengeTitle,
          challenge_summary: options.challengeSummary,
          organizational_context: options.organizationalContext,
          desired_outcome: options.desiredOutcome,
          urgency: getCoachingUrgencyLabel(options.urgency),
          support_requested: getCoachingSupportPathLabel(options.supportPath),
          instructions: {
            situation_summary:
              "Write a short, clear summary of the leadership challenge in plain language.",
            likely_root_causes:
              "List 2 to 4 likely organizational or leadership causes that may be contributing.",
            first_actions:
              "List 3 to 5 practical actions the leader can take this week.",
            coaching_prompts:
              "List 3 to 5 reflection or conversation prompts the leader should use.",
            thirty_day_plan:
              "List 3 to 5 concrete next steps for the next 30 days.",
            risks_to_watch:
              "List 2 to 4 risks or mistakes that could make the situation worse.",
            when_to_seek_human_coach:
              "Explain when a human coach would be especially helpful here.",
            recommended_coach_profile:
              "Describe the kind of coach or advisor who would be the best match for this situation.",
          },
        }),
      },
    ],
    text: {
      format: zodTextFormat(
        coachingGuidanceSchema,
        "leadership_coaching_guidance",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no coaching guidance.");
  }

  return parseCoachingGuidance(response.output_parsed);
}
