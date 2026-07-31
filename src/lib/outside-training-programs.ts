export type TrainingMatchStrength = "strong" | "moderate" | "supporting";

export type TemporaryTrainingProgram = {
  id: string;
  name: string;
  provider: string;
  description: string;
  websiteUrl: string;
  deliveryFormat: string;
  typicalDuration: string;
  intendedAudience: string;
  internalNote: string;
  competencyMatches: Array<{
    competencyNames: string[];
    strength: TrainingMatchStrength;
    explanation: string;
  }>;
};

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const strengthOrder: Record<TrainingMatchStrength, number> = {
  strong: 0,
  moderate: 1,
  supporting: 2,
};

// Phase-one catalog: preliminary research only. A future training-program
// catalog will replace this module with organization-managed data.
export const temporaryTrainingPrograms: TemporaryTrainingProgram[] = [
  {
    id: "seven-habits",
    name: "The 7 Habits of Highly Effective People",
    provider: "FranklinCovey",
    description:
      "A leadership and personal-effectiveness program centered on trust, execution, collaboration, and intentional habits.",
    websiteUrl: "https://www.franklincovey.com/the-7-habits/",
    deliveryFormat: "In person, virtual, or facilitated cohort",
    typicalDuration: "Flexible multi-session program",
    intendedAudience: "Emerging leaders, managers, and senior leaders",
    internalNote: "Preliminary program information — not a formal endorsement.",
    competencyMatches: [
      {
        competencyNames: ["Relational Leadership", "Relationship Building"],
        strength: "strong",
        explanation: "Builds trust, collaboration, and relationship-centered leadership habits.",
      },
      {
        competencyNames: ["Accountability", "Personal Effectiveness"],
        strength: "strong",
        explanation: "Reinforces personal responsibility and disciplined execution.",
      },
      {
        competencyNames: ["Emotional Intelligence", "People Development"],
        strength: "moderate",
        explanation: "Supports self-awareness and constructive work with others.",
      },
    ],
  },
  {
    id: "situational-leadership",
    name: "Situational Leadership",
    provider: "The Ken Blanchard Companies",
    description:
      "A practical manager-development program for adapting leadership style, coaching people, and improving performance conversations.",
    websiteUrl: "https://www.kenblanchard.com/",
    deliveryFormat: "Virtual, in person, or facilitated cohort",
    typicalDuration: "Half-day to multi-session program",
    intendedAudience: "Frontline managers and mid-level leaders",
    internalNote: "Preliminary program information — not a formal endorsement.",
    competencyMatches: [
      {
        competencyNames: ["People Development", "Coaching", "Mentoring"],
        strength: "strong",
        explanation: "Focuses on adapting coaching and direction to individual readiness.",
      },
      {
        competencyNames: ["Relational Leadership", "Accountability", "Communication"],
        strength: "moderate",
        explanation: "Strengthens manager conversations, expectations, and follow-through.",
      },
    ],
  },
  {
    id: "crucial-conversations",
    name: "Crucial Conversations",
    provider: "Crucial Learning",
    description:
      "A communication program for candid, respectful dialogue when the stakes are high and perspectives differ.",
    websiteUrl: "https://cruciallearning.com/",
    deliveryFormat: "Virtual live, in person, or self-paced",
    typicalDuration: "One to two days",
    intendedAudience: "Managers, leaders, mentors, and cross-functional teams",
    internalNote: "Preliminary program information — not a formal endorsement.",
    competencyMatches: [
      {
        competencyNames: ["Communication", "Conflict Management", "Accountability"],
        strength: "strong",
        explanation: "Develops direct communication, accountability, and skill in difficult conversations.",
      },
      {
        competencyNames: ["Relational Leadership", "Emotional Intelligence"],
        strength: "moderate",
        explanation: "Supports trust and emotional regulation during high-stakes dialogue.",
      },
    ],
  },
  {
    id: "leadership-challenge",
    name: "The Leadership Challenge",
    provider: "Leadership Challenge / Wiley",
    description:
      "An evidence-based leadership program that helps leaders model values, inspire a shared vision, challenge processes, and enable others.",
    websiteUrl: "https://www.leadershipchallenge.com/",
    deliveryFormat: "In person, virtual, or cohort",
    typicalDuration: "Multi-session program",
    intendedAudience: "Emerging through senior leaders",
    internalNote: "Preliminary program information — not a formal endorsement.",
    competencyMatches: [
      {
        competencyNames: ["Leadership", "People Development", "Relational Leadership"],
        strength: "strong",
        explanation: "Addresses core leadership practices, enabling others, and relationship-based leadership.",
      },
      {
        competencyNames: ["Vision and Strategy", "Strategic Thinking", "Accountability"],
        strength: "moderate",
        explanation: "Supports vision-setting, challenge, and follow-through.",
      },
    ],
  },
  {
    id: "speed-of-trust",
    name: "The Speed of Trust",
    provider: "FranklinCovey",
    description:
      "A trust-centered program that links credibility and behavior to collaboration, execution, and organizational culture.",
    websiteUrl: "https://www.franklincovey.com/the-speed-of-trust/",
    deliveryFormat: "Virtual, in person, or facilitated cohort",
    typicalDuration: "One day or multi-session program",
    intendedAudience: "Managers, senior leaders, and cross-functional teams",
    internalNote: "Preliminary program information — not a formal endorsement.",
    competencyMatches: [
      {
        competencyNames: ["Trust", "Relational Leadership", "Organizational Culture"],
        strength: "strong",
        explanation: "Builds credible, trust-based relationships and a healthier organizational culture.",
      },
      {
        competencyNames: ["Communication", "Accountability"],
        strength: "moderate",
        explanation: "Connects clear communication and accountable behavior to trust.",
      },
    ],
  },
];

export function getTrainingProgramMatches(competencyName: string) {
  const normalizedCompetencyName = normalize(competencyName);

  return temporaryTrainingPrograms
    .flatMap((program) =>
      program.competencyMatches.flatMap((match) => {
        const isMatch = match.competencyNames.some(
          (name) => normalize(name) === normalizedCompetencyName,
        );

        return isMatch ? [{ program, match }] : [];
      }),
    )
    .sort((left, right) => strengthOrder[left.match.strength] - strengthOrder[right.match.strength]);
}

export function normalizeTrainingCompetencyName(value: string) {
  return normalize(value);
}
