import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";
import {
  buildCandidateSpecificProjectDescription,
  buildMentoringProjectAssignmentNotes,
  buildMentoringSourceProject,
  type MentoringSourceProject,
} from "@/lib/mentoring-source-project";

const STORAGE_KEY = "lcs:pending-mentoring-project-transfer";

export type PendingMentoringProjectTransfer = {
  candidateId: string;
  roleId: string;
  mentorProfileId: string | null;
  competencyName: string;
  idea: GeneratedCandidateMentoringIdea;
  projectId: string | null;
  recordId: string | null;
  savedAt: string;
};

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function storePendingMentoringProjectTransfer(
  transfer: PendingMentoringProjectTransfer,
) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(transfer));
}

export function readPendingMentoringProjectTransfer() {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingMentoringProjectTransfer;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPendingMentoringProjectTransfer() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(STORAGE_KEY);
}

export function buildPendingMentoringTransferProject(options: {
  roleTitle: string;
  startDate: string | null;
  transfer: PendingMentoringProjectTransfer;
}) {
  const dateAssigned =
    options.startDate ?? new Date().toISOString().slice(0, 10);
  const dueDate = new Date(`${dateAssigned}T00:00:00`);
  dueDate.setDate(dueDate.getDate() + options.transfer.idea.duration_days);

  return buildMentoringSourceProject({
    id:
      options.transfer.projectId ??
      `pending-project-transfer:${options.transfer.savedAt}`,
    projectId:
      options.transfer.projectId ??
      `pending-project-transfer:${options.transfer.savedAt}`,
    title: options.transfer.idea.title,
    description: buildCandidateSpecificProjectDescription(options.transfer.idea),
    durationDays: options.transfer.idea.duration_days,
    competencyNames: options.transfer.competencyName
      ? [options.transfer.competencyName]
      : [],
    applicableRoles: [options.roleTitle],
    successMeasures: options.transfer.idea.success_measures,
    reflectionQuestions: options.transfer.idea.reflection_questions,
    successSignals: options.transfer.idea.success_signals,
    startDate: dateAssigned,
    dueDate: dueDate.toISOString().slice(0, 10),
    status: "assigned",
    mentorNotes: buildMentoringProjectAssignmentNotes({
      roleTitle: options.roleTitle,
      competencyName: options.transfer.competencyName,
    }),
  }) satisfies MentoringSourceProject;
}
