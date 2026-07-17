"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";
import type { RankedProjectMatch } from "@/lib/fit-analysis";
import { buildDevelopmentPriorityEvidenceSummary } from "@/lib/mentor-report";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

type RoleMatch = {
  competency: string;
  why_it_fits: string;
};

type DevelopmentPriority = {
  competency: string;
  why_it_matters: string;
  evidence: string;
};

type StrengthToLeverage = {
  competency: string;
  strength: string;
  application: string;
};

type Assessment = {
  competencyId: string;
  competencyName: string;
  targetScore: number;
  averageScore: number;
  interviewScore: number | null;
  strengthsScore: number | null;
  weightedGap: number;
  status: "Strong Match" | "Near Match / Develop" | "Development Priority";
  evidenceNotes: string[];
  concernNotes: string[];
  strengthsRationale: string | null;
  supportingStrengths: string[];
};

type LibraryIdeasByCompetencyId = Record<string, RankedProjectMatch[]>;

function projectTypeLabel(projectType: GeneratedCandidateMentoringIdea["project_type"]) {
  return projectType === "cross_departmental"
    ? "Cross-Departmental Project"
    : "Departmental Project";
}

function ActionButtons({
  canGenerate,
  isGenerating,
  hasGeneratedIdeas,
  isDownloadingSet,
  onGenerate,
  onDownloadSet,
}: {
  canGenerate: boolean;
  isGenerating: boolean;
  hasGeneratedIdeas: boolean;
  isDownloadingSet: boolean;
  onGenerate: () => void;
  onDownloadSet: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        {isGenerating
          ? "Generating Ideas..."
          : hasGeneratedIdeas
            ? "Regenerate Ideas for Improvement"
            : "Generate Ideas for Improvement"}
      </button>
      <button
        type="button"
        onClick={onDownloadSet}
        disabled={!hasGeneratedIdeas || isDownloadingSet}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {isDownloadingSet ? "Preparing Word Doc..." : "Download Idea Set (Word)"}
      </button>
    </div>
  );
}

export function MentorReportMatchExplorer({
  matches,
  developmentPriorities,
  strengthsToLeverage,
  assessments,
  libraryIdeasByCompetencyId,
  candidateId,
  candidateName,
  roleId,
  canGenerateCandidateIdeas,
}: {
  matches: RoleMatch[];
  developmentPriorities: DevelopmentPriority[];
  strengthsToLeverage: StrengthToLeverage[];
  assessments: Assessment[];
  libraryIdeasByCompetencyId: LibraryIdeasByCompetencyId;
  candidateId: string;
  candidateName: string;
  roleId: string | null;
  canGenerateCandidateIdeas: boolean;
}) {
  const router = useRouter();
  const [selectedCompetencyName, setSelectedCompetencyName] = useState(
    matches[0]?.competency ?? "",
  );
  const [generatedIdeasByCompetency, setGeneratedIdeasByCompetency] = useState<
    Record<string, GeneratedCandidateMentoringIdea[]>
  >({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingSet, setIsDownloadingSet] = useState(false);
  const [isChoosingTitle, setIsChoosingTitle] = useState<string | null>(null);
  const [isDownloadingTitle, setIsDownloadingTitle] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selectedMatch =
    matches.find((match) => match.competency === selectedCompetencyName) ?? matches[0] ?? null;
  const selectedAssessment =
    assessments.find(
      (assessment) => assessment.competencyName === selectedCompetencyName,
    ) ?? null;
  const selectedPriority =
    developmentPriorities.find(
      (priority) => priority.competency === selectedCompetencyName,
    ) ?? null;
  const selectedStrengthItems = strengthsToLeverage.filter(
    (item) => item.competency === selectedCompetencyName,
  );
  const selectedGeneratedIdeas = selectedAssessment
    ? generatedIdeasByCompetency[selectedAssessment.competencyId] ?? []
    : [];
  const selectedLibraryIdeas = selectedAssessment
    ? libraryIdeasByCompetencyId[selectedAssessment.competencyId] ?? []
    : [];

  const canGenerateForSelectedCompetency = Boolean(
    canGenerateCandidateIdeas && roleId && selectedAssessment,
  );

  const evidenceList = useMemo(() => {
    if (!selectedAssessment) {
      return [];
    }

    return [
      ...selectedAssessment.evidenceNotes.map((note) => `Observed evidence: ${note}`),
      ...selectedAssessment.concernNotes.map((note) => `Concern to address: ${note}`),
    ];
  }, [selectedAssessment]);

  const alignedPriorityEvidence = useMemo(() => {
    if (!selectedAssessment) {
      return null;
    }

    return buildDevelopmentPriorityEvidenceSummary(selectedAssessment);
  }, [selectedAssessment]);

  async function handleGenerateIdeas() {
    if (!selectedAssessment || !roleId) {
      setGenerationError("Choose a candidate role and competency first.");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationError(null);
      setActionMessage(null);

      const response = await fetch("/api/candidates/generate-mentoring-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          competencyId: selectedAssessment.competencyId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        ideas?: GeneratedCandidateMentoringIdea[];
      };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to generate candidate-specific mentoring ideas.",
        );
      }

      setGeneratedIdeasByCompetency((current) => ({
        ...current,
        [selectedAssessment.competencyId]: payload.ideas ?? [],
      }));
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to generate candidate-specific mentoring ideas.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownloadSet() {
    if (!selectedAssessment || !roleId || selectedGeneratedIdeas.length === 0) {
      setGenerationError("Generate ideas for this competency before downloading.");
      return;
    }

    try {
      setGenerationError(null);
      setActionMessage(null);
      setIsDownloadingSet(true);

      const response = await fetch(
        "/api/candidates/download-mentoring-idea-set-docx",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId,
            roleId,
            competencyId: selectedAssessment.competencyId,
            ideas: selectedGeneratedIdeas,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Unable to download the Word document.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedCompetencyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-development-ideas.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to download the Word document.",
      );
    } finally {
      setIsDownloadingSet(false);
    }
  }

  async function handleChooseIdea(idea: GeneratedCandidateMentoringIdea) {
    if (!selectedAssessment || !roleId) {
      setGenerationError("This candidate competency is missing selection details.");
      return;
    }

    try {
      setActionMessage(null);
      setGenerationError(null);
      setIsChoosingTitle(idea.title);

      const response = await fetch("/api/candidates/select-mentoring-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          competencyId: selectedAssessment.competencyId,
          idea,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        navigation?: {
          href?: string;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to choose this project.");
      }

      if (payload.navigation?.href) {
        router.push(payload.navigation.href);
        return;
      }

      setActionMessage(payload.message ?? "Project selected.");
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Unable to choose this project.",
      );
    } finally {
      setIsChoosingTitle(null);
    }
  }

  async function handleDownloadIdea(idea: GeneratedCandidateMentoringIdea) {
    if (!selectedAssessment || !roleId) {
      setGenerationError("This candidate competency is missing download details.");
      return;
    }

    try {
      setActionMessage(null);
      setGenerationError(null);
      setIsDownloadingTitle(idea.title);

      const response = await fetch("/api/candidates/download-mentoring-idea-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          competencyId: selectedAssessment.competencyId,
          idea,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Unable to download the Word document.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to download the Word document.",
      );
    } finally {
      setIsDownloadingTitle(null);
    }
  }

  if (!selectedMatch || !selectedAssessment) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-3xl bg-slate-50 p-6">
        <h3 className="text-xl font-semibold text-slate-900">
          Role Matches Weakest to Strongest
        </h3>
        <div className="mt-4 grid gap-3">
          {matches.map((match) => {
            const isActive = match.competency === selectedCompetencyName;

            return (
              <button
                key={match.competency}
                type="button"
                onClick={() => {
                  setSelectedCompetencyName(match.competency);
                  setGenerationError(null);
                  setActionMessage(null);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-teal-300 bg-teal-50 shadow-[0_18px_40px_rgba(15,118,110,0.12)]"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <p className="font-semibold text-slate-900">{sanitizeAppText(match.competency)}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{sanitizeAppText(match.why_it_fits)}</p>
              </button>
            );
          })}
        </div>
      </article>

      <article className="rounded-3xl bg-slate-50 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              Development Priorities
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Click a role match on the left to focus this development view on one
              competency at a time.
            </p>
          </div>

          <ActionButtons
            canGenerate={canGenerateForSelectedCompetency}
            isGenerating={isGenerating}
            hasGeneratedIdeas={selectedGeneratedIdeas.length > 0}
            isDownloadingSet={isDownloadingSet}
            onGenerate={handleGenerateIdeas}
            onDownloadSet={handleDownloadSet}
          />

          <div className="rounded-2xl bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">
                {sanitizeAppText(selectedCompetencyName)}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Avg {selectedAssessment.averageScore.toFixed(2)} vs target{" "}
                {selectedAssessment.targetScore.toFixed(2)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {selectedAssessment.status}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              {sanitizeAppText(
                selectedPriority?.why_it_matters ??
                  "This competency is one of the stronger role matches right now, but it can still be developed further with targeted practice and stretch work.",
              )}
            </p>

            {selectedPriority?.evidence ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Why this matters now
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {sanitizeAppText(
                    alignedPriorityEvidence ?? selectedPriority.evidence,
                  )}
                </p>
              </div>
            ) : alignedPriorityEvidence ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Why this matters now
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {alignedPriorityEvidence}
                </p>
              </div>
            ) : null}

            {selectedStrengthItems.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Ideal strengths to demonstrate
                </p>
                <div className="mt-3 grid gap-3">
                  {selectedStrengthItems.map((item) => (
                    <div
                      key={`${item.competency}-${item.strength}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="font-semibold text-slate-900">{sanitizeAppText(item.strength)}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {sanitizeAppText(item.application)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedAssessment.supportingStrengths.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Current strengths supporting this area
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {sanitizeAppTextList(selectedAssessment.supportingStrengths).join(", ")}
                </p>
                {selectedAssessment.strengthsRationale ? (
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {sanitizeAppText(selectedAssessment.strengthsRationale)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {evidenceList.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Comments in the Leadership Continuity System
                </p>
                <div className="mt-3 grid gap-2">
                  {evidenceList.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
                    >
                      {sanitizeAppText(item)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {generationError ? (
            <article className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-700">
              {generationError}
            </article>
          ) : null}

          {actionMessage ? (
            <article className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm leading-7 text-teal-800">
              {actionMessage}
            </article>
          ) : null}

          {selectedGeneratedIdeas.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                Candidate-specific ideas
              </p>
              {selectedGeneratedIdeas.map((idea) => (
                <article
                  key={idea.title}
                  className="rounded-2xl border border-teal-200 bg-teal-50/50 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                        {projectTypeLabel(idea.project_type)}
                      </p>
                      <p className="font-semibold text-slate-900">{idea.title}</p>
                      <p className="mt-2 leading-7 text-slate-600">{idea.description}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      <p>{idea.duration_days} days</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Purpose
                      </p>
                      <p className="mt-2 leading-7 text-slate-700">{idea.purpose}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Working Goal
                      </p>
                      <p className="mt-2 leading-7 text-slate-700">{idea.working_goal}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Why it fits:{" "}
                    <span className="font-semibold text-slate-900">
                      {idea.why_it_fits}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    How{" "}
                    <span className="font-semibold text-slate-900">
                      {candidateName.split(" ")[0] || candidateName}
                    </span>{" "}
                    can use strengths:{" "}
                    <span className="font-semibold text-slate-900">
                      {idea.strengths_application}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Mentor focus:{" "}
                    <span className="font-semibold text-slate-900">
                      {idea.mentor_focus}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    First step:{" "}
                    <span className="font-semibold text-slate-900">
                      {idea.first_step}
                    </span>
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Key Partners
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.key_partners.map((partner) => (
                          <li key={partner}>• {partner}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Leadership Actions Required
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.leadership_actions_required.map((action) => (
                          <li key={action}>• {action}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Anticipated Challenges
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.anticipated_challenges.map((challenge) => (
                          <li key={challenge}>• {challenge}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Success Measures
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.success_measures.map((measure) => (
                          <li key={measure}>• {measure}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Mentor Preparation
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.mentor_preparation.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3">
                      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        Mentee Preparation
                      </p>
                      <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                        {idea.mentee_preparation.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Reflection Prompts
                    </p>
                    <ul className="mt-2 space-y-1 leading-7 text-slate-700">
                      {idea.reflection_questions.map((question) => (
                        <li key={question}>• {question}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Success signals:{" "}
                    <span className="font-semibold text-slate-900">
                      {idea.success_signals.join(" • ")}
                    </span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleChooseIdea(idea)}
                      disabled={isChoosingTitle === idea.title}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      {isChoosingTitle === idea.title
                        ? "Choosing..."
                        : "Choose This Project"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadIdea(idea)}
                      disabled={isDownloadingTitle === idea.title}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isDownloadingTitle === idea.title
                        ? "Preparing Word Doc..."
                        : "Download Word Version"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {selectedLibraryIdeas.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Library matches
              </p>
              {selectedLibraryIdeas.map((idea) => (
                <article
                  key={idea.title}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{idea.title}</p>
                      <p className="mt-2 leading-7 text-slate-600">{idea.description}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <p className="capitalize">{idea.difficulty}</p>
                      <p className="mt-1">{idea.durationDays} days</p>
                    </div>
                  </div>
                  {idea.competencyMatches.length > 0 ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Builds:{" "}
                      <span className="font-semibold text-slate-900">
                        {idea.competencyMatches.join(", ")}
                      </span>
                    </p>
                  ) : null}
                  {idea.strengthMatches.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Leverages strengths:{" "}
                      <span className="font-semibold text-slate-900">
                        {idea.strengthMatches.join(", ")}
                      </span>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          <ActionButtons
            canGenerate={canGenerateForSelectedCompetency}
            isGenerating={isGenerating}
            hasGeneratedIdeas={selectedGeneratedIdeas.length > 0}
            isDownloadingSet={isDownloadingSet}
            onGenerate={handleGenerateIdeas}
            onDownloadSet={handleDownloadSet}
          />
        </div>
      </article>
    </div>
  );
}
