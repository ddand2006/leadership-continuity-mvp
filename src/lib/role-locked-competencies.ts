import { canonicalizeRoleTitle } from "@/lib/role-title";

type LockedRoleCompetency = {
  name: string;
  definition: string;
  weight: number;
  target_score: number;
  behavioral_indicators: string[];
  red_flags: string[];
};

const LOCKED_VP_PATIENT_CARE_SERVICES_COMPETENCIES: LockedRoleCompetency[] = [
  {
    name: "Relational Leadership",
    definition:
      "Builds trust across clinical and operational relationships through visible presence, clear communication, and steady leadership in difficult situations.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Builds trust with nurses, providers, and cross-functional leaders",
      "Addresses difficult performance or culture issues directly and respectfully",
      "Repairs strained relationships without avoiding accountability",
    ],
    red_flags: [
      "Avoids hard relational conversations",
      "Allows mistrust or siloed behavior to persist",
      "Responds defensively when relationships become strained",
    ],
  },
  {
    name: "Accountability",
    definition:
      "Owns outcomes, sets clear standards, and responds to performance gaps with responsibility, follow-through, and corrective action.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Takes ownership when results fall short",
      "Sets clear expectations and follows through on commitments",
      "Learns visibly from decisions that did not work",
    ],
    red_flags: [
      "Blames external factors instead of taking responsibility",
      "Lets standards drift without intervention",
      "Fails to close the loop after identifying a problem",
    ],
  },
  {
    name: "Systems Thinking",
    definition:
      "Sees how decisions affect finance, quality, staffing, and operations across the broader organization and adjusts plans accordingly.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Anticipates downstream consequences across departments",
      "Connects operational decisions to quality and financial impact",
      "Partners cross-functionally to solve enterprise-level problems",
    ],
    red_flags: [
      "Optimizes one area while creating problems in another",
      "Misses downstream operational or financial consequences",
      "Works too narrowly within department lines",
    ],
  },
  {
    name: "Emotional Intelligence",
    definition:
      "Demonstrates self-awareness, composure, empathy, and emotional steadiness under pressure while leading others through tense situations.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Stays composed during high-pressure situations",
      "Reads team dynamics accurately and adjusts approach",
      "De-escalates conflict without losing clarity or standards",
    ],
    red_flags: [
      "Escalates tension through reactivity or defensiveness",
      "Misreads how others are experiencing the situation",
      "Loses composure when challenged",
    ],
  },
  {
    name: "People Development",
    definition:
      "Builds leadership depth by identifying talent early, coaching intentionally, and developing staff into stronger contributors and future leaders.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Spots high-potential staff and invests in their growth",
      "Coaches under-performers with clarity and follow-through",
      "Develops others into larger leadership responsibilities",
    ],
    red_flags: [
      "Keeps development informal or inconsistent",
      "Avoids direct coaching of under-performance",
      "Fails to create a visible leadership pipeline",
    ],
  },
  {
    name: "Stewardship",
    definition:
      "Protects the mission, culture, and long-term health of patient care services through principled decision-making and courage under pressure.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Makes decisions that protect culture and quality over convenience",
      "Understands how nursing culture influences patient outcomes",
      "Acts as a faithful steward of the VP-PCS role and its broader responsibility",
    ],
    red_flags: [
      "Compromises standards to avoid conflict",
      "Treats the role too narrowly or transactionally",
      "Fails to connect culture to patient care outcomes",
    ],
  },
  {
    name: "Technical Competence",
    definition:
      "Leads patient care services with credible command of quality systems, regulatory readiness, staffing models, and financial fundamentals.",
    weight: 1,
    target_score: 4,
    behavioral_indicators: [
      "Leads quality and patient safety systems with confidence",
      "Maintains readiness for CMS, Joint Commission, and other regulatory expectations",
      "Manages staffing, labor, and budgeting decisions with sound judgment",
    ],
    red_flags: [
      "Shows limited command of quality or regulatory systems",
      "Cannot explain staffing or labor decisions clearly",
      "Lacks practical financial understanding for the role",
    ],
  },
];

export function hasLockedRoleCompetencies(roleTitle: string) {
  return canonicalizeRoleTitle(roleTitle) === "VP - Patient Care Services";
}

export function getLockedRoleCompetencies(roleTitle: string) {
  if (!hasLockedRoleCompetencies(roleTitle)) {
    return null;
  }

  return LOCKED_VP_PATIENT_CARE_SERVICES_COMPETENCIES.map((competency) => ({
    ...competency,
    behavioral_indicators: [...competency.behavioral_indicators],
    red_flags: [...competency.red_flags],
  }));
}
