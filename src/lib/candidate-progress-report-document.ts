import { projectScore, projectScoreChange, projectCompletionLabel, type ProjectProgressEvidence } from "@/lib/progress-development-evidence";
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
  VerticalAlign,
  WidthType,
} from "docx";

const NAVY = "000000";
const TEAL = "000000";
const INK = "172033";
const MUTED = "52637E";
const BORDER = "D9D9D9";
const SOFT_FILL = "F2F4F7";
const TABLE_WIDTH = 9360;

type ScorecardRow = {
  measure: string;
  value: string | number;
};

type DevelopmentRecord = ProjectProgressEvidence & {
  title: string | null;
  roleTitle: string;
  summary: string | null;
  status: string;
  occurredAt: string;
  mentorReviewed: boolean;
};

type ProgressEvent = {
  occurredAt: string;
  label: string;
  detail: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function bodyParagraph(text: string, options?: { before?: number; after?: number; color?: string }) {
  return new Paragraph({
    spacing: { before: options?.before ?? 0, after: options?.after ?? 120, line: 308 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        color: options?.color ?? INK,
      }),
    ],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 26,
        bold: true,
        color: NAVY,
      }),
    ],
  });
}

function tableCell(text: string, options?: { header?: boolean; width?: number }) {
  return new TableCell({
    width: { size: options?.width ?? 4680, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options?.header
      ? { type: ShadingType.CLEAR, color: "auto", fill: SOFT_FILL }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 280 },
        children: [
          new TextRun({
            text,
            font: "Calibri",
            size: options?.header ? 19 : 21,
            bold: Boolean(options?.header),
            color: options?.header ? "000000" : INK,
          }),
        ],
      }),
    ],
  });
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export async function buildCandidateProgressReportDocumentBuffer(options: {
  candidateName: string;
  periodLabel: string;
  narrative: string;
  scorecard: ScorecardRow[];
  developmentRecords: DevelopmentRecord[];
  events: ProgressEvent[];
}) {
  const children = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "LEADERSHIP CONTINUITY SYSTEM",
          font: "Calibri",
          size: 18,
          bold: true,
          color: TEAL,
          characterSpacing: 36,
        }),
      ],
    }),
    new Paragraph({
      style: "Title",
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Candidate Progress Report",
          font: "Calibri",
          size: 40,
          bold: true,
          color: NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: options.candidateName, font: "Calibri", size: 26, bold: true, color: INK }),
        new TextRun({ text: `  |  ${options.periodLabel}`, font: "Calibri", size: 22, color: MUTED }),
      ],
    }),
    sectionHeading("Progress Narrative"),
    bodyParagraph(options.narrative),
    sectionHeading("Progress Scorecard"),
    new Table({
      width: { size: TABLE_WIDTH, type: WidthType.DXA },
      columnWidths: [5200, 4160],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            tableCell("MEASURE", { header: true, width: 5200 }),
            tableCell(options.periodLabel.toUpperCase(), { header: true, width: 4160 }),
          ],
        }),
        ...options.scorecard.map(
          (row) =>
            new TableRow({
              children: [
                tableCell(row.measure, { width: 5200 }),
                tableCell(String(row.value), { width: 4160 }),
              ],
            }),
        ),
      ],
    }),
    sectionHeading("Projects and Development"),
    ...(options.developmentRecords.length > 0
      ? options.developmentRecords.flatMap((record) => [
          new Paragraph({
            keepNext: true,
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "808080", space: 10 },
            },
            spacing: { before: 240, after: 60 },
            children: [
              new TextRun({ text: record.title ?? "Development record", font: "Calibri", size: 23, bold: true, color: NAVY }),
            ],
          }),
          bodyParagraph(
            `Role: ${record.roleTitle} | Status: ${statusLabel(record.status)}`,
            { after: 60, color: MUTED },
          ),
          ...(record.summary ? [bodyParagraph(record.summary, { after: 120 })] : []),
          bodyParagraph(`Assigned: ${formatDate(record.dateAssigned)} | Completion date: ${record.status === "completed" && record.completionDate ? formatDate(record.completionDate) : projectCompletionLabel(record.status, record.completionDate)}`),
          bodyParagraph(`Mentor: ${record.mentorName ?? "Not recorded"} | Review date: ${record.mentorReviewDate ? formatDate(record.mentorReviewDate) : "Not recorded"}`),
          bodyParagraph(`Mentor observations: ${record.mentorImprovementObserved?.trim() || "Not recorded"}`),
          bodyParagraph(`Further development: ${record.mentorDevelopmentNeeded?.trim() || "Not recorded"}`),
          bodyParagraph(`Recommended next experience: ${record.nextRecommendedExperience?.trim() || "Not recorded"}`),
          ...(record.competencyScores.length > 0 ? [
            new Paragraph({ keepNext: true, spacing: { before: 100, after: 80 }, children: [new TextRun({ text: "Competency score changes", font: "Calibri", size: 22, bold: true, color: INK })] }),
            new Table({
              width: { size: TABLE_WIDTH, type: WidthType.DXA },
              columnWidths: [3120, 1500, 1500, 1740, 1500],
              borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.SINGLE, size: 4, color: BORDER }])),
              rows: [
                new TableRow({ tableHeader: true, children: ["Competency", "Baseline", "Current", "Change", "Target"].map((label, index) => tableCell(label, { header: true, width: [3120, 1500, 1500, 1740, 1500][index] })) }),
                ...record.competencyScores.map((score) => new TableRow({ children: [score.competency_name, projectScore(score.baseline_score), projectScore(score.current_score), projectScoreChange(score.baseline_score, score.current_score), projectScore(score.target_score)].map((value, index) => tableCell(value, { width: [3120, 1500, 1500, 1740, 1500][index] })) })),
              ],
            }),
          ] : [bodyParagraph("Competency score changes: No scores recorded for this project.")]),
          bodyParagraph(`Last updated: ${formatDate(record.occurredAt)}`, { before: 120, color: MUTED }),
        ])
      : [bodyParagraph("No development projects or records were saved for this reporting period.")]),
    sectionHeading("Recent Activity"),
    ...(options.events.length > 0
      ? options.events.map(
          (event) =>
            new Paragraph({
              spacing: { after: 100, line: 308 },
              bullet: { level: 0 },
              indent: { left: 720, hanging: 360 },
              children: [
                new TextRun({ text: `${event.label} — `, font: "Calibri", size: 22, bold: true, color: NAVY }),
                new TextRun({ text: `${event.detail} (${formatDate(event.occurredAt)})`, font: "Calibri", size: 22, color: INK }),
              ],
            }),
        )
      : [bodyParagraph("No progress activity has been recorded for this reporting period.")]),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({
          text: `Generated ${formatDate(new Date().toISOString())}`,
          font: "Calibri",
          size: 18,
          color: MUTED,
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
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 709, footer: 709 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
