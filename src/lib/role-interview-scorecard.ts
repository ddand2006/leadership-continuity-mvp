import { Document, Packer, Paragraph, TextRun } from "docx";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";
import { canonicalizeRoleTitle } from "@/lib/role-title";

const interviewScorecardSchema = z.object({
  purpose: z.string().min(1),
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        questions: z
          .array(
            z.object({
              question: z.string().min(1),
              validates: z.string().min(1),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .min(4)
    .max(7),
  final_summary_labels: z.array(z.string().min(1)).min(4).max(7),
});

export type RoleInterviewScorecardContent = z.infer<
  typeof interviewScorecardSchema
>;
export const roleInterviewScorecardContentSchema = interviewScorecardSchema;

const LOCKED_VP_PATIENT_CARE_SERVICES_SCORECARD: RoleInterviewScorecardContent = {
  purpose:
    "Evaluate candidates for the VP-PCS role across Character, Competence, and Leadership Impact.",
  sections: [
    {
      title: "Relational Leadership",
      questions: [
        {
          question:
            "Tell us about a time you had to address a serious performance issue with a respected nurse or physician.",
          validates:
            "Ability to handle difficult conversations while maintaining trust",
        },
        {
          question:
            "Describe a situation where staff morale was low or trust in leadership was damaged. How did you handle that situation?",
          validates: "Leadership presence and ability to rebuild culture",
        },
        {
          question:
            "Give an example of conflict between nursing and another department. What happened and how did it get resolved? Or did it?",
          validates: "Cross-functional collaboration and conflict resolution",
        },
      ],
    },
    {
      title: "Accountability",
      questions: [
        {
          question:
            "Tell us about a time outcomes were not where they needed to be. What responsibility did you take?",
          validates: "Ownership of outcomes and accountability",
        },
        {
          question:
            "Describe a situation where you could have blamed external factors. What did you do instead?",
          validates: "Bias toward responsibility over excuses",
        },
        {
          question:
            "Tell us about a decision you made that did not work. How did you handle it?",
          validates: "Learning agility and corrective action",
        },
      ],
    },
    {
      title: "Systems Thinking",
      questions: [
        {
          question:
            "Describe a decision that impacted finance, quality, or operations beyond your department. What did you do?",
          validates: "Enterprise-level thinking and downstream awareness",
        },
        {
          question:
            "Tell us about a time fixing one problem created another. How did you handle it?",
          validates: "Ability to anticipate unintended consequences",
        },
        {
          question:
            "Describe how you partnered with finance or operations.",
          validates: "Cross-functional problem solving",
        },
      ],
    },
    {
      title: "Emotional Intelligence",
      questions: [
        {
          question:
            "Describe a time you were under intense pressure. How did others experience you?",
          validates: "Self-awareness and composure",
        },
        {
          question:
            "Tell us about a time you misread a team. What did you do?",
          validates: "Ability to learn from emotional misreads",
        },
        {
          question:
            "Describe how you de-escalated a tense situation.",
          validates: "De-escalation and emotional leadership",
        },
      ],
    },
    {
      title: "People Development",
      questions: [
        {
          question:
            "Tell us about someone you developed into a leadership role.",
          validates: "Commitment to developing leaders",
        },
        {
          question:
            "Describe how you identify high-potential staff.",
          validates: "Talent identification capability",
        },
        {
          question:
            "Tell us about coaching an under-performer.",
          validates: "Coaching and performance management",
        },
      ],
    },
    {
      title: "Stewardship",
      questions: [
        {
          question:
            "What do you see as the primary responsibility of the VP-PCS?",
          validates: "Role identity and strategic mindset",
        },
        {
          question:
            "Describe a time nursing culture impacted patient outcomes.",
          validates: "Understanding of culture-impact on outcomes",
        },
        {
          question:
            "Tell us about a time you had to say no to protect quality or culture.",
          validates: "Courage to protect quality and standards",
        },
      ],
    },
    {
      title: "Technical Competence",
      questions: [
        {
          question:
            "Walk us through your experience leading a QAPI program.",
          validates: "Quality program leadership",
        },
        {
          question:
            "How have you ensured regulatory compliance (CMS, Joint Commission)?",
          validates: "Regulatory knowledge and readiness",
        },
        {
          question:
            "How do you manage nursing labor productivity and staffing models?",
          validates: "Operational and staffing management",
        },
        {
          question:
            "What role have you played in budgeting?",
          validates: "Financial understanding and accountability",
        },
      ],
    },
  ],
  final_summary_labels: [
    "Relational Leadership",
    "Accountability",
    "Systems Thinking",
    "Emotional Intelligence",
    "People Development",
    "Stewardship",
    "Technical Competence",
  ],
};

export function hasLockedRoleInterviewScorecard(roleTitle: string) {
  return canonicalizeRoleTitle(roleTitle) === "VP - Patient Care Services";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function resolveSectionForCompetency(options: {
  competencyName: string;
  generatedSections: RoleInterviewScorecardContent["sections"];
  fallbackIndex: number;
}) {
  const normalizedCompetencyName = normalizeText(options.competencyName);
  const directMatch = options.generatedSections.find((section) => {
    const normalizedSectionTitle = normalizeText(section.title);

    return (
      normalizedSectionTitle.includes(normalizedCompetencyName) ||
      normalizedCompetencyName.includes(normalizedSectionTitle)
    );
  });

  if (directMatch) {
    return directMatch;
  }

  return options.generatedSections[options.fallbackIndex] ?? null;
}

function normalizeInterviewScorecardContent(options: {
  content: RoleInterviewScorecardContent;
  competencyNames: string[];
}) {
  const sections = options.competencyNames.flatMap((competencyName, index) => {
    const matchedSection = resolveSectionForCompetency({
      competencyName,
      generatedSections: options.content.sections,
      fallbackIndex: index,
    });

    if (!matchedSection) {
      return [];
    }

    return [
      {
        title: competencyName,
        questions: matchedSection.questions,
      },
    ];
  });

  return {
    ...options.content,
    sections,
    final_summary_labels: options.competencyNames,
  };
}

function heading(text: string, size = 30) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size,
      }),
    ],
  });
}

function body(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        size: 22,
      }),
    ],
  });
}

export async function generateRoleInterviewScorecardContent(options: {
  organizationName: string;
  roleTitle: string;
  roleDescription: string;
  idealCompetencies: {
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  roleCompetencies: {
    name: string;
    definition: string;
    behavioral_indicators: string[];
    red_flags: string[];
  }[];
}) {
  if (hasLockedRoleInterviewScorecard(options.roleTitle)) {
    return LOCKED_VP_PATIENT_CARE_SERVICES_SCORECARD;
  }

  const openAIEnv = getOpenAIEnv();
  const openai = createOpenAIClient();
  const response = await openai.responses.parse({
    model: openAIEnv.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "You create executive behavioral interview scorecards for organizational leadership roles. Use a practical Word-ready structure modeled after an interview scorecard: a short purpose statement, titled sections, and 2 to 4 behavioral interview questions in each section. Every question must include a concise 'what this validates' explanation. Build sections directly from the role's competencies, behavioral indicators, red flags, and ideal candidate competencies. Keep the questions behavioral, evidence-seeking, and senior-leadership appropriate. Use the exact supplied role competency names as the section titles and in the final evaluation summary.",
      },
        {
          role: "user",
          content: serializeModelInput({
            organization_name: options.organizationName,
            role: {
              title: options.roleTitle,
              description: options.roleDescription,
            },
            ideal_candidate_competencies: options.idealCompetencies,
            structured_role_competencies: options.roleCompetencies,
            format_reference: {
              purpose:
                "A short explanation of what the scorecard is evaluating.",
              sections:
                "Create one section for each supplied role competency and use the exact competency name as the section title.",
              question_format:
                "For each question include the behavioral prompt and a short line for what the question validates.",
              final_summary:
                "Return the exact role competency names in the same order for the final evaluation summary.",
            },
          }),
        },
    ],
    text: {
      format: zodTextFormat(
        interviewScorecardSchema,
        "role_interview_scorecard",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no interview scorecard content.");
  }

  return normalizeInterviewScorecardContent({
    content: response.output_parsed,
    competencyNames: options.roleCompetencies.map((competency) => competency.name),
  });
}

export async function buildRoleInterviewScorecardDocumentBuffer(options: {
  organizationName: string;
  roleTitle: string;
  content: RoleInterviewScorecardContent;
}) {
  const usesLockedTemplate = hasLockedRoleInterviewScorecard(options.roleTitle);
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: options.organizationName,
          bold: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: `${options.roleTitle} Interview Scorecard`,
          bold: true,
          size: 34,
        }),
      ],
    }),
    body(`Purpose: ${options.content.purpose}`),
  ];

  options.content.sections.forEach((section, sectionIndex) => {
    children.push(heading(`Section ${sectionIndex + 1}: ${section.title}`, 26));

    section.questions.forEach((question) => {
      children.push(body(question.question));
      children.push(body(`What this validates: ${question.validates}`));
      children.push(body("Score (circle): 1   2   3   4   5"));
      children.push(body("Notes: ________________________________________________"));
    });
  });

  children.push(heading("Final Evaluation Summary", 26));
  children.push(
    body(
      usesLockedTemplate
        ? "Total the responses for each of the sections. Write the totals below. Circle the areas you feel are most important for the role of the VP-PCS."
        : "Total the responses for each section and note the areas that matter most for this role.",
    ),
  );

  options.content.final_summary_labels.forEach((label) => {
    children.push(body(`${label}: ______`));
  });

  children.push(body("Overall Recommendation: Strong Yes / Yes / Leaning No / No"));

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
