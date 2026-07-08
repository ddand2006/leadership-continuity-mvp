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
  "personality_traits",
  "relationship_style",
  "organizational_presence",
  "cross_department_collaboration",
  "signals_of_success",
  "common_derailers",
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
    shortLabel: "Essential knowledge",
    prompt:
      "What does someone in this role need to know to do the job well and make sound decisions?",
    helpText:
      "Think about technical knowledge, judgment, regulations, business context, and how the work really gets done.",
  },
  {
    key: "critical_skills",
    shortLabel: "Critical skills",
    prompt:
      "What skills or capabilities are most important for performing this role successfully?",
    helpText:
      "Include leadership, operational, communication, financial, strategic, or people-development skills.",
  },
  {
    key: "personality_traits",
    shortLabel: "Personality traits",
    prompt:
      "What personality traits, tendencies, or natural styles seem most important for success in this role?",
    helpText:
      "Examples might include calm under pressure, curiosity, decisiveness, humility, empathy, or follow-through.",
  },
  {
    key: "relationship_style",
    shortLabel: "Relationship style",
    prompt:
      "How should someone in this role work with other people day to day?",
    helpText:
      "Describe how they handle conflict, coaching, accountability, listening, trust-building, and difficult conversations.",
  },
  {
    key: "organizational_presence",
    shortLabel: "Organizational presence",
    prompt:
      "What is this leader like around the organization when they are performing at a high level?",
    helpText:
      "Describe the tone they set, how others experience them, and how they show up in meetings, crises, and routine work.",
  },
  {
    key: "cross_department_collaboration",
    shortLabel: "Cross-department work",
    prompt:
      "How should this role interact with other departments, teams, or stakeholders across the organization?",
    helpText:
      "Call out collaboration patterns, influence, follow-up, diplomacy, and what healthy partnership looks like.",
  },
  {
    key: "signals_of_success",
    shortLabel: "Signals of success",
    prompt:
      "What are the clearest signs that someone is succeeding in this role?",
    helpText:
      "List behaviors, outcomes, or reputation markers that would make you say, 'Yes, this person is thriving here.'",
  },
  {
    key: "common_derailers",
    shortLabel: "Common derailers",
    prompt:
      "What habits, blind spots, or behaviors most often cause people to struggle in this role?",
    helpText:
      "Name the red flags, failure patterns, or risks that should be watched closely during selection and development.",
  },
  {
    key: "development_priorities",
    shortLabel: "Development priorities",
    prompt:
      "If you were helping someone grow into this role, where would you focus first?",
    helpText:
      "Share the capabilities or mindset shifts that most accelerate readiness for this position.",
  },
];

const responseAnswerSchema = z.string().trim().min(1).max(6000);

export const roleSurveyResponsePayloadSchema = z.object({
  essential_knowledge: responseAnswerSchema,
  critical_skills: responseAnswerSchema,
  personality_traits: responseAnswerSchema,
  relationship_style: responseAnswerSchema,
  organizational_presence: responseAnswerSchema,
  cross_department_collaboration: responseAnswerSchema,
  signals_of_success: responseAnswerSchema,
  common_derailers: responseAnswerSchema,
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
    personality_traits: sanitizeAppText(parsed.data.personality_traits),
    relationship_style: sanitizeAppText(parsed.data.relationship_style),
    organizational_presence: sanitizeAppText(parsed.data.organizational_presence),
    cross_department_collaboration: sanitizeAppText(
      parsed.data.cross_department_collaboration,
    ),
    signals_of_success: sanitizeAppText(parsed.data.signals_of_success),
    common_derailers: sanitizeAppText(parsed.data.common_derailers),
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
