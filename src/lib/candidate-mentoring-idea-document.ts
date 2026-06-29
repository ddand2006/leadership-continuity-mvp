import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";

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

export async function buildCandidateMentoringIdeaDocumentBuffer(options: {
  candidateName: string;
  roleTitle: string;
  competencyName: string;
  idea: {
    title: string;
    project_type: "departmental" | "cross_departmental";
    purpose: string;
    description: string;
    working_goal: string;
    why_it_fits: string;
    strengths_application: string;
    mentor_focus: string;
    first_step: string;
    key_partners: string[];
    leadership_actions_required: string[];
    mentor_preparation: string[];
    mentee_preparation: string[];
    anticipated_challenges: string[];
    success_measures: string[];
    reflection_questions: string[];
    duration_days: number;
    success_signals: string[];
  };
}) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: options.idea.title,
                bold: true,
                size: 34,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `${options.candidateName} • ${options.roleTitle} • ${options.idea.project_type === "cross_departmental" ? "Cross-Departmental Project" : "Departmental Project"} • ${options.idea.duration_days} days`,
                italics: true,
                size: 22,
              }),
            ],
          }),
          heading("Purpose", 26),
          body(options.idea.purpose),
          heading("Project Overview", 26),
          body(options.idea.description),
          heading("Working Goal", 26),
          body(options.idea.working_goal),
          heading("Why This Fits", 26),
          body(options.idea.why_it_fits),
          heading(`How ${options.candidateName.split(" ")[0] || options.candidateName}'s strengths can help`, 26),
          body(options.idea.strengths_application),
          heading("Mentor Preparation", 26),
          ...options.idea.mentor_preparation.map((item) => bullet(item)),
          heading("Mentee Preparation", 26),
          ...options.idea.mentee_preparation.map((item) => bullet(item)),
          heading("Key Partners", 26),
          ...options.idea.key_partners.map((item) => bullet(item)),
          heading("Leadership Actions Required", 26),
          ...options.idea.leadership_actions_required.map((item) => bullet(item)),
          heading("Mentor Focus", 26),
          body(options.idea.mentor_focus),
          heading("First Step", 26),
          body(options.idea.first_step),
          heading("Anticipated Challenges", 26),
          ...options.idea.anticipated_challenges.map((item) => bullet(item)),
          heading("Success Measures", 26),
          ...options.idea.success_measures.map((item) => bullet(item)),
          heading("Success Signals", 26),
          ...options.idea.success_signals.map((signal) => bullet(signal)),
          heading("Reflection and Debrief", 26),
          ...options.idea.reflection_questions.map((item) => bullet(item)),
          heading("Competency Focus", 26),
          body(options.competencyName),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
