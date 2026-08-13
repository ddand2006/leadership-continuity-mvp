import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIEnv } from "@/lib/env";
import { createOpenAIClient, serializeModelInput } from "@/lib/openai";

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

const condensedRoleCompositeDocumentSchema = z.object({
  position_summary: z.string().min(1).max(700),
  core_competencies: z
    .array(
      z.object({
        competency: z.string().min(1),
        what_success_looks_like: z.string().min(1).max(260),
      }),
    )
    .min(4)
    .max(6),
  minimum_requirements: z.array(z.string().min(1).max(220)).min(3).max(6),
  preferred_knowledge: z.array(z.string().min(1).max(220)).min(3).max(6),
  disqualifiers: z
    .array(
      z.object({
        area: z.string().min(1),
        concern: z.string().min(1).max(220),
      }),
    )
    .min(4)
    .max(6),
  one_sentence_summary: z.string().min(1).max(400),
});

export type CondensedRoleCompositeDocumentContent = z.infer<
  typeof condensedRoleCompositeDocumentSchema
>;

const COMPOSITE_GREEN = "245C48";
const COMPOSITE_GREEN_TINT = "EAF3EF";
const COMPOSITE_LIGHT_TINT = "F4F7F5";
const COMPOSITE_BORDER = "4A4A4A";
const COMPOSITE_TABLE_WIDTH = 9360;

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
          "You create organizational leadership role composite documents in a structured narrative format. The format should mirror an executive hiring composite: success composite, professional identity, non-negotiable requirements, required knowledge base, disqualifiers, and one-sentence summary. Write with clear business language, concise bullets, and strong judgment. Use only the supplied role description, ideal candidate competencies, and structured role competencies. Do not mention AI or the generation process.",
      },
        {
          role: "user",
          content: serializeModelInput({
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
          }),
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

export async function generateCondensedRoleCompositeDocumentContent(options: {
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
          "Create a concise leadership role profile for hiring and succession use. Use clear business language and only the supplied role data. Make it much shorter than a full role composite. State minimum requirements as practical requirements, preferred knowledge as helpful but nonessential knowledge, and disqualifiers as observable concerns. Do not invent credentials, laws, years of experience, or technical requirements that are not supported by the role data. Do not mention AI or the generation process.",
      },
      {
        role: "user",
        content: serializeModelInput({
          organization_name: options.organizationName,
          role: {
            title: options.roleTitle,
            department: options.roleDepartment,
            description: options.roleDescription,
          },
          ideal_candidate_competencies: options.idealCompetencies,
          structured_role_competencies: options.roleCompetencies,
          document_format: {
            position_summary: "A short paragraph explaining the role and the ideal person.",
            core_competencies:
              "4 to 6 competency rows. Each row has a concise competency and what success looks like.",
            minimum_requirements: "3 to 6 practical must-have bullets, based only on supplied information.",
            preferred_knowledge: "3 to 6 helpful knowledge or experience bullets.",
            disqualifiers:
              "4 to 6 observable concerns that should stop or pause consideration.",
            one_sentence_summary: "One sentence that describes the successful person.",
          },
        }),
      },
    ],
    text: {
      format: zodTextFormat(
        condensedRoleCompositeDocumentSchema,
        "condensed_role_composite_document",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no condensed role composite document content.");
  }

  return response.output_parsed;
}

function condensedBodyParagraph(text: string, options?: { bold?: boolean; italic?: boolean; color?: string; after?: number }) {
  return new Paragraph({
    spacing: { after: options?.after ?? 80, line: 300 },
    children: [
      new TextRun({
        text,
        font: "Georgia",
        size: 22,
        bold: options?.bold,
        italics: options?.italic,
        color: options?.color ?? "1F2937",
      }),
    ],
  });
}

function condensedSectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 28,
        bold: true,
        color: COMPOSITE_GREEN,
      }),
    ],
  });
}

function condensedTableCell(text: string, options: { width: number; header?: boolean; emphasis?: boolean }) {
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options.header
      ? { type: ShadingType.CLEAR, color: "auto", fill: COMPOSITE_GREEN }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 280 },
        children: [
          new TextRun({
            text,
            font: "Georgia",
            size: options.header ? 22 : 21,
            bold: Boolean(options.header || options.emphasis),
            color: options.header ? "FFFFFF" : options.emphasis ? COMPOSITE_GREEN : "1F2937",
          }),
        ],
      }),
    ],
  });
}

function condensedTable(rows: { left: string; right: string }[], leftHeader: string, rightHeader: string) {
  const leftWidth = 3600;
  const rightWidth = COMPOSITE_TABLE_WIDTH - leftWidth;

  return new Table({
    width: { size: COMPOSITE_TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [leftWidth, rightWidth],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COMPOSITE_BORDER },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          condensedTableCell(leftHeader, { width: leftWidth, header: true }),
          condensedTableCell(rightHeader, { width: rightWidth, header: true }),
        ],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: [
              condensedTableCell(row.left, { width: leftWidth, emphasis: true }),
              condensedTableCell(row.right, { width: rightWidth }),
            ],
          }),
      ),
    ],
  });
}

export async function buildCondensedRoleCompositeDocumentBuffer(options: {
  organizationName: string;
  roleTitle: string;
  roleDepartment: string | null;
  content: CondensedRoleCompositeDocumentContent;
}) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${options.roleTitle} Condensed Profile`,
          font: "Georgia",
          size: 40,
          bold: true,
          color: COMPOSITE_GREEN,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: [options.organizationName, options.roleDepartment].filter(Boolean).join(" | "),
          font: "Georgia",
          size: 23,
          color: "5E5E5E",
        }),
      ],
    }),
    new Table({
      width: { size: COMPOSITE_TABLE_WIDTH, type: WidthType.DXA },
      columnWidths: [COMPOSITE_TABLE_WIDTH],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: COMPOSITE_TABLE_WIDTH, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: COMPOSITE_GREEN_TINT },
              margins: { top: 150, bottom: 150, left: 180, right: 180 },
              children: [
                new Paragraph({
                  spacing: { after: 0, line: 300 },
                  children: [
                    new TextRun({ text: "Position Summary: ", font: "Georgia", size: 22, bold: true, color: COMPOSITE_GREEN }),
                    new TextRun({ text: options.content.position_summary, font: "Georgia", size: 22, color: "1F2937" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    condensedSectionHeading("Core Competencies"),
    condensedTable(
      options.content.core_competencies.map((item) => ({
        left: item.competency,
        right: item.what_success_looks_like,
      })),
      "Competency",
      "What Success Looks Like",
    ),
    condensedSectionHeading("Minimum Requirements"),
    ...options.content.minimum_requirements.map((item) => new Paragraph({
      bullet: { level: 0 },
      indent: { left: 360, hanging: 180 },
      spacing: { after: 50, line: 300 },
      children: [new TextRun({ text: item, font: "Georgia", size: 22, color: "1F2937" })],
    })),
    condensedSectionHeading("Preferred Knowledge"),
    ...options.content.preferred_knowledge.map((item) => new Paragraph({
      bullet: { level: 0 },
      indent: { left: 360, hanging: 180 },
      spacing: { after: 50, line: 300 },
      children: [new TextRun({ text: item, font: "Georgia", size: 22, color: "1F2937" })],
    })),
    condensedSectionHeading("Disqualifiers"),
    condensedTable(
      options.content.disqualifiers.map((item) => ({
        left: item.area,
        right: item.concern,
      })),
      "Area",
      "Concern",
    ),
    condensedSectionHeading("One-Sentence Summary"),
    new Table({
      width: { size: COMPOSITE_TABLE_WIDTH, type: WidthType.DXA },
      columnWidths: [COMPOSITE_TABLE_WIDTH],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: COMPOSITE_TABLE_WIDTH, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: COMPOSITE_LIGHT_TINT },
              margins: { top: 150, bottom: 150, left: 180, right: 180 },
              children: [condensedBodyParagraph(options.content.one_sentence_summary, { italic: true, after: 0, color: "3F3F3F" })],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 220, after: 0 },
      children: [
        new TextRun({
          text: `Condensed ${options.roleTitle} Profile`,
          font: "Georgia",
          size: 18,
          color: "888888",
        }),
      ],
    }),
  ];

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1440, bottom: 1080, left: 1440, header: 709, footer: 709 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
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
