"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { initialGenerateDevelopmentPlansState } from "@/app/development-plans/action-state";
import {
  generateDevelopmentPlansAction,
} from "@/app/development-plans/actions";

function GenerateButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
    >
      {pending ? "Generating..." : "Generate Library Ideas"}
    </button>
  );
}

export function DevelopmentPlanGeneratorCard({
  roles,
  canGenerate,
}: {
  roles: Array<{
    id: string;
    title: string;
    department: string | null;
  }>;
  canGenerate: boolean;
}) {
  const [state, formAction] = useActionState(
    generateDevelopmentPlansAction,
    initialGenerateDevelopmentPlansState,
  );

  return (
    <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
          AI Generator
        </p>
        <h2 className="mt-3 font-display text-4xl leading-tight text-slate-900">
          Generate development plan ideas from a role
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          Pick a role with competencies already loaded. The app will generate
          practical mentoring assignments tied to that role, matching
          competencies, and relevant CliftonStrengths themes, then save them to
          your organization&apos;s library.
        </p>

        <form action={formAction} className="mt-8 grid gap-5">
          <label className="grid gap-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Role</span>
            <select
              name="roleId"
              defaultValue={roles[0]?.id ?? ""}
              disabled={!canGenerate || roles.length === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            >
              {roles.length > 0 ? (
                roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.department
                      ? `${role.title} • ${role.department}`
                      : role.title}
                  </option>
                ))
              ) : (
                <option value="">No roles available</option>
              )}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">How many ideas</span>
            <select
              name="count"
              defaultValue="6"
              disabled={!canGenerate || roles.length === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            >
              <option value="4">4 ideas</option>
              <option value="6">6 ideas</option>
              <option value="8">8 ideas</option>
              <option value="10">10 ideas</option>
            </select>
          </label>

          <div className="pt-2">
            <GenerateButton disabled={!canGenerate || roles.length === 0} />
          </div>
        </form>
      </div>

      <div className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#486454] uppercase">
          What it saves
        </p>
        <div className="mt-5 space-y-3 text-sm leading-7 text-[#486454]">
          <p>Each saved idea includes title, description, difficulty, and timeline.</p>
          <p>It also stores competencies developed, strengths leveraged, outcomes, mentor prompts, and evidence of success.</p>
          <p>Those saved plans become available immediately for mentor reports and role-fit mentoring suggestions.</p>
        </div>

        {!canGenerate ? (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950">
            Add a real <span className="font-semibold">OPENAI_API_KEY</span> in{" "}
            <span className="font-semibold">.env.local</span> to turn on the
            generator.
          </div>
        ) : null}

        {state.message ? (
          <div
            className={`mt-6 rounded-2xl px-4 py-4 text-sm leading-7 ${
              state.status === "success"
                ? "border border-[rgba(82,140,94,0.2)] bg-white/72 text-[#183822]"
                : "border border-rose-300 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="font-semibold">{state.message}</p>
            {state.generatedTitles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {state.generatedTitles.map((title) => (
                  <span
                    key={title}
                    className="rounded-full border border-[rgba(82,140,94,0.2)] bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-[#183822] uppercase"
                  >
                    {title}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
