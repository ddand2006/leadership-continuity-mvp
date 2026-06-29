import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai";

const roleCompositeDocumentSchema = z.object({
  success_composite_title: z.string().min(1),
  core_competencies_intro: z.string().min(1),
  core_competencies: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(3).max(5),
      }),
    )
    .min(4)
    .max(7),
  professional_identity_quote: z.string().min(1),
  professional_identity_summary: z.string().min(1),
  non_negotiable_intro: z.string().min(1),
  credentials_and_experience: z.array(z.string().min(1)).min(3).max(7),
  operational_competence: z.array(z.string().min(1)).min(3).max(8),
  regulatory_risk_awareness: z.array(z.string().min(1)).min(3).max(6),
  leadership_maturity: z.array(z.string().min(1)).min(3).max(6),
  knowledge_base_intro: z.string().min(1),
  knowledge_base_sections: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(2).max(6),
      }),
    )
    .min(3)
    .max(5),
  disqualifiers_intro: z.string().min(1),
  behavioral_disqualifiers: z.array(z.string().min(1)).min(2).max(6),
  leadership_gaps: z.array(z.string().min(1)).min(2).max(6),
  cultural_misalignment: z.array(z.string().min(1)).min(2).max(6),
  regulatory_ethical_red_flags: z.array(z.string().min(1)).min(2).max(6),
  one_sentence_summary: z.string().min(1),
});

export type RoleCompositeDocumentContent = z.infer<
  typeof roleCompositeDocumentSchema
>;

function uppercaseRoleTitle(title: string) {
  return title.toUpperCase();
}

function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
      }),
    ],
  });
}

function subHeading(text: string) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
      }),
    ],
  });
}

function numberedHeading(text: string) {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
      }),
    ],
  });
}

function bodyParagraph(text: string, italic = false) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        italics: italic,
        size: 22,
      }),
    ],
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    indent: { left: 360, hanging: 180 },
    children: [
      new TextRun({
        text,
        size: 22,
      }),
    ],
  });
}

export async function generateRoleCompositeDocumentContent(options: {
  organizationName: string;
  roleTitle: string;
  roleDepartment: string | null;
  roleDescription: string;
  idealCompetencies: {
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  roleCompetencies: {
    name: string;
    definition: string;
    target_score: number;
    weight: number;
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
          "You create hospital leadership role composite documents in a structured narrative format. The format should mirror an executive hiring composite: success composite, professional identity, non-negotiable requirements, required knowledge base, disqualifiers, and one-sentence summary. Write with clear business language, concise bullets, and strong judgment. Use only the supplied role description, ideal candidate competencies, and structured role competencies. Do not mention AI or the generation process.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            organization_name: options.organizationName,
            role: {
              title: options.roleTitle,
              department: options.roleDepartment,
              description: options.roleDescription,
            },
            ideal_candidate_competencies: options.idealCompetencies,
            structured_role_competencies: options.roleCompetencies,
            document_format: {
              section_1:
                "Success composite with core competencies and a professional identity statement.",
              section_2:
                "Non-negotiable requirements with credentials/experience, operational competence, regulatory/risk awareness, and leadership maturity.",
              section_3:
                "Required knowledge base broken into 3 to 5 titled sub-sections.",
              section_4:
                "Disqualifiers with behavioral, leadership, cultural, and regulatory/ethical red flags.",
              section_5: "One sentence composite summary.",
            },
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: zodTextFormat(
        roleCompositeDocumentSchema,
        "role_composite_document",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed role composite document content.");
  }

  return response.output_parsed;
}

export async function buildRoleCompositeDocumentBuffer(options: {
  organizationName: string;
  roleTitle: string;
  content: RoleCompositeDocumentContent;
}) {
  const title = uppercaseRoleTitle(options.roleTitle);
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 34,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `(${options.organizationName})`,
          italics: true,
          size: 22,
        }),
      ],
    }),
    sectionHeading(`I. ${options.content.success_composite_title}`),
    subHeading("A. Core Competencies (Behavioral & Personal)"),
    bodyParagraph(options.content.core_competencies_intro),
  ];

  options.content.core_competencies.forEach((competency, index) => {
    children.push(numberedHeading(`${index + 1}. ${competency.title}`));
    competency.bullets.forEach((bullet) => {
      children.push(bulletParagraph(bullet));
    });
  });

  children.push(
    subHeading("B. Professional Identity"),
    bodyParagraph("This person sees themselves as:"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `“${options.content.professional_identity_quote}”`,
          italics: true,
          size: 22,
        }),
      ],
    }),
    bodyParagraph(options.content.professional_identity_summary),
    sectionHeading("II. NON-NEGOTIABLE REQUIREMENTS (MUST-HAVES)"),
    bodyParagraph(options.content.non_negotiable_intro),
    subHeading("A. Credentials & Experience"),
  );

  options.content.credentials_and_experience.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("B. Operational Competence"));
  options.content.operational_competence.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("C. Regulatory & Risk Awareness"));
  options.content.regulatory_risk_awareness.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("D. Leadership Maturity"));
  options.content.leadership_maturity.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(
    sectionHeading("III. REQUIRED KNOWLEDGE BASE (WHAT THEY MUST UNDERSTAND)"),
    bodyParagraph(options.content.knowledge_base_intro),
  );

  options.content.knowledge_base_sections.forEach((section, index) => {
    const prefix = String.fromCharCode(65 + index);
    children.push(subHeading(`${prefix}. ${section.title}`));
    section.bullets.forEach((bullet) => {
      children.push(bulletParagraph(bullet));
    });
  });

  children.push(
    sectionHeading("IV. DISQUALIFIERS (DO NOT PROCEED IF PRESENT)"),
    bodyParagraph(options.content.disqualifiers_intro),
    subHeading("A. Behavioral Disqualifiers"),
  );

  options.content.behavioral_disqualifiers.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("B. Leadership Gaps"));
  options.content.leadership_gaps.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("C. Cultural Misalignment"));
  options.content.cultural_misalignment.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(subHeading("D. Regulatory or Ethical Red Flags"));
  options.content.regulatory_ethical_red_flags.forEach((item) => {
    children.push(bulletParagraph(item));
  });

  children.push(
    sectionHeading("V. ONE-SENTENCE COMPOSITE SUMMARY"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: options.content.one_sentence_summary,
          size: 22,
          underline: {
            type: UnderlineType.SINGLE,
            color: "000000",
          },
        }),
      ],
    }),
  );

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
