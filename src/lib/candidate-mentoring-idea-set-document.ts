import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";

function heading(text: string, size = 32) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
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
    spacing: { after: 100 },
    children: [
      new TextRun({
        text,
        size: 22,
      }),
    ],
  });
}

function bullet(text: string) {
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

export async function buildCandidateMentoringIdeaSetDocumentBuffer(options: {
  candidateName: string;
  roleTitle: string;
  competencyName: string;
  ideas: GeneratedCandidateMentoringIdea[];
}) {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${options.competencyName} Development Ideas`,
          bold: true,
          size: 34,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${options.candidateName} • ${options.roleTitle}`,
          italics: true,
          size: 22,
        }),
      ],
    }),
    body(
      "These development ideas were generated from the candidate's current interview scores, strengths profile, role expectations, and mentoring context.",
    ),
  ];

  options.ideas.forEach((idea, index) => {
    children.push(heading(`Idea ${index + 1}: ${idea.title}`, 28));
    children.push(
      body(
        `Project type: ${idea.project_type === "cross_departmental" ? "Cross-Departmental Project" : "Departmental Project"}`,
      ),
    );
    children.push(heading("Purpose", 26));
    children.push(body(idea.purpose));
    children.push(body(idea.description));
    children.push(heading("Working Goal", 26));
    children.push(body(idea.working_goal));
    children.push(heading("Why This Fits", 26));
    children.push(body(idea.why_it_fits));
    children.push(heading("Strengths Application", 26));
    children.push(body(idea.strengths_application));
    children.push(heading("Mentor Preparation", 26));
    idea.mentor_preparation.forEach((item) => children.push(bullet(item)));
    children.push(heading("Mentee Preparation", 26));
    idea.mentee_preparation.forEach((item) => children.push(bullet(item)));
    children.push(heading("Key Partners", 26));
    idea.key_partners.forEach((item) => children.push(bullet(item)));
    children.push(heading("Leadership Actions Required", 26));
    idea.leadership_actions_required.forEach((item) => children.push(bullet(item)));
    children.push(heading("Mentor Focus", 26));
    children.push(body(idea.mentor_focus));
    children.push(heading("First Step", 26));
    children.push(body(idea.first_step));
    children.push(heading("Anticipated Challenges", 26));
    idea.anticipated_challenges.forEach((item) => children.push(bullet(item)));
    children.push(heading("Success Measures", 26));
    idea.success_measures.forEach((item) => children.push(bullet(item)));
    children.push(heading("Success Signals", 26));
    idea.success_signals.forEach((signal) => children.push(bullet(signal)));
    children.push(heading("Reflection and Debrief", 26));
    idea.reflection_questions.forEach((item) => children.push(bullet(item)));
    children.push(
      body(`Suggested duration: ${idea.duration_days} days`),
      new Paragraph({ spacing: { after: 160 } }),
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
