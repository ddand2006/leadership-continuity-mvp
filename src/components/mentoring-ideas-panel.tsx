"use client";

import { useEffect, useState } from "react";
import type { GeneratedCandidateMentoringIdea } from "@/lib/candidate-mentoring-ideas";
import type { RankedProjectMatch } from "@/lib/fit-analysis";
import {
  readGeneratedMentoringIdeasCache,
  writeGeneratedMentoringIdeasCache,
} from "@/lib/generated-mentoring-ideas-cache";
import { storePendingMentoringProjectTransfer } from "@/lib/pending-mentoring-project-transfer";

function projectTypeLabel(projectType: GeneratedCandidateMentoringIdea["project_type"]) {
  return projectType === "cross_departmental"
    ? "Cross-Departmental Project"
    : "Departmental Project";
}

export function MentoringIdeasPanel({
  ideas,
  canGenerateCandidateIdeas = false,
  candidateId,
  candidateName,
  roleId,
  mentorProfileId,
  competencyId,
  competencyName,
  initialGeneratedIdeas = [],
}: {
  ideas: RankedProjectMatch[];
  canGenerateCandidateIdeas?: boolean;
  candidateId?: string;
  candidateName?: string;
  roleId?: string;
  mentorProfileId?: string;
  competencyId?: string;
  competencyName?: string;
  initialGeneratedIdeas?: GeneratedCandidateMentoringIdea[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<
    GeneratedCandidateMentoringIdea[]
  >(initialGeneratedIdeas);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChoosingTitle, setIsChoosingTitle] = useState<string | null>(null);
  const [isDownloadingTitle, setIsDownloadingTitle] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId || !roleId || !competencyId) {
      setGeneratedIdeas(initialGeneratedIdeas);
      return;
    }

    const cachedIdeas = readGeneratedMentoringIdeasCache({
      candidateId,
      roleId,
      competencyId,
    });

    setGeneratedIdeas(
      cachedIdeas && cachedIdeas.length > 0 ? cachedIdeas : initialGeneratedIdeas,
    );
  }, [candidateId, competencyId, initialGeneratedIdeas, roleId]);

  async function handleChooseIdea(idea: GeneratedCandidateMentoringIdea) {
    if (!candidateId || !roleId || !competencyId) {
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
          mentorProfileId,
          competencyId,
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
        const navigationUrl = new URL(payload.navigation.href, window.location.origin);
        storePendingMentoringProjectTransfer({
          candidateId,
          roleId,
          mentorProfileId: navigationUrl.searchParams.get("mentorProfileId"),
          competencyName: competencyName ?? "",
          idea,
          projectId: navigationUrl.searchParams.get("projectId"),
          recordId: navigationUrl.searchParams.get("recordId"),
          savedAt: new Date().toISOString(),
        });
        window.location.assign(payload.navigation.href);
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
    if (!candidateId || !roleId || !competencyId) {
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
          competencyId,
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

  async function handleGenerateIdeas() {
    if (!candidateId || !roleId || !competencyId) {
      setGenerationError("This candidate competency is missing generator details.");
      return;
    }

    try {
      setIsOpen(true);
      setIsGenerating(true);
      setGenerationError(null);

      const response = await fetch("/api/candidates/generate-mentoring-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          competencyId,
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

      const nextIdeas = payload.ideas ?? [];

      setGeneratedIdeas(nextIdeas);

      if (candidateId && roleId && competencyId) {
        writeGeneratedMentoringIdeasCache(
          {
            candidateId,
            roleId,
            competencyId,
          },
          nextIdeas,
        );
      }
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

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
        >
          {isOpen ? "Hide Mentoring Ideas" : "Ideas for Mentoring"}
        </button>
        {canGenerateCandidateIdeas ? (
          <button
            type="button"
            onClick={handleGenerateIdeas}
            disabled={isGenerating}
            className="rounded-full bg-teal-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {isGenerating
              ? "Generating..."
              : generatedIdeas.length > 0
                ? "Regenerate Candidate Ideas"
                : "Generate Candidate-Specific Ideas"}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-4 grid gap-3">
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

          {generatedIdeas.length > 0 ? (
            <>
              <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                Candidate-specific ideas
              </p>
              {generatedIdeas.map((idea) => (
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
                      {candidateName?.split(" ")[0] ?? "their"}
                    </span>{" "}
                    strengths can help:{" "}
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
            </>
          ) : null}

          {ideas.length > 0 ? (
            <>
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Library matches
              </p>
              {ideas.map((idea) => (
                <article
                  key={idea.title}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{idea.title}</p>
                      <p className="mt-2 leading-7 text-slate-600">
                        {idea.description}
                      </p>
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
                  {idea.expectedOutcomes.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Expected outcomes:{" "}
                      <span className="font-semibold text-slate-900">
                        {idea.expectedOutcomes.slice(0, 2).join(" • ")}
                      </span>
                    </p>
                  ) : null}
                  {idea.mentorQuestions.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Mentor prompts:{" "}
                      <span className="font-semibold text-slate-900">
                        {idea.mentorQuestions.slice(0, 2).join(" • ")}
                      </span>
                    </p>
                  ) : null}
                </article>
              ))}
            </>
          ) : generatedIdeas.length === 0 ? (
            <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              {canGenerateCandidateIdeas
                ? "No matched library ideas are in place for this competency yet. Use the candidate-specific generator to create tailored mentoring ideas from this candidate's strengths, role, and gap profile."
                : "No matched mentoring ideas are in the library for this competency yet."}
            </article>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
