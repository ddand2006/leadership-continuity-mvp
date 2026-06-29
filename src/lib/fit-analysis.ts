import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

type ScoreRecord = {
  competency_id: string;
  score_numeric: number;
  evidence_notes: string | null;
  concern_notes: string | null;
};

type CompetencyRecord = {
  id: string;
  name: string;
  target_score: number;
  weight: number;
};

type StrengthAssessmentRecord = {
  competency_id: string;
  rationale?: string | null;
  strength_score: number;
  supporting_strengths?: string[] | null;
};

type StrengthRecord = {
  theme_name: string;
  rank: number;
  domain: string;
};

export type DevelopmentProjectRecord = {
  title: string;
  description: string;
  difficulty: string;
  duration_days: number;
  applicable_roles: string[];
  competencies_developed: string[];
  strengths_leveraged: string[];
  expected_outcomes?: string[];
  mentor_questions?: string[];
  evidence_of_success?: string[];
};

export type CompetencyAssessment = {
  competencyId: string;
  competencyName: string;
  targetScore: number;
  averageScore: number;
  interviewScore: number | null;
  strengthsScore: number | null;
  weight: number;
  weightedGap: number;
  status: "Strong Match" | "Near Match / Develop" | "Development Priority";
  evidenceNotes: string[];
  concernNotes: string[];
  strengthsRationale: string | null;
  supportingStrengths: string[];
};

export type RankedProjectMatch = {
  title: string;
  description: string;
  difficulty: string;
  durationDays: number;
  score: number;
  competencyMatches: string[];
  strengthMatches: string[];
  roleMatch: boolean;
  expectedOutcomes: string[];
  mentorQuestions: string[];
  evidenceOfSuccess: string[];
};

export function getFitStatus(averageScore: number, targetScore: number) {
  if (averageScore >= targetScore) {
    return "Strong Match" as const;
  }

  if (averageScore >= targetScore - 0.75) {
    return "Near Match / Develop" as const;
  }

  return "Development Priority" as const;
}

export function buildCompetencyAssessments(
  competencies: CompetencyRecord[],
  scores: ScoreRecord[],
  strengthAssessments: StrengthAssessmentRecord[] = [],
) {
  const strengthAssessmentMap = new Map(
    strengthAssessments.map((assessment) => [assessment.competency_id, assessment]),
  );

  return competencies
    .map((competency) => {
      const competencyScores = scores.filter(
        (score) => score.competency_id === competency.id,
      );

      const interviewScore =
        competencyScores.length > 0
          ? competencyScores.reduce((sum, score) => sum + score.score_numeric, 0) /
            competencyScores.length
          : null;
      const strengthsAssessment = strengthAssessmentMap.get(competency.id);
      const strengthsScore = strengthsAssessment
        ? Number(strengthsAssessment.strength_score)
        : null;
      const averageScore =
        interviewScore !== null && strengthsScore !== null
          ? interviewScore * 0.7 + strengthsScore * 0.3
          : interviewScore ?? strengthsScore ?? 0;

      const weightedGap = Number(
        ((competency.target_score - averageScore) * competency.weight).toFixed(2),
      );

      return {
        competencyId: competency.id,
        competencyName: sanitizeAppText(competency.name),
        targetScore: competency.target_score,
        averageScore: Number(averageScore.toFixed(2)),
        interviewScore:
          interviewScore !== null ? Number(interviewScore.toFixed(2)) : null,
        strengthsScore:
          strengthsScore !== null ? Number(strengthsScore.toFixed(2)) : null,
        weight: competency.weight,
        weightedGap,
        status: getFitStatus(averageScore, competency.target_score),
        evidenceNotes: competencyScores
          .map((score) => score.evidence_notes)
          .filter((note): note is string => Boolean(note))
          .map((note) => sanitizeAppText(note)),
        concernNotes: competencyScores
          .map((score) => score.concern_notes)
          .filter((note): note is string => Boolean(note))
          .map((note) => sanitizeAppText(note)),
        strengthsRationale: sanitizeAppText(strengthsAssessment?.rationale ?? null) || null,
        supportingStrengths: sanitizeAppTextList(
          strengthsAssessment?.supporting_strengths ?? [],
        ),
      };
    })
    .sort((left, right) => right.weightedGap - left.weightedGap);
}

export function categorizeStrengths(strengths: StrengthRecord[]) {
  const orderedStrengths = [...strengths].sort((left, right) => left.rank - right.rank);

  return {
    primary: orderedStrengths.filter((strength) => strength.rank <= 10),
    supporting: orderedStrengths.filter(
      (strength) => strength.rank >= 11 && strength.rank <= 20,
    ),
    stretch: orderedStrengths.filter((strength) => strength.rank >= 21),
  };
}

export function computeOverallReadiness(assessments: CompetencyAssessment[]) {
  const totalWeight = assessments.reduce((sum, item) => sum + item.weight, 0);
  const weightedAverage =
    totalWeight > 0
      ? assessments.reduce(
          (sum, item) => sum + item.averageScore * item.weight,
          0,
        ) / totalWeight
      : 0;

  return Number(weightedAverage.toFixed(2));
}

function getPreferredDifficulties(readiness: number) {
  if (readiness < 3.5) {
    return ["foundational", "intermediate"];
  }

  if (readiness < 4.1) {
    return ["intermediate", "foundational", "advanced"];
  }

  return ["advanced", "intermediate"];
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function rankDevelopmentProjects(
  projects: DevelopmentProjectRecord[],
  roleTitle: string,
  developmentPriorities: string[],
  leverageStrengths: string[],
  readiness: number,
) {
  const preferredDifficulties = getPreferredDifficulties(readiness);

  return projects
    .map((project) => {
      const competencyMatches = project.competencies_developed.filter((competency) =>
        developmentPriorities.includes(competency),
      );
      const strengthMatches = project.strengths_leveraged.filter((strength) =>
        leverageStrengths.includes(strength),
      );
      const roleMatch = project.applicable_roles.includes(roleTitle);
      const difficultyScore = Math.max(
        0,
        preferredDifficulties.length - preferredDifficulties.indexOf(project.difficulty),
      );
      const score =
        competencyMatches.length * 4 +
        strengthMatches.length * 3 +
        (roleMatch ? 3 : 0) +
        difficultyScore;

      return {
        title: project.title,
        description: project.description,
        difficulty: project.difficulty,
        durationDays: project.duration_days,
        score,
        competencyMatches,
        strengthMatches,
        roleMatch,
        expectedOutcomes: project.expected_outcomes ?? [],
        mentorQuestions: project.mentor_questions ?? [],
        evidenceOfSuccess: project.evidence_of_success ?? [],
      };
    })
    .filter((project) => project.score > 0)
    .sort((left, right) => right.score - left.score || left.durationDays - right.durationDays);
}

export function rankMentoringIdeasForCompetency(
  projects: DevelopmentProjectRecord[],
  options: {
    roleTitle: string;
    competencyName: string;
    supportingStrengths: string[];
    leverageStrengths: string[];
    readiness: number;
  },
) {
  const preferredDifficulties = getPreferredDifficulties(options.readiness);
  const normalizedCompetencyName = normalizeText(options.competencyName);
  const competencyTokens = new Set(tokenize(options.competencyName));
  const prioritizedStrengths = Array.from(
    new Set([...options.supportingStrengths, ...options.leverageStrengths]),
  );

  return projects
    .map((project) => {
      const competencyMatches = project.competencies_developed.filter((competency) => {
        const normalizedProjectCompetency = normalizeText(competency);

        if (
          normalizedCompetencyName.includes(normalizedProjectCompetency) ||
          normalizedProjectCompetency.includes(normalizedCompetencyName)
        ) {
          return true;
        }

        const overlapCount = tokenize(competency).filter((token) =>
          competencyTokens.has(token),
        ).length;

        return overlapCount >= 1;
      });
      const strengthMatches = project.strengths_leveraged.filter((strength) =>
        prioritizedStrengths.includes(strength),
      );
      const roleMatch = project.applicable_roles.includes(options.roleTitle);
      const difficultyIndex = preferredDifficulties.indexOf(project.difficulty);
      const difficultyScore =
        difficultyIndex >= 0
          ? preferredDifficulties.length - difficultyIndex
          : 0;
      const score =
        competencyMatches.length * 5 +
        strengthMatches.length * 3 +
        (roleMatch ? 3 : 0) +
        difficultyScore;

      return {
        title: project.title,
        description: project.description,
        difficulty: project.difficulty,
        durationDays: project.duration_days,
        score,
        competencyMatches,
        strengthMatches,
        roleMatch,
        expectedOutcomes: project.expected_outcomes ?? [],
        mentorQuestions: project.mentor_questions ?? [],
        evidenceOfSuccess: project.evidence_of_success ?? [],
      };
    })
    .filter((project) => project.score > 0)
    .sort((left, right) => right.score - left.score || left.durationDays - right.durationDays);
}
