"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function GenerateMentorReportButton({
  candidateId,
  roleId,
  disabled,
  hasExistingReport = false,
}: {
  candidateId: string;
  roleId?: string | null;
  disabled: boolean;
  hasExistingReport?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/mentor-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ candidateId, roleId }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to generate mentor report.");
        return;
      }

      setSuccess(payload.message ?? "Mentor report generated.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        type="button"
        onClick={handleGenerate}
        disabled={disabled || isPending || !roleId}
      >
        {isPending
          ? hasExistingReport
            ? "Refreshing report..."
            : "Generating report..."
          : hasExistingReport
            ? "Refresh Mentor Report"
            : "Generate Mentor Report"}
      </button>
      {hasExistingReport ? (
        <p className="text-sm text-slate-600">
          Refresh the report after new interview scores, target scores, or
          strengths information are added.
        </p>
      ) : null}
      {!roleId ? (
        <p className="text-sm text-amber-700">
          Choose a role context for this candidate before generating the mentor report.
        </p>
      ) : null}
      {disabled ? (
        <p className="text-sm text-amber-700">
          Add `OPENAI_API_KEY` to `.env.local` before generating a mentor report.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="text-sm text-teal-700">{success}</p> : null}
    </div>
  );
}
