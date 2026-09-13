import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export async function buildMentorDirectionDocumentBuffer(input: {
  candidateName: string; targetRole: string; mentorName: string; projectTitle: string; narrative: string;
}) {
  return Packer.toBuffer(new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 160 } } } } },
    sections: [{ children: [
      new Paragraph({ text: "Mentor direction", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: input.projectTitle, heading: HeadingLevel.HEADING_1 }),
      ...[["Mentee", input.candidateName], ["Target role", input.targetRole], ["Mentor", input.mentorName]].map(([label, value]) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] })),
      ...input.narrative.split(/\r?\n/).map((text) => new Paragraph({ text })),
    ] }],
  }));
}
