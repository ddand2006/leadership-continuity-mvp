"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type InterviewScoreEntryPanelProps = {
  candidateId: string;
  roleId: string | null;
  roleTitle: string | null;
  readOnly?: boolean;
  canEditTargetScores?: boolean;
  competencies: Array<{
    id: string;
    name: string;
    targetScore: number;
  }>;
  existingPanels: Array<{
    id: string;
    panelName: string;
    dateCompleted: string | null;
    createdAt: string | null;
    averageScore: number | null;
    scores: Array<{
      competencyId: string;
      scoreNumeric: number;
      evidenceNotes: string | null;
      concernNotes: string | null;
    }>;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildScoresFromPanel(
  panel: InterviewScoreEntryPanelProps["existingPanels"][number],
  competencies: InterviewScoreEntryPanelProps["competencies"],
): ScoreState {
  const panelScores = new Map(
    panel.scores.map((score) => [score.competencyId, score]),
  );

  return Object.fromEntries(
    competencies.map((competency) => {
      const panelScore = panelScores.get(competency.id);

      return [
        competency.id,
        {
          scoreNumeric:
            panelScore && Number.isFinite(panelScore.scoreNumeric)
              ? panelScore.scoreNumeric.toString()
              : "",
          evidenceNotes: panelScore?.evidenceNotes ?? "",
          concernNotes: panelScore?.concernNotes ?? "",
        },
      ];
    }),
  );
}

function buildPrintablePanelDocument({
  competencies,
  panel,
  roleTitle,
}: {
  competencies: InterviewScoreEntryPanelProps["competencies"];
  panel: InterviewScoreEntryPanelProps["existingPanels"][number];
  roleTitle: string | null;
}): string {
  const scoreMarkup = competencies
    .map((competency) => {
      const savedScore = panel.scores.find(
        (score) => score.competencyId === competency.id,
      );

      return `
        <section class="competency">
          <div class="competency-header">
            <div>
              <h3>${escapeHtml(competency.name)}</h3>
              <p>Target score: ${escapeHtml(
                competency.targetScore.toFixed(2).replace(/\.00$/, ""),
              )}</p>
            </div>
            <div class="score-chip">
              Interview score: ${
                savedScore ? escapeHtml(savedScore.scoreNumeric.toFixed(2)) : "Not scored"
              }
            </div>
          </div>
          <div class="detail-block">
            <h4>Evidence from the interview</h4>
            <p>${escapeHtml(savedScore?.evidenceNotes?.trim() || "No evidence captured.")}</p>
          </div>
          <div class="detail-block">
            <h4>Concerns or gaps</h4>
            <p>${escapeHtml(savedScore?.concernNotes?.trim() || "No concerns captured.")}</p>
          </div>
        </section>
      `;
    })
    .join("");

  const panelAverage =
    panel.averageScore !== null ? panel.averageScore.toFixed(2) : "No scores yet";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(panel.panelName)} | Interview Panel</title>
        <style>
          :root {
            color-scheme: light;
          }
          body {
            margin: 0;
            padding: 40px;
            font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #183153;
            background: #f8fafc;
          }
          .page {
            max-width: 920px;
            margin: 0 auto;
            background: white;
            border: 1px solid #d9e5ef;
            border-radius: 24px;
            padding: 32px;
          }
          .eyebrow {
            margin: 0;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #0f766e;
          }
          h1 {
            margin: 16px 0 8px;
            font-size: 38px;
            line-height: 1.1;
            color: #0f172a;
          }
          .meta {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
            margin: 28px 0 32px;
          }
          .meta-card {
            border: 1px solid #d9e5ef;
            border-radius: 18px;
            padding: 16px;
            background: #f8fafc;
          }
          .meta-card span {
            display: block;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #64748b;
          }
          .meta-card strong {
            font-size: 18px;
            color: #0f172a;
          }
          .competency {
            border: 1px solid #d9e5ef;
            border-radius: 20px;
            padding: 20px;
            margin-top: 18px;
            break-inside: avoid;
          }
          .competency-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
          }
          .competency h3 {
            margin: 0;
            font-size: 24px;
            color: #0f172a;
          }
          .competency-header p {
            margin: 8px 0 0;
            color: #475569;
          }
          .score-chip {
            white-space: nowrap;
            border-radius: 999px;
            background: #e0f2fe;
            color: #0f172a;
            font-weight: 700;
            padding: 10px 14px;
          }
          .detail-block {
            margin-top: 18px;
          }
          .detail-block h4 {
            margin: 0 0 8px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #64748b;
          }
          .detail-block p {
            margin: 0;
            line-height: 1.7;
            color: #334155;
            white-space: pre-wrap;
          }
          @media print {
            body {
              padding: 0;
              background: white;
            }
            .page {
              border: 0;
              border-radius: 0;
              padding: 0;
              max-width: none;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <p class="eyebrow">Saved interview panel</p>
          <h1>${escapeHtml(panel.panelName)}</h1>
          <div class="meta">
            <div class="meta-card">
              <span>Role</span>
              <strong>${escapeHtml(roleTitle ?? "No active role selected")}</strong>
            </div>
            <div class="meta-card">
              <span>Date completed</span>
              <strong>${escapeHtml(panel.dateCompleted ?? "Not set")}</strong>
            </div>
            <div class="meta-card">
              <span>Average score</span>
              <strong>${escapeHtml(panelAverage)}</strong>
            </div>
          </div>
          ${scoreMarkup}
        </main>
      </body>
    </html>
  `;
}

export function InterviewScoreEntryPanel({
  candidateId,
  roleId,
  roleTitle,
  readOnly = false,
  canEditTargetScores = true,
  competencies,
  existingPanels,
}: InterviewScoreEntryPanelProps) {
  const router = useRouter();
  const [panelName, setPanelName] = useState("");
  const [dateCompleted, setDateCompleted] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
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
  const latestSavedPanel = existingPanels[0] ?? null;
  const isEditingExistingPanel = selectedPanelId !== null;

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
    setSelectedPanelId(null);
    setPanelName("");
    setDateCompleted(new Date().toISOString().slice(0, 10));
    setScores(buildInitialScores(competencies));
  }

  function loadExistingPanel(panelId: string) {
    const panel = existingPanels.find((entry) => entry.id === panelId);

    if (!panel) {
      return;
    }

    setSelectedPanelId(panel.id);
    setPanelName(panel.panelName);
    setDateCompleted(panel.dateCompleted ?? new Date().toISOString().slice(0, 10));
    setScores(buildScoresFromPanel(panel, competencies));
    setError(null);
    setSuccess(null);
  }

  function printSavedPanel(panelId: string) {
    const panel = existingPanels.find((entry) => entry.id === panelId);

    if (!panel || typeof window === "undefined") {
      return;
    }

    setError(null);

    const existingFrame = document.getElementById(
      "saved-panel-print-frame",
    ) as HTMLIFrameElement | null;
    existingFrame?.remove();

    const printFrame = document.createElement("iframe");
    printFrame.id = "saved-panel-print-frame";
    printFrame.title = "Saved interview panel print frame";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.srcdoc = buildPrintablePanelDocument({
      competencies,
      panel,
      roleTitle,
    });

    printFrame.onload = () => {
      const frameWindow = printFrame.contentWindow;

      if (!frameWindow) {
        setError("Unable to open the saved panel for printing.");
        printFrame.remove();
        return;
      }

      const cleanup = () => {
        window.setTimeout(() => {
          printFrame.remove();
        }, 200);
      };

      frameWindow.onafterprint = cleanup;
      frameWindow.focus();
      window.setTimeout(() => {
        frameWindow.print();
      }, 150);
    };

    document.body.appendChild(printFrame);
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
          panelId: selectedPanelId,
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
        {readOnly
          ? "Review interviewer feedback for this role"
          : "Submit interviewer feedback for this role"}
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        {readOnly
          ? "Interview scoring remains visible here for context, but only assigned mentors and organization administrators can add or update scores."
          : "After the interview is complete, score the candidate against each role competency, add evidence from the conversation, and capture any concerns that should shape readiness decisions."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resetForm}
          disabled={readOnly}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-800"
        >
          {readOnly ? "Viewing saved interview rounds" : "Start a new interview round"}
        </button>
        {isEditingExistingPanel ? (
          <p className="text-sm text-slate-600">
            Editing saved panel <span className="font-semibold text-slate-900">{panelName}</span>
          </p>
        ) : latestSavedPanel ? (
          <p className="text-sm text-slate-600">
            Using <span className="font-semibold text-slate-900">{latestSavedPanel.panelName}</span>{" "}
            as the latest comparison round
          </p>
        ) : null}
      </div>

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
              competencies.map((competency) => {
                const latestPanelScore = latestSavedPanel?.scores.find(
                  (score) => score.competencyId === competency.id,
                );

                return (
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
                              disabled={readOnly || !canEditTargetScores}
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
                                readOnly ||
                                !canEditTargetScores ||
                                !roleId ||
                                savingTargetCompetencyId === competency.id
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
                            disabled={readOnly}
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

                    {!isEditingExistingPanel && latestPanelScore ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 text-sm text-slate-500">
                        <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Latest saved interview
                        </p>
                        <p className="mt-2">
                          {latestSavedPanel?.panelName} on{" "}
                          {latestSavedPanel?.dateCompleted ?? "No date saved"}
                        </p>
                        <p className="mt-2">
                          Previous score: {latestPanelScore.scoreNumeric.toFixed(2)}
                        </p>
                        {latestPanelScore.evidenceNotes ? (
                          <p className="mt-2">
                            Evidence: {latestPanelScore.evidenceNotes}
                          </p>
                        ) : null}
                        {latestPanelScore.concernNotes ? (
                          <p className="mt-2">
                            Concerns: {latestPanelScore.concernNotes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">
                          Evidence from the interview
                        </span>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                          disabled={readOnly}
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
                          disabled={readOnly}
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
                );
              })
            ) : (
              <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                No role competencies exist for this role yet, so interview scores
                cannot be submitted.
              </article>
            )}
          </div>

          {readOnly ? (
            <p className="text-sm leading-7 text-slate-600">
              This account can review saved interview history but cannot edit or
              submit interview scoring.
            </p>
          ) : (
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
          )}

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
            Open any saved panel to revise prior interview feedback. When you start
            a new round, the most recent scores stay visible in gray so mentors can
            compare growth over time.
          </p>

          <div className="mt-6 grid gap-3 text-sm leading-7 text-[#24512f]">
            <p className="font-semibold text-[#14361d]">Previously saved panels</p>
            {existingPanels.length > 0 ? (
              existingPanels.map((panel) => (
                <article
                  key={panel.id}
                  className={`emerald-soft-surface rounded-2xl border px-4 py-4 transition ${
                    selectedPanelId === panel.id
                      ? "border-teal-600 shadow-[0_0_0_1px_rgba(13,148,136,0.25)]"
                      : ""
                  }`}
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadExistingPanel(panel.id)}
                      className="rounded-full border border-[#9fd2ad] bg-white px-3 py-2 text-xs font-semibold text-[#24512f] transition hover:border-teal-500 hover:text-teal-800"
                    >
                      {selectedPanelId === panel.id
                        ? readOnly
                          ? "Viewing this panel"
                          : "Editing this panel"
                        : readOnly
                          ? "View saved panel"
                          : "Edit saved panel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => printSavedPanel(panel.id)}
                      className="rounded-full border border-[#9fd2ad] bg-white px-3 py-2 text-xs font-semibold text-[#24512f] transition hover:border-teal-500 hover:text-teal-800"
                    >
                      Print saved panel
                    </button>
                  </div>
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
