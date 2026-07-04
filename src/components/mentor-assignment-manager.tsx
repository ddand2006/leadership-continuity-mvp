"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CandidateOption = {
  id: string;
  full_name: string;
};

type RoleOption = {
  id: string;
  title: string;
};

type MentorOption = {
  id: string;
  full_name: string;
  position_title: string | null;
};

export function MentorAssignmentManager({
  candidates,
  roles,
  mentors,
  canChooseMentor = true,
}: {
  candidates: CandidateOption[];
  roles: RoleOption[];
  mentors: MentorOption[];
  canChooseMentor?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(formData: FormData, form: HTMLFormElement) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/mentoring/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: String(formData.get("candidateId") ?? ""),
          roleId: String(formData.get("roleId") ?? ""),
          mentorProfileId: canChooseMentor
            ? String(formData.get("mentorProfileId") ?? "")
            : mentors[0]?.id ?? "",
          startDate: String(formData.get("startDate") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to assign mentor.");
        return;
      }

      form.reset();
      setSuccess(payload.message ?? "Mentor assigned.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Role-Based Mentor Assignment
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Tie mentors to candidates through the role
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        {canChooseMentor
          ? "Use this when one candidate is being considered for more than one role. Each assignment gives that mentor access to the candidate in the context of the selected role."
          : "Use this to attach a candidate to one of your mentoring roles. The Leadership Continuity System will keep the candidate, role, and your mentor access tied together."}
      </p>

      <form
        className="mt-6 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget), event.currentTarget);
        }}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Candidate
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            name="candidateId"
            defaultValue=""
            required
          >
            <option value="">Select candidate</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Role
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            name="roleId"
            defaultValue=""
            required
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>
        {canChooseMentor ? (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Mentor
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              name="mentorProfileId"
              defaultValue=""
              required
            >
              <option value="">Select mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.full_name}
                  {mentor.position_title ? ` • ${mentor.position_title}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Mentor
            </p>
            <p className="mt-2 font-semibold text-slate-900">
              {mentors[0]?.full_name ?? "Mentor account"}
            </p>
            <p className="mt-1 text-slate-600">
              {mentors[0]?.position_title ?? "Current mentor login"}
            </p>
          </article>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Start date
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            type="date"
            name="startDate"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Notes
          </span>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            name="notes"
            placeholder="Optional mentoring context for this role assignment."
          />
        </label>
        <div className="md:col-span-2">
          <button
            className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="submit"
            disabled={isPending || candidates.length === 0 || roles.length === 0 || mentors.length === 0}
          >
            {isPending
              ? "Saving role assignment..."
              : canChooseMentor
                ? "Assign Mentor to Candidate Role"
                : "Attach Candidate to My Role"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-teal-700">{success}</p> : null}
    </section>
  );
}
