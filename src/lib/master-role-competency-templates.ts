export type MasterRoleCompetencyTemplate = {
  id: string;
  industry: string | null;
  role_title: string;
  role_family: string | null;
  default_department: string | null;
  description: string | null;
  talents: string[];
  skills: string[];
  behaviors: string[];
};

const FALLBACK_MASTER_ROLE_COMPETENCY_TEMPLATES: MasterRoleCompetencyTemplate[] = [
  {
    id: "healthcare-ceo",
    industry: "Healthcare",
    role_title: "CEO",
    role_family: "Executive Leadership",
    default_department: "Administration",
    description:
      "Leads the enterprise, aligns mission and performance, and builds executive accountability across the organization.",
    talents: ["Enterprise thinker", "Decisive under pressure", "Relationship builder"],
    skills: ["Strategic planning", "Board communication", "Culture stewardship"],
    behaviors: [
      "Sets system-wide direction clearly",
      "Makes high-stakes decisions with accountability",
      "Builds trust across clinical and business leaders",
    ],
  },
  {
    id: "healthcare-cfo",
    industry: "Healthcare",
    role_title: "CFO",
    role_family: "Executive Leadership",
    default_department: "Finance",
    description:
      "Guides financial stewardship, capital planning, and enterprise decision-making with operational credibility.",
    talents: ["Analytical thinker", "Steady under scrutiny", "Long-range planner"],
    skills: ["Financial strategy", "Capital planning", "Executive communication"],
    behaviors: [
      "Translates financial risk into operational decisions",
      "Balances mission with margin discipline",
      "Builds confidence through data-backed recommendations",
    ],
  },
  {
    id: "healthcare-coo",
    industry: "Healthcare",
    role_title: "COO",
    role_family: "Executive Leadership",
    default_department: "Operations",
    description:
      "Coordinates operational execution across departments and turns strategic goals into measurable daily performance.",
    talents: ["Systems thinker", "Execution focused", "Cross-functional organizer"],
    skills: ["Operational planning", "Performance management", "Change leadership"],
    behaviors: [
      "Clarifies owners and expectations across departments",
      "Resets broken workflows without delay",
      "Leads accountability conversations with peers directly",
    ],
  },
  {
    id: "healthcare-chief-nursing-officer",
    industry: "Healthcare",
    role_title: "Chief Nursing Officer",
    role_family: "Clinical Leadership",
    default_department: "Nursing",
    description:
      "Leads nursing practice, patient care standards, and workforce readiness across the clinical enterprise.",
    talents: ["Clinical judgment", "People developer", "Calm presence"],
    skills: ["Nursing operations", "Quality leadership", "Leader coaching"],
    behaviors: [
      "Sets clear expectations for nursing leaders",
      "Addresses patient care breakdowns with urgency",
      "Builds capability through direct coaching and follow-through",
    ],
  },
  {
    id: "healthcare-vp-patient-care-services",
    industry: "Healthcare",
    role_title: "VP - Patient Care Services",
    role_family: "Clinical Leadership",
    default_department: "Patient Care Services",
    description:
      "Leads patient care delivery across service lines and ensures cross-departmental accountability for patient outcomes.",
    talents: ["Influences across boundaries", "Operationally aware", "Mission anchored"],
    skills: ["Cross-functional leadership", "Patient flow improvement", "Escalation management"],
    behaviors: [
      "Names recurring care-delay patterns directly",
      "Drives shared ownership across departments",
      "Balances empathy with executive accountability",
    ],
  },
  {
    id: "healthcare-leadership-intern",
    industry: "Healthcare",
    role_title: "Leadership Intern",
    role_family: "Emerging Leader",
    default_department: "Administration",
    description:
      "Builds early leadership readiness through exposure to operations, communication, and structured stretch work.",
    talents: ["Curious learner", "Adaptable contributor", "Relationship oriented"],
    skills: ["Professional communication", "Project coordination", "Problem solving"],
    behaviors: [
      "Asks thoughtful questions and follows through",
      "Connects daily work to larger organizational goals",
      "Responds to feedback with visible improvement",
    ],
  },
  {
    id: "all-industries-director-operations",
    industry: null,
    role_title: "Director of Operations",
    role_family: "Operations Leadership",
    default_department: "Operations",
    description:
      "Leads daily execution, process reliability, and team coordination while translating strategy into repeatable results.",
    talents: ["Process minded", "Resourceful arranger", "Outcome oriented"],
    skills: ["Project management", "Team leadership", "Operational problem solving"],
    behaviors: [
      "Creates clear operating rhythm for the team",
      "Escalates barriers before they become chronic",
      "Improves workflows with measurable follow-through",
    ],
  },
  {
    id: "all-industries-human-resources-director",
    industry: null,
    role_title: "Human Resources Director",
    role_family: "People Leadership",
    default_department: "Human Resources",
    description:
      "Leads people systems, talent decisions, and culture practices that strengthen workforce performance and trust.",
    talents: ["Trusted advisor", "Discerning listener", "Balanced decision maker"],
    skills: ["Talent management", "Conflict resolution", "Policy leadership"],
    behaviors: [
      "Holds fairness and accountability together",
      "Guides difficult people decisions with clarity",
      "Builds credibility through steady follow-through",
    ],
  },
  {
    id: "all-industries-cfo",
    industry: null,
    role_title: "CFO",
    role_family: "Executive Leadership",
    default_department: "Finance",
    description:
      "Leads financial discipline, planning, and risk management while helping the organization make confident strategic decisions.",
    talents: ["Analytical thinker", "Judgment oriented", "Composed under pressure"],
    skills: ["Financial forecasting", "Executive reporting", "Risk assessment"],
    behaviors: [
      "Frames decisions with financial clarity",
      "Communicates tradeoffs in plain language",
      "Protects long-term stability without slowing action unnecessarily",
    ],
  },
  {
    id: "all-industries-ceo",
    industry: null,
    role_title: "CEO",
    role_family: "Executive Leadership",
    default_department: "Administration",
    description:
      "Provides enterprise direction, aligns leadership teams, and carries responsibility for long-term organizational performance.",
    talents: ["Vision oriented", "Enterprise connector", "Resilient decision maker"],
    skills: ["Strategic leadership", "Stakeholder communication", "Culture building"],
    behaviors: [
      "Sets direction that others can repeat clearly",
      "Makes decisions that balance people, mission, and results",
      "Develops the next generation of leaders intentionally",
    ],
  },
];

export function isMissingMasterRoleCompetencyTemplatesTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("master_role_competency_templates") &&
      error.message.includes("schema cache"),
  );
}

export function getFallbackMasterRoleCompetencyTemplates(industry: string | null) {
  const normalizedIndustry = industry?.trim().toLowerCase() ?? null;

  return FALLBACK_MASTER_ROLE_COMPETENCY_TEMPLATES.filter((template) => {
    if (!template.industry) {
      return true;
    }

    return template.industry.trim().toLowerCase() === normalizedIndustry;
  }).sort((left, right) => {
    const leftScore = left.industry ? 0 : 1;
    const rightScore = right.industry ? 0 : 1;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.role_title.localeCompare(right.role_title);
  });
}
