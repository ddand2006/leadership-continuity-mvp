"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDropInput } from "@/components/file-drop-input";

export function CandidateStrengthsUploadCard({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/candidates/upload-strengths", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to upload strengths documents.");
        return;
      }

      formRef.current?.reset();
      setResetKey((current) => current + 1);
      setSuccess(result.message ?? "Strengths documents uploaded.");
      router.refresh();
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
          accept=".pdf,.csv,.txt"
          multiple
          required
          theme="emerald"
          helperText="Accepted formats: PDF, CSV, or TXT. Add one or more Gallup reports in a single upload. Every file on record remains visible in the source-documents panel."
        />
        <button
          className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Analyzing strengths..." : "Upload Strengths Documents"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-[#24512f]">{success}</p> : null}
    </section>
  );
}
