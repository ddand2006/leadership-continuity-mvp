import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";

function getStorageKey(options: {
  candidateId: string;
  roleId: string;
  competencyId: string;
}) {
  return `lcs:generated-mentoring-ideas:${options.candidateId}:${options.roleId}:${options.competencyId}`;
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readGeneratedMentoringIdeasCache(options: {
  candidateId: string;
  roleId: string;
  competencyId: string;
}) {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(getStorageKey(options));

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as GeneratedCandidateMentoringIdea[];
  } catch {
    storage.removeItem(getStorageKey(options));
    return null;
  }
}

export function writeGeneratedMentoringIdeasCache(
  options: {
    candidateId: string;
    roleId: string;
    competencyId: string;
  },
  ideas: GeneratedCandidateMentoringIdea[],
) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(getStorageKey(options), JSON.stringify(ideas));
}
