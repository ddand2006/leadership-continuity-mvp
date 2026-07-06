"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDropInput } from "@/components/file-drop-input";

async function readApiMessage(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return {
      error: response.ok ? undefined : "The server returned an empty response.",
      message: undefined,
    };
  }

  try {
    return JSON.parse(responseText) as { error?: string; message?: string };
  } catch {
    return {
      error: response.ok
        ? undefined
        : `Unexpected server response: ${responseText.slice(0, 240)}`,
      message: undefined,
    };
  }
}

export function CandidateStrengthsUploadCard({
  candidateId,
  candidateName,
  importedStrengthCount,
  readableDocumentCount,
  sourceDocumentCount,
  topStrengthNames,
}: {
  candidateId: string;
  candidateName: string;
  importedStrengthCount: number;
  readableDocumentCount: number;
  sourceDocumentCount: number;
  topStrengthNames: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReimportPending, startReimportTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/candidates/upload-strengths", {
          method: "POST",
          body: formData,
        });
        const result = await readApiMessage(response);

        if (!response.ok) {
          setError(result.error ?? "Unable to upload strengths documents.");
          return;
        }

        formRef.current?.reset();
        setResetKey((current) => current + 1);
        setSuccess(result.message ?? "Strengths documents uploaded.");
        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to upload strengths documents.",
        );
      }
    });
  }

  function handleReimport() {
    setError(null);
    setSuccess(null);

    startReimportTransition(async () => {
      try {
        const response = await fetch("/api/candidates/reimport-strengths", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ candidateId }),
        });
        const result = await readApiMessage(response);

        if (!response.ok) {
          setError(result.error ?? "Unable to reimport strengths.");
          return;
        }

        setSuccess(result.message ?? "Strengths reimported.");
        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Unable to reimport strengths.",
        );
      }
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
        Strengths Documents
      </p>
      <h2 className="mt-3 font-display text-3xl text-[#183822]">
        Add or refresh Gallup files
      </h2>
      <p className="mt-4 text-sm leading-7 text-[#486454]">
        Add one or more Gallup files for {candidateName}, including the ALL_34,
        Signature Theme, and Top 5 PDFs. New files are added to the archived set
        on record, and re-uploading the same file name replaces just that file.
      </p>

      <div className="mt-6 rounded-3xl border border-[rgba(82,140,94,0.24)] bg-white/80 p-5">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
          Import Status
        </p>
        {importedStrengthCount > 0 ? (
          <>
            <p className="mt-3 text-sm leading-7 text-[#24512f]">
              {importedStrengthCount} strengths are already in the system for this
              candidate. Gallup uploads import automatically, so there is no
              separate strengths-generation step.
            </p>
            {topStrengthNames.length > 0 ? (
              <p className="mt-3 text-sm leading-7 text-[#24512f]">
                Current top strengths: {topStrengthNames.join(", ")}.
              </p>
            ) : null}
          </>
        ) : sourceDocumentCount > 0 ? (
          <>
            <p className="mt-3 text-sm leading-7 text-[#24512f]">
              Gallup files are archived for this candidate, but no strengths are
              visible in the system yet.
            </p>
            <p className="mt-3 text-sm leading-7 text-[#486454]">
              {readableDocumentCount > 0
                ? "At least one archived file has readable text, so you can retry the import from the saved files below."
                : "The archived files do not currently contain machine-readable text. A text-based PDF, DOCX, CSV, or TXT file is needed before strengths can be imported."}
            </p>
            {readableDocumentCount > 0 ? (
              <button
                type="button"
                onClick={handleReimport}
                disabled={isReimportPending}
                className="interactive-contrast mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isReimportPending ? "Reimporting strengths..." : "Reimport Archived Files"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm leading-7 text-[#24512f]">
            No Gallup files have been uploaded for this candidate yet.
          </p>
        )}
      </div>

      <form
        ref={formRef}
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="candidateId" value={candidateId} />
        <FileDropInput
          key={resetKey}
          label="Results files"
          name="files"
          accept=".pdf,.docx,.csv,.txt"
          multiple
          required
          theme="emerald"
          helperText="Accepted formats: PDF, DOCX, CSV, or TXT. Add one or more Gallup reports in a single upload. Every file on record remains visible in the source-documents panel."
        />
        <button
          className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={isPending || isReimportPending}
        >
          {isPending ? "Analyzing strengths..." : "Upload Strengths Documents"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-[#24512f]">{success}</p> : null}
    </section>
  );
}
