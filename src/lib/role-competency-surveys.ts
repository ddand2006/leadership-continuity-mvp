import { z } from "zod";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

export const roleSurveyStatuses = ["draft", "active", "closed"] as const;
export const roleSurveyRecipientStatuses = [
  "pending",
  "opened",
  "completed",
] as const;

export const roleSurveyStatusSchema = z.enum(roleSurveyStatuses);
export const roleSurveyRecipientStatusSchema = z.enum(
  roleSurveyRecipientStatuses,
);

export const ROLE_SURVEY_QUESTION_KEYS = [
  "essential_knowledge",
  "critical_skills",
  "organizational_presence",
  "development_priorities",
] as const;

export type RoleSurveyQuestionKey = (typeof ROLE_SURVEY_QUESTION_KEYS)[number];

export type RoleSurveyQuestionDefinition = {
  key: RoleSurveyQuestionKey;
  shortLabel: string;
  prompt: string;
  helpText: string;
};

export const roleSurveyQuestionDefinitions: RoleSurveyQuestionDefinition[] = [
  {
    key: "essential_knowledge",
    shortLabel: "Knowledge and judgment",
    prompt:
      "What does someone in this role need to know to do the job well and make strong decisions?",
    helpText:
      "Include technical knowledge, judgment, business context, regulations, and the realities of how the work gets done.",
  },
  {
    key: "critical_skills",
    shortLabel: "Skills and capabilities",
    prompt:
      "What skills or capabilities matter most for succeeding in this role?",
    helpText:
      "Think about leadership, operational, communication, strategic, financial, and people-development skills.",
  },
  {
    key: "organizational_presence",
    shortLabel: "Leadership presence and relationships",
    prompt:
      "How should someone in this role show up with people across the organization when they are operating at a high level?",
    helpText:
      "Describe traits, communication style, collaboration, accountability, influence, and how others experience this leader day to day.",
  },
  {
    key: "development_priorities",
    shortLabel: "Success factors and watchouts",
    prompt:
      "What most clearly signals success in this role, and what common blind spots or development priorities should we watch for?",
    helpText:
      "Include outcomes, behaviors, red flags, and the biggest areas to develop when preparing someone for the role.",
  },
];

const responseAnswerSchema = z.string().trim().min(1).max(6000);

export const roleSurveyResponsePayloadSchema = z.object({
  essential_knowledge: responseAnswerSchema,
  critical_skills: responseAnswerSchema,
  organizational_presence: responseAnswerSchema,
  development_priorities: responseAnswerSchema,
});

export type RoleSurveyResponsePayload = z.infer<
  typeof roleSurveyResponsePayloadSchema
>;

export const roleSurveySummarySchema = z.object({
  synthesized_role_statement: z.string().min(1),
  recurring_themes: z.array(z.string().min(1)).min(3).max(10),
  inferred_competencies: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.enum(["knowledge", "skill", "behavior", "trait"]),
        rationale: z.string().min(1),
      }),
    )
    .min(3)
    .max(15),
  collaboration_expectations: z.array(z.string().min(1)).min(2).max(8),
  development_watchouts: z.array(z.string().min(1)).min(2).max(8),
  interview_focus_areas: z.array(z.string().min(1)).min(3).max(10),
});

export type RoleSurveySummary = z.infer<typeof roleSurveySummarySchema>;

export type RoleSurveyRecord = {
  id: string;
  organization_id: string;
  role_id: string;
  title: string;
  description: string | null;
  intro_message: string | null;
  thank_you_message: string | null;
  status: z.infer<typeof roleSurveyStatusSchema>;
  created_by_profile_id: string | null;
  updated_by_profile_id: string | null;
  launched_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleSurveyRecipientRecord = {
  id: string;
  organization_id: string;
  survey_id: string;
  recipient_name: string;
  recipient_email: string;
  recipient_title: string | null;
  relationship_to_role: string | null;
  access_token: string;
  status: z.infer<typeof roleSurveyRecipientStatusSchema>;
  invited_by_profile_id: string | null;
  invited_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleSurveyResponseRecord = {
  id: string;
  organization_id: string;
  survey_id: string;
  recipient_id: string;
  response_json: RoleSurveyResponsePayload;
  normalized_competencies: string[];
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type RoleSurveySummaryRecord = {
  id: string;
  organization_id: string;
  survey_id: string;
  source_response_count: number;
  summary_json: RoleSurveySummary | Record<string, never>;
  generated_by_profile_id: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getRoleSurveyStatusLabel(
  value: z.infer<typeof roleSurveyStatusSchema>,
) {
  switch (value) {
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "closed":
      return "Closed";
  }
}

export function getRoleSurveyRecipientStatusLabel(
  value: z.infer<typeof roleSurveyRecipientStatusSchema>,
) {
  switch (value) {
    case "pending":
      return "Pending";
    case "opened":
      return "Opened";
    case "completed":
      return "Completed";
  }
}

export function createDefaultRoleSurveyTitle(roleTitle: string) {
  const cleanRoleTitle = sanitizeAppText(roleTitle) || "Role";
  return `${cleanRoleTitle} competency survey`;
}

export function getDefaultRoleSurveyIntroMessage(roleTitle: string) {
  const cleanRoleTitle = sanitizeAppText(roleTitle) || "this role";
  return `Please answer the questions below based on what success really looks like in ${cleanRoleTitle}. Your perspective will help us identify the competencies, behaviors, and leadership traits that matter most.`;
}

export function getDefaultRoleSurveyThankYouMessage() {
  return "Thank you. Your input has been recorded and will be used to strengthen the role profile.";
}

function cleanSurveyPhrase(value: string) {
  return sanitizeAppText(value)
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.:,;]+$/, "")
    .trim();
}

function extractSurveyPhrasesFromAnswer(value: string) {
  const parts = sanitizeAppText(value)
    .split(/\n|;|•|·/g)
    .flatMap((part) =>
      part.length <= 120 ? part.split(/,(?![^()]*\))/g) : [part],
    )
    .map((part) => cleanSurveyPhrase(part))
    .filter(Boolean);

  return parts.filter((part) => {
    const wordCount = part.split(/\s+/).filter(Boolean).length;

    return (
      part.length >= 3 &&
      part.length <= 80 &&
      wordCount <= 10 &&
      !/[?!]/.test(part)
    );
  });
}

export function extractRoleSurveyNormalizedCompetencies(
  payload: RoleSurveyResponsePayload,
) {
  const seen = new Set<string>();

  return ROLE_SURVEY_QUESTION_KEYS.flatMap((key) =>
    extractSurveyPhrasesFromAnswer(payload[key]),
  ).filter((item) => {
    const normalized = item.toLowerCase();

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

export function parseRoleSurveyResponsePayload(
  value: unknown,
): RoleSurveyResponsePayload | null {
  const parsed = roleSurveyResponsePayloadSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return {
    essential_knowledge: sanitizeAppText(parsed.data.essential_knowledge),
    critical_skills: sanitizeAppText(parsed.data.critical_skills),
    organizational_presence: sanitizeAppText(parsed.data.organizational_presence),
    development_priorities: sanitizeAppText(parsed.data.development_priorities),
  };
}

export function parseRoleSurveySummary(
  value: unknown,
): RoleSurveySummary | Record<string, never> {
  const parsed = roleSurveySummarySchema.safeParse(value);

  if (!parsed.success) {
    return {};
  }

  return {
    synthesized_role_statement: sanitizeAppText(
      parsed.data.synthesized_role_statement,
    ),
    recurring_themes: sanitizeAppTextList(parsed.data.recurring_themes),
    inferred_competencies: parsed.data.inferred_competencies.map((item) => ({
      name: sanitizeAppText(item.name),
      category: item.category,
      rationale: sanitizeAppText(item.rationale),
    })),
    collaboration_expectations: sanitizeAppTextList(
      parsed.data.collaboration_expectations,
    ),
    development_watchouts: sanitizeAppTextList(
      parsed.data.development_watchouts,
    ),
    interview_focus_areas: sanitizeAppTextList(parsed.data.interview_focus_areas),
  };
}

export function isMissingRoleSurveyTablesError(error: { message?: string | null } | null) {
  const message = error?.message ?? "";

  return /role_survey|role_surveys/i.test(message);
}
