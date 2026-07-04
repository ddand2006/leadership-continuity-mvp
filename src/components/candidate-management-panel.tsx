"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RoleOption = {
  id: string;
  title: string;
};

type CandidateManagementPanelProps = {
  roles: RoleOption[];
  showPipelineHeader?: boolean;
};

export function CandidateManagementPanel({
  roles,
  showPipelineHeader = false,
}: CandidateManagementPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreatePending, startCreateTransition] = useTransition();

  function returnToFlow() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("mode", "flow");
    nextParams.delete("candidateId");

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function handleCreateCandidate(formData: FormData) {
    setCreateError(null);
    setCreateSuccess(null);

    startCreateTransition(async () => {
      const targetRoleId = String(formData.get("target_role_id") ?? "");
      const payload = {
        full_name: String(formData.get("full_name") ?? ""),
        current_title: String(formData.get("current_title") ?? ""),
        target_role_id: targetRoleId || undefined,
        status: String(formData.get("status") ?? "active"),
      };
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setCreateError(result.error ?? "Unable to create candidate.");
        return;
      }

      createFormRef.current?.reset();
      setCreateSuccess(result.message ?? "Candidate created.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      {showPipelineHeader ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
              Candidate Pipeline
            </p>
            <button
              type="button"
              onClick={returnToFlow}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Candidates Flow
            </button>
          </div>
          <div className="mt-6 border-t border-slate-200" />
        </>
      ) : null}

      <h2 className={`${showPipelineHeader ? "mt-8" : "mt-3"} font-display text-3xl text-slate-900`}>
        Create a candidate record
      </h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        Add the candidate profile here. Gallup strengths documents can be uploaded
        from the individual candidate record once the person is created.
      </p>

      <form
        ref={createFormRef}
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleCreateCandidate(new FormData(event.currentTarget));
        }}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Candidate name
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            type="text"
            name="full_name"
            placeholder="Jane Leader"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Current title
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            type="text"
            name="current_title"
            placeholder="Director of Surgical Services"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Target role
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            name="target_role_id"
            defaultValue=""
          >
            <option value="">No target role yet</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Status
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            name="status"
            defaultValue="active"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="on_hold">On hold</option>
          </select>
        </label>
        <button
          className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={isCreatePending}
        >
          {isCreatePending ? "Creating candidate..." : "Create Candidate"}
        </button>
      </form>

      {createError ? <p className="mt-4 text-sm text-rose-700">{createError}</p> : null}
      {createSuccess ? <p className="mt-4 text-sm text-teal-700">{createSuccess}</p> : null}
    </section>
  );
}
