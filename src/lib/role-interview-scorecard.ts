import { Document, Packer, Paragraph, TextRun } from "docx";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";

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
        content: JSON.stringify(
          {
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
          },
          null,
          2,
        ),
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
      "Total the responses for each section and note the areas that matter most for this role.",
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
