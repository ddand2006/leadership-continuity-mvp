import { Document, Packer, Paragraph, TextRun } from "docx";

export type PrintableRoleCompetency = {
  name: string;
  definition: string;
  target_score: number;
  weight: number;
  behavioral_indicators: string[];
  red_flags: string[];
};

export type PrintableRoleNarrativeInput = {
  roleTitle: string;
  roleDepartment: string | null;
  roleDescription: string | null;
  roleStatus: string;
  assignedMentors: string[];
  idealCompetencies: {
    talents: string[];
    skills: string[];
    behaviors: string[];
  };
  roleCompetencies: PrintableRoleCompetency[];
  compositeNarrativeParagraphs: string[];
};

function joinNarrativeList(items: string[], maxItems = 4) {
  const uniqueItems = Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean)),
  );

  if (uniqueItems.length === 0) {
    return "";
  }

  if (uniqueItems.length === 1) {
    return uniqueItems[0];
  }

  const visibleItems = uniqueItems.slice(0, maxItems);
  const remainingCount = uniqueItems.length - visibleItems.length;
  const itemsToJoin =
    remainingCount > 0
      ? [...visibleItems, `${remainingCount} more`]
      : visibleItems;

  if (itemsToJoin.length === 2) {
    return `${itemsToJoin[0]} and ${itemsToJoin[1]}`;
  }

  return `${itemsToJoin.slice(0, -1).join(", ")}, and ${itemsToJoin.at(-1)}`;
}

function joinNarrativeClauses(clauses: string[]) {
  if (clauses.length === 0) {
    return "";
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  if (clauses.length === 2) {
    return `${clauses[0]} and ${clauses[1]}`;
  }

  return `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1)}`;
}

function buildFallbackRoleNarrative(options: PrintableRoleNarrativeInput) {
  const paragraphs: string[] = [];
  const trimmedDescription = options.roleDescription?.trim();

  if (trimmedDescription) {
    paragraphs.push(trimmedDescription);
  }

  const idealCompetencyClauses: string[] = [];

  if (options.idealCompetencies.talents.length > 0) {
    idealCompetencyClauses.push(
      `natural talents such as ${joinNarrativeList(options.idealCompetencies.talents)}`,
    );
  }

  if (options.idealCompetencies.skills.length > 0) {
    idealCompetencyClauses.push(
      `practical skills like ${joinNarrativeList(options.idealCompetencies.skills)}`,
    );
  }

  if (options.idealCompetencies.behaviors.length > 0) {
    idealCompetencyClauses.push(
      `observable behaviors including ${joinNarrativeList(options.idealCompetencies.behaviors)}`,
    );
  }

  if (idealCompetencyClauses.length > 0) {
    paragraphs.push(
      `The strongest profile for ${options.roleTitle} combines ${joinNarrativeClauses(idealCompetencyClauses)}.`,
    );
  }

  if (options.roleCompetencies.length > 0) {
    const competencyNames = options.roleCompetencies.map((competency) => competency.name);
    const competencyDefinitions = options.roleCompetencies
      .map((competency) => competency.definition?.trim())
      .filter(Boolean);

    paragraphs.push(
      `Success in this role shows up through ${joinNarrativeList(competencyNames, 5)}.`,
    );

    if (competencyDefinitions.length > 0) {
      paragraphs.push(competencyDefinitions.slice(0, 3).join(" "));
    }
  }

  if (options.assignedMentors.length > 0) {
    paragraphs.push(
      `Current mentor alignment for this role includes ${joinNarrativeList(options.assignedMentors, 3)}.`,
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      `A printable narrative has not been generated for ${options.roleTitle} yet.`,
    );
  }

  return paragraphs;
}

export function resolvePrintableRoleNarrative(
  options: PrintableRoleNarrativeInput,
) {
  const narrativeParagraphs =
    options.compositeNarrativeParagraphs.length > 0
      ? options.compositeNarrativeParagraphs
      : buildFallbackRoleNarrative(options);

  return {
    ...options,
    narrativeParagraphs,
  };
}

function heading(text: string, size = 28) {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [
      new TextRun({
        text,
        bold: true,
        size,
      }),
    ],
  });
}

function subheading(text: string) {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
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

export async function buildPrintableRoleNarrativeDocumentBuffer(options: {
  organizationName: string;
  narrative: ReturnType<typeof resolvePrintableRoleNarrative>;
}) {
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: options.organizationName,
          bold: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${options.narrative.roleTitle} Printable Role Narrative`,
          bold: true,
          size: 34,
        }),
      ],
    }),
    body(
      options.narrative.roleDepartment
        ? `Department: ${options.narrative.roleDepartment}`
        : "Department: Not entered",
    ),
    body(`Status: ${options.narrative.roleStatus}`),
    body(
      `Assigned mentors: ${
        options.narrative.assignedMentors.length > 0
          ? options.narrative.assignedMentors.join(", ")
          : "None yet"
      }`,
    ),
  ];

  if (options.narrative.roleDescription?.trim()) {
    children.push(body(options.narrative.roleDescription.trim()));
  }

  children.push(heading("Role Narrative"));
  options.narrative.narrativeParagraphs.forEach((paragraph) => {
    children.push(body(paragraph));
  });

  children.push(heading("Ideal Candidate Competencies"));
  [
    { title: "Talents", items: options.narrative.idealCompetencies.talents },
    { title: "Skills", items: options.narrative.idealCompetencies.skills },
    { title: "Behaviors", items: options.narrative.idealCompetencies.behaviors },
  ].forEach((group) => {
    children.push(subheading(group.title));
    if (group.items.length > 0) {
      group.items.forEach((item) => children.push(bullet(item)));
      return;
    }

    children.push(body(`No ${group.title.toLowerCase()} attached yet.`));
  });

  children.push(heading("Composite Competency Areas"));
  if (options.narrative.roleCompetencies.length === 0) {
    children.push(
      body(
        "No generated composite sections exist for this role yet. Add competencies and generate the composite first.",
      ),
    );
  } else {
    options.narrative.roleCompetencies.forEach((competency, index) => {
      children.push(
        subheading(`${index + 1}. ${competency.name}`),
        body(
          `Target score: ${competency.target_score.toFixed(2)} | Weight: ${competency.weight.toFixed(2)}`,
        ),
        body(competency.definition),
        body("Behavioral Indicators"),
      );

      if (competency.behavioral_indicators.length > 0) {
        competency.behavioral_indicators.forEach((item) => {
          children.push(bullet(item));
        });
      } else {
        children.push(body("No behavioral indicators saved yet."));
      }

      children.push(body("Red Flags"));
      if (competency.red_flags.length > 0) {
        competency.red_flags.forEach((item) => {
          children.push(bullet(item));
        });
      } else {
        children.push(body("No red flags saved yet."));
      }
    });
  }

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
