"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type InterviewScoreEntryPanelProps = {
  candidateId: string;
  roleId: string | null;
  roleTitle: string | null;
  competencies: Array<{
    id: string;
    name: string;
    targetScore: number;
  }>;
  existingPanels: Array<{
    id: string;
    panelName: string;
    dateCompleted: string | null;
    averageScore: number | null;
  }>;
};

type ScoreState = Record<
  string,
  {
    scoreNumeric: string;
    evidenceNotes: string;
    concernNotes: string;
  }
>;

type TargetScoreState = Record<string, string>;

function buildInitialScores(
  competencies: InterviewScoreEntryPanelProps["competencies"],
): ScoreState {
  return Object.fromEntries(
    competencies.map((competency) => [
      competency.id,
      {
        scoreNumeric: "",
        evidenceNotes: "",
        concernNotes: "",
      },
    ]),
  );
}

function buildInitialTargetScores(
  competencies: InterviewScoreEntryPanelProps["competencies"],
): TargetScoreState {
  return Object.fromEntries(
    competencies.map((competency) => [
      competency.id,
      competency.targetScore.toFixed(2).replace(/\.00$/, ""),
    ]),
  );
}

export function InterviewScoreEntryPanel({
  candidateId,
  roleId,
  roleTitle,
  competencies,
  existingPanels,
}: InterviewScoreEntryPanelProps) {
  const router = useRouter();
  const [panelName, setPanelName] = useState("");
  const [dateCompleted, setDateCompleted] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [scores, setScores] = useState<ScoreState>(buildInitialScores(competencies));
  const [targetScores, setTargetScores] = useState<TargetScoreState>(
    buildInitialTargetScores(competencies),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [targetScoreError, setTargetScoreError] = useState<string | null>(null);
  const [targetScoreSuccess, setTargetScoreSuccess] = useState<string | null>(null);
  const [savingTargetCompetencyId, setSavingTargetCompetencyId] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function updateScoreField(
    competencyId: string,
    field: "scoreNumeric" | "evidenceNotes" | "concernNotes",
    value: string,
  ) {
    setScores((current) => ({
      ...current,
      [competencyId]: {
        ...current[competencyId],
        [field]: value,
      },
    }));
  }

  function resetForm() {
    setPanelName("");
    setDateCompleted(new Date().toISOString().slice(0, 10));
    setScores(buildInitialScores(competencies));
  }

  function updateTargetScore(competencyId: string, value: string) {
    setTargetScores((current) => ({
      ...current,
      [competencyId]: value,
    }));
  }

  async function handleTargetScoreSave(competencyId: string) {
    if (!roleId) {
      setTargetScoreError("Choose an active role before updating target scores.");
      return;
    }

    const parsedTargetScore = Number.parseFloat(targetScores[competencyId] ?? "");

    if (!Number.isFinite(parsedTargetScore) || parsedTargetScore < 1 || parsedTargetScore > 5) {
      setTargetScoreError("Enter a target score between 1.0 and 5.0.");
      return;
    }

    setSavingTargetCompetencyId(competencyId);
    setTargetScoreError(null);
    setTargetScoreSuccess(null);

    const response = await fetch("/api/roles/competency-target-score", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roleId,
        competencyId,
        targetScore: parsedTargetScore,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSavingTargetCompetencyId(null);

    if (!response.ok) {
      setTargetScoreError(payload.error ?? "Unable to update the target score.");
      return;
    }

    setTargetScoreSuccess(payload.message ?? "Target score updated.");
    router.refresh();
  }

  function handleSubmit() {
    if (!roleId) {
      setError("Choose an active role for this candidate first.");
      return;
    }

    const filledScores = competencies.flatMap((competency) => {
      const current = scores[competency.id];
      const parsedScore = Number.parseFloat(current?.scoreNumeric ?? "");

      if (!Number.isFinite(parsedScore)) {
        return [];
      }

      return [
        {
          competencyId: competency.id,
          scoreNumeric: parsedScore,
          evidenceNotes: current.evidenceNotes,
          concernNotes: current.concernNotes,
        },
      ];
    });

    if (panelName.trim().length === 0) {
      setError("Add a panel name so the interview can be tracked.");
      return;
    }

    if (filledScores.length !== competencies.length) {
      setError("Enter a score for each competency before saving.");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/candidates/interview-scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId,
          roleId,
          panelName,
          dateCompleted,
          scores: filledScores,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save interview scores.");
        return;
      }

      setSuccess(payload.message ?? "Interview scores saved.");
      resetForm();
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Interview Scoring
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Submit interviewer feedback for this role
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        After the interview is complete, score the candidate against each role
        competency, add evidence from the conversation, and capture any concerns
        that should shape readiness decisions.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Interview panel name
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                type="text"
                value={panelName}
                onChange={(event) => setPanelName(event.currentTarget.value)}
                placeholder="Executive panel - round one"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Interview date
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                type="date"
                value={dateCompleted}
                onChange={(event) => setDateCompleted(event.currentTarget.value)}
              />
            </label>
          </div>

          <div className="grid gap-4">
            {competencies.length > 0 ? (
              competencies.map((competency) => (
                <article
                  key={competency.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {competency.name}
                      </p>
                    </div>
                    <div className="grid gap-3 md:min-w-[18rem]">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Target score
                        </span>
                        <div className="flex gap-2">
                          <input
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                            type="number"
                            min="1"
                            max="5"
                            step="0.1"
                            value={targetScores[competency.id] ?? ""}
                            onChange={(event) =>
                              updateTargetScore(
                                competency.id,
                                event.currentTarget.value,
                              )
                            }
                            placeholder="4.5"
                            inputMode="decimal"
                          />
                          <button
                            type="button"
                            onClick={() => handleTargetScoreSave(competency.id)}
                            disabled={
                              !roleId || savingTargetCompetencyId === competency.id
                            }
                            className="interactive-contrast rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {savingTargetCompetencyId === competency.id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </div>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Interview score
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={scores[competency.id]?.scoreNumeric ?? ""}
                          onChange={(event) =>
                            updateScoreField(
                              competency.id,
                              "scoreNumeric",
                              event.currentTarget.value,
                            )
                          }
                          placeholder="3.2"
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Evidence from the interview
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                        value={scores[competency.id]?.evidenceNotes ?? ""}
                        onChange={(event) =>
                          updateScoreField(
                            competency.id,
                            "evidenceNotes",
                            event.currentTarget.value,
                          )
                        }
                        placeholder="What did the interviewer hear or observe that supports this score?"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Concerns or gaps
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                        value={scores[competency.id]?.concernNotes ?? ""}
                        onChange={(event) =>
                          updateScoreField(
                            competency.id,
                            "concernNotes",
                            event.currentTarget.value,
                          )
                        }
                        placeholder="What concerns, hesitation, or follow-up questions came out of the interview?"
                      />
                    </label>
                  </div>
                </article>
              ))
            ) : (
              <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                No role competencies exist for this role yet, so interview scores
                cannot be submitted.
              </article>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !roleId || competencies.length === 0}
              className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPending ? "Saving Interview Scores..." : "Save Interview Scores"}
            </button>
          </div>

          {targetScoreError ? (
            <p className="text-sm text-rose-700">{targetScoreError}</p>
          ) : null}
          {targetScoreSuccess ? (
            <p className="text-sm text-teal-700">{targetScoreSuccess}</p>
          ) : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="text-sm text-teal-700">{success}</p> : null}
        </div>

        <div className="rounded-3xl border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
            Role context
          </p>
          <p className="mt-4 text-2xl font-semibold text-[#14361d]">
            {roleTitle ?? "No active role selected"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[#24512f]">
            Save one completed panel at a time. If you reuse the same panel name,
            your scores for that panel will update instead of creating a duplicate.
          </p>

          <div className="mt-6 grid gap-3 text-sm leading-7 text-[#24512f]">
            <p className="font-semibold text-[#14361d]">Previously saved panels</p>
            {existingPanels.length > 0 ? (
              existingPanels.map((panel) => (
                <article
                  key={panel.id}
                  className="emerald-soft-surface rounded-2xl border px-4 py-4"
                >
                  <p className="font-semibold text-[#14361d]">{panel.panelName}</p>
                  <p className="mt-1">
                    Date: {panel.dateCompleted || "Not set"}
                  </p>
                  <p>
                    Average score:{" "}
                    {panel.averageScore !== null
                      ? panel.averageScore.toFixed(2)
                      : "No scores yet"}
                  </p>
                </article>
              ))
            ) : (
              <article className="emerald-soft-surface rounded-2xl border px-4 py-4">
                No interview panels have been saved for this candidate and role yet.
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
