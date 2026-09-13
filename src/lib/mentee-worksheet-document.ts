import { CheckBox, Document, HeadingLevel, Packer, Paragraph, Tab, TextRun } from "docx";
import type { GeneratedMenteeWorksheet } from "@/lib/development-record-project-tools";

export async function buildMenteeWorksheetDocumentBuffer(input: {
  candidateName: string;
  targetRole: string;
  mentorName: string;
  projectTitle: string;
  worksheet: GeneratedMenteeWorksheet;
  reportNotes: string;
}) {
  const section = (title: string, items: string[], checklist = false) => [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
    ...items.map((text) => new Paragraph({
      ...(checklist
        ? { children: [new CheckBox({ checked: false, alias: text.slice(0, 100) }), new TextRun({ children: [new Tab(), text] })], indent: { left: 720, hanging: 360 } }
        : { text, bullet: { level: 0 } }),
      spacing: { after: 120 },
    })),
  ];
  return Packer.toBuffer(new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 160 } } } } },
    sections: [{ children: [
      new Paragraph({ text: "Mentee worksheet", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: input.projectTitle, heading: HeadingLevel.HEADING_1 }),
      ...[["Mentee", input.candidateName], ["Target role", input.targetRole], ["Mentor", input.mentorName]].map(([label, value]) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] })),
      new Paragraph({ text: "Assignment", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: input.worksheet.assignmentSummary }),
      ...section("First steps", input.worksheet.firstSteps, true),
      ...section("Weekly checkpoints", input.worksheet.weeklyCheckpoints, true),
      ...section("Report-back prompts", input.worksheet.reportBackPrompts, true),
      ...section("Reflection questions", input.worksheet.reflectionQuestions),
      new Paragraph({ text: "Mentee report-back notes", heading: HeadingLevel.HEADING_2 }),
      ...((input.reportNotes || "Add notes about what you completed, learned, and need from your mentor next.").split("\n").map((text) => new Paragraph({ text }))),
    ] }],
  }));
}
