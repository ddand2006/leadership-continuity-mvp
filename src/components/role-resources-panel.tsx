"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type RoleResourcesPanelProps = {
  roles: {
    id: string;
    title: string;
    department: string | null;
    description: string | null;
    competencyCount: number;
    hasStructuredComposite: boolean;
    hasCompositeDocument: boolean;
  }[];
  initialSelectedRoleId?: string | null;
  canGenerateResources: boolean;
};

type InterviewScorecardPreview = {
  roleTitle: string;
  purpose: string;
  sections: Array<{
    title: string;
    questions: Array<{
      question: string;
      validates: string;
    }>;
  }>;
  finalSummaryLabels: string[];
};

export function RoleResourcesPanel({
  roles,
  initialSelectedRoleId = null,
  canGenerateResources,
}: RoleResourcesPanelProps) {
  const [selectedRoleId, setSelectedRoleId] = useState(initialSelectedRoleId ?? "");
  const [preview, setPreview] = useState<InterviewScorecardPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [compositeDocumentError, setCompositeDocumentError] = useState<string | null>(
    null,
  );
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isDownloadPending, startDownloadTransition] = useTransition();
  const [isCompositeDocumentPending, startCompositeDocumentTransition] =
    useTransition();

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const selectedRoleHasNarrativeData = Boolean(
    selectedRole?.hasCompositeDocument || selectedRole?.hasStructuredComposite,
  );

  async function downloadPrintableNarrativeDocument(roleId: string, roleTitle: string) {
    const response = await fetch(`/api/roles/${roleId}/printable-narrative-docx`, {
      method: "GET",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(
        payload.error ?? "Unable to download the printable Word narrative.",
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${roleTitle
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()}-printable-role-narrative.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleGeneratePreview() {
    if (!selectedRoleId) {
      setError("Choose a role first.");
      return;
    }

    setError(null);
    setDownloadError(null);
    setCompositeDocumentError(null);

    startPreviewTransition(async () => {
      const response = await fetch(`/api/roles/${selectedRoleId}/interview-scorecard`);
      const payload = (await response.json()) as
        | InterviewScorecardPreview
        | { error?: string };

      if (!response.ok || "error" in payload) {
        setPreview(null);
        setError(
          ("error" in payload ? payload.error : null) ??
            "Unable to generate behavioral interview questions.",
        );
        return;
      }

      setPreview(payload as InterviewScorecardPreview);
    });
  }

  function handleDownloadDocx() {
    if (!selectedRoleId) {
      setDownloadError("Choose a role first.");
      return;
    }

    setDownloadError(null);
    setError(null);
    setCompositeDocumentError(null);

    startDownloadTransition(async () => {
      const response = await fetch(
        `/api/roles/${selectedRoleId}/interview-scorecard-docx`,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setDownloadError(
          payload.error ?? "Unable to download the Word scorecard.",
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedRole?.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-interview-scorecard.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  function handleGeneratePrintableNarrativeDocument() {
    if (!selectedRoleId || !selectedRole) {
      setCompositeDocumentError("Choose a role first.");
      return;
    }

    setCompositeDocumentError(null);
    setError(null);
    setDownloadError(null);

    startCompositeDocumentTransition(async () => {
      try {
        await downloadPrintableNarrativeDocument(selectedRole.id, selectedRole.title);
      } catch (downloadCompositeError) {
        setCompositeDocumentError(
          downloadCompositeError instanceof Error
            ? downloadCompositeError.message
            : "Unable to prepare the printable Word narrative.",
        );
      }
    });
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Narrative and Interview Tools
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Keep the printable narrative and interview resources together
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          Choose a role, open its printable narrative, and use the same role
          data to generate behavioral interview resources. These materials are
          designed to help interviewers identify whether candidates actually
          demonstrate the behaviors, judgment, and leadership profile required
          for the role.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Role
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                value={selectedRoleId}
                onChange={(event) => {
                  setSelectedRoleId(event.currentTarget.value);
                  setPreview(null);
                  setError(null);
                  setDownloadError(null);
                }}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedRole ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{selectedRole.title}</p>
                <p className="mt-2 text-slate-600">
                  {selectedRole.department || "No department entered"}
                </p>
                <p className="mt-3 leading-7 text-slate-600">
                  {selectedRole.description || "No role description entered yet."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                    {selectedRole.competencyCount} competency area
                    {selectedRole.competencyCount === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-teal-900">
                    {selectedRole.hasCompositeDocument
                      ? "Composite document ready"
                      : selectedRole.hasStructuredComposite
                        ? "Structured composite ready"
                      : "Composite document still needed"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {selectedRole.hasCompositeDocument
                    ? "The printable role narrative opens here, and the Word export is generated from that same narrative and competency detail. The source composite still stays in the composite workflow."
                    : selectedRole.hasStructuredComposite
                      ? "The printable role narrative can open from the saved role model now, and the Word export is generated from the same full narrative, competencies, and role detail. Composite creation and maintenance still happen in the composite workflow."
                      : "This role still needs a generated composite so the narrative and interview tools have a structured role model to work from."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/roles/${selectedRole.id}/print`}
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Open Printable Role Narrative
                  </Link>
                  {selectedRole.hasStructuredComposite ||
                  selectedRole.hasCompositeDocument ? (
                    <button
                      type="button"
                      onClick={handleGeneratePrintableNarrativeDocument}
                      disabled={isCompositeDocumentPending}
                      className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {isCompositeDocumentPending
                        ? "Preparing Word Narrative..."
                        : selectedRole.hasCompositeDocument
                          ? "Download Printable Narrative (Word)"
                          : "Generate Printable Narrative (Word)"}
                    </button>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
                      Generate the composite first so the printable narrative can be created from it
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={
                  !canGenerateResources ||
                  isPreviewPending ||
                  !selectedRoleId ||
                  !selectedRoleHasNarrativeData
                }
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPreviewPending
                  ? "Generating Questions..."
                  : "Generate Behavioral Interview Questions"}
              </button>
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={
                  !canGenerateResources ||
                  isDownloadPending ||
                  !selectedRoleId ||
                  !selectedRoleHasNarrativeData
                }
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isDownloadPending
                  ? "Preparing Word Scorecard..."
                  : "Download Interview Scorecard (Word)"}
              </button>
            </div>

            {!canGenerateResources ? (
              <p className="text-sm text-rose-700">
                Add `OPENAI_API_KEY` to `.env.local` before generating role
                interview resources.
              </p>
            ) : null}
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {downloadError ? (
              <p className="text-sm text-rose-700">{downloadError}</p>
            ) : null}
            {compositeDocumentError ? (
              <p className="text-sm text-rose-700">{compositeDocumentError}</p>
            ) : null}
            {selectedRole && !selectedRoleHasNarrativeData ? (
              <p className="text-sm text-slate-600">
                Generate the role composite first so this workspace has the
                competency model needed for narrative and interview resources.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Resource Types
            </p>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-[#24512f]">
              <article className="emerald-soft-surface rounded-2xl border px-4 py-4">
                Open the printable role narrative and keep it paired with the
                interview tools for the same role.
              </article>
              <article className="emerald-soft-surface rounded-2xl border px-4 py-4">
                Generate behavioral interview questions that tie directly to the
                role competencies and composite.
              </article>
              <article className="emerald-soft-surface rounded-2xl border px-4 py-4">
                Download a Word interview scorecard with sections, questions,
                scoring lines, and notes prompts for interviewers.
              </article>
            </div>
          </div>
        </div>
      </div>

      {preview ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Interview Questions Preview
          </p>
          <h3 className="mt-3 font-display text-3xl text-slate-900">
            {preview.roleTitle}
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {preview.purpose}
          </p>

          <div className="mt-6 grid gap-5">
            {preview.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
              >
                <h4 className="text-2xl font-semibold text-slate-900">
                  {section.title}
                </h4>
                <div className="mt-4 grid gap-4">
                  {section.questions.map((question) => (
                    <div
                      key={`${section.title}-${question.question}`}
                      className="rounded-2xl bg-white px-4 py-4 text-sm text-slate-700"
                    >
                      <p className="font-semibold text-slate-900">
                        {question.question}
                      </p>
                      <p className="mt-2 leading-7 text-slate-600">
                        What this validates:{" "}
                        <span className="font-semibold text-slate-900">
                          {question.validates}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Final evaluation summary</p>
            <p className="mt-2 leading-7">
              {preview.finalSummaryLabels.join(" • ")}
            </p>
          </div>
        </section>
      ) : null}
    </section>
  );
}
