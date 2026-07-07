"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  coachingChallengeAreas,
  coachingStatuses,
  coachingSupportPaths,
  coachingUrgencies,
  getCoachingChallengeAreaLabel,
  getCoachingStatusLabel,
  getCoachingSupportPathLabel,
  getCoachingUrgencyLabel,
  type CoachingRequestRecord,
} from "@/lib/coaching-support";

type CoachingRequestListItem = CoachingRequestRecord & {
  requesterName: string;
  requesterEmail: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function CoachingRequestCard({
  request,
  canReviewQueue,
}: {
  request: CoachingRequestListItem;
  canReviewQueue: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState(request.status);
  const [assignedCoachName, setAssignedCoachName] = useState(
    request.assigned_coach_name ?? "",
  );
  const [internalNotes, setInternalNotes] = useState(request.internal_notes ?? "");
  const guidance =
    request.ai_guidance && "situation_summary" in request.ai_guidance
      ? request.ai_guidance
      : null;

  function handleQueueUpdate() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/coaching/requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          assignedCoachName,
          internalNotes,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to update the coaching request.");
        return;
      }

      setSuccess(payload.message ?? "Coaching request updated.");
      router.refresh();
    });
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {getCoachingChallengeAreaLabel(request.challenge_area)}
            </span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              {getCoachingSupportPathLabel(request.support_path)}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {getCoachingUrgencyLabel(request.urgency)}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {getCoachingStatusLabel(request.status)}
            </span>
          </div>

          <h3 className="mt-4 font-display text-2xl text-slate-950">
            {request.challenge_title}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {canReviewQueue
              ? `${request.requesterName}${request.requesterEmail ? ` • ${request.requesterEmail}` : ""}`
              : "Submitted by you"}{" "}
            • {formatDate(request.created_at)}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            {request.challenge_summary}
          </p>
          {request.organizational_context ? (
            <p className="mt-3 text-sm leading-7 text-slate-600">
              <span className="font-semibold text-slate-800">Context:</span>{" "}
              {request.organizational_context}
            </p>
          ) : null}
          {request.desired_outcome ? (
            <p className="mt-3 text-sm leading-7 text-slate-600">
              <span className="font-semibold text-slate-800">Desired outcome:</span>{" "}
              {request.desired_outcome}
            </p>
          ) : null}
        </div>

        {canReviewQueue ? (
          <div className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 lg:max-w-sm">
            <p className="text-sm font-semibold text-slate-900">Coach request queue</p>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Status
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof coachingStatuses[number])
                  }
                >
                  {coachingStatuses.map((option) => (
                    <option key={option} value={option}>
                      {getCoachingStatusLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Assigned coach
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
                  type="text"
                  value={assignedCoachName}
                  onChange={(event) => setAssignedCoachName(event.target.value)}
                  placeholder="Coach name or TBD"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Internal notes
                </span>
                <textarea
                  className="min-h-28 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  placeholder="How should we triage this request?"
                />
              </label>

              <button
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                type="button"
                onClick={handleQueueUpdate}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Queue Update"}
              </button>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              {success ? <p className="text-sm text-teal-700">{success}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      {guidance ? (
        <div className="mt-6 rounded-[1.5rem] border border-[rgba(82,140,94,0.24)] bg-[rgba(239,251,241,0.92)] p-5 text-[#183822]">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#24512f]">
            AI Guidance
          </p>
          <p className="mt-3 text-sm leading-7 text-[#24512f]">
            {guidance.situation_summary}
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-[#14361d]">Likely root causes</p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[#24512f]">
                {guidance.likely_root_causes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2d7c38]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#14361d]">First actions</p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[#24512f]">
                {guidance.first_actions.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2d7c38]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#14361d]">Coaching prompts</p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[#24512f]">
                {guidance.coaching_prompts.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2d7c38]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#14361d]">30-day plan</p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[#24512f]">
                {guidance.thirty_day_plan.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2d7c38]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-[#14361d]">Risks to watch</p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-[#24512f]">
                {guidance.risks_to_watch.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#2d7c38]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-[#b3d9b9] bg-white/60 p-4">
                <p className="text-sm font-semibold text-[#14361d]">
                  When a human coach can help
                </p>
                <p className="mt-2 text-sm leading-7 text-[#24512f]">
                  {guidance.when_to_seek_human_coach}
                </p>
              </div>
              <div className="rounded-2xl border border-[#b3d9b9] bg-white/60 p-4">
                <p className="text-sm font-semibold text-[#14361d]">
                  Best-fit coach profile
                </p>
                <p className="mt-2 text-sm leading-7 text-[#24512f]">
                  {guidance.recommended_coach_profile}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function CoachingSupportManager({
  requests,
  canReviewQueue,
  hasOpenAI,
}: {
  requests: CoachingRequestListItem[];
  canReviewQueue: boolean;
  hasOpenAI: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(formData: FormData, form: HTMLFormElement) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/coaching/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeArea: String(formData.get("challenge_area") ?? ""),
          challengeTitle: String(formData.get("challenge_title") ?? ""),
          challengeSummary: String(formData.get("challenge_summary") ?? ""),
          organizationalContext: String(formData.get("organizational_context") ?? ""),
          desiredOutcome: String(formData.get("desired_outcome") ?? ""),
          urgency: String(formData.get("urgency") ?? ""),
          supportPath: String(formData.get("support_path") ?? ""),
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to submit the coaching request.");
        return;
      }

      form.reset();
      setSuccess(payload.message ?? "Coaching request submitted.");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[linear-gradient(135deg,rgba(239,251,241,0.96),rgba(255,255,255,0.96))] p-8 text-[#183822] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Leadership Help
            </p>
            <h2 className="mt-3 font-display text-3xl text-[#14361d]">
              Develop in your current role and get help with a real challenge
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#24512f]">
              This module is designed for self-led professional development in a
              leader&apos;s current role. The first live workflow is challenge support:
              describe what is happening, decide whether you want AI guidance, a
              personal coach, or both, and keep the request on record for follow-up.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-[#b3d9b9] bg-white/70 px-5 py-4 text-sm text-[#24512f]">
            <p className="font-semibold text-[#14361d]">Phase 1: Challenge Support</p>
            <ul className="mt-3 grid gap-2 leading-7">
              <li>1. Enter the leadership challenge.</li>
              <li>2. Choose AI, human coaching, or both.</li>
              <li>3. Save the request inside Leadership Help.</li>
            </ul>
          </div>
        </div>

        <form
          className="mt-8 grid gap-4 lg:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit(new FormData(event.currentTarget), event.currentTarget);
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              Challenge area
            </span>
            <select
              className="w-full rounded-2xl border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              name="challenge_area"
              defaultValue={coachingChallengeAreas[0]}
            >
              {coachingChallengeAreas.map((option) => (
                <option key={option} value={option}>
                  {getCoachingChallengeAreaLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              Urgency
            </span>
            <select
              className="w-full rounded-2xl border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              name="urgency"
              defaultValue="medium"
            >
              {coachingUrgencies.map((option) => (
                <option key={option} value={option}>
                  {getCoachingUrgencyLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              Short title
            </span>
            <input
              className="w-full rounded-2xl border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              type="text"
              name="challenge_title"
              placeholder="High-turnover manager is losing trust with the team"
              required
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              What challenge are you having?
            </span>
            <textarea
              className="min-h-36 w-full rounded-[1.25rem] border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              name="challenge_summary"
              placeholder="Describe the issue, what you have tried, who is involved, and what feels stuck."
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              Organizational context
            </span>
            <textarea
              className="min-h-28 w-full rounded-[1.25rem] border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              name="organizational_context"
              placeholder="Department size, recent changes, time pressure, or political realities."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#24512f]">
              Desired outcome
            </span>
            <textarea
              className="min-h-28 w-full rounded-[1.25rem] border border-[#b3d9b9] bg-white/85 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38]"
              name="desired_outcome"
              placeholder="What would success look like in the next 30 to 90 days?"
            />
          </label>

          <fieldset className="lg:col-span-2">
            <legend className="mb-3 text-sm font-semibold text-[#24512f]">
              What kind of support do you want?
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
              {coachingSupportPaths.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[#b3d9b9] bg-white/80 px-4 py-4 text-sm text-[#14361d]"
                >
                  <input
                    type="radio"
                    name="support_path"
                    value={option}
                    defaultChecked={option === "both"}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-[#14361d]">
                      {getCoachingSupportPathLabel(option)}
                    </span>
                    <span className="mt-1 block leading-6 text-[#24512f]">
                      {option === "ai_guidance"
                        ? "Receive AI suggestions only."
                        : option === "coach_request"
                          ? "Create a request for human coaching follow-up."
                          : "Generate AI suggestions now and also flag the request for a coach."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {!hasOpenAI ? (
            <p className="lg:col-span-2 text-sm text-amber-700">
              AI guidance requires `OPENAI_API_KEY`. Human-coach requests still work.
            </p>
          ) : null}

          <div className="lg:col-span-2 flex flex-col gap-3">
            <button
              className="interactive-contrast w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Submit Leadership Help Request"}
            </button>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="text-sm text-teal-700">{success}</p> : null}
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              {canReviewQueue ? "Coaching Queue" : "Your requests"}
            </p>
            <h3 className="mt-2 font-display text-2xl text-slate-950">
              {canReviewQueue
                ? "Review leadership help requests across the organization"
                : "Review your leadership help history"}
            </h3>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            {requests.length} request{requests.length === 1 ? "" : "s"}
          </div>
        </div>

        {requests.length > 0 ? (
          requests.map((request) => (
            <CoachingRequestCard
              key={request.id}
              request={request}
              canReviewQueue={canReviewQueue}
            />
          ))
        ) : (
          <article className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/75 px-6 py-6 text-sm leading-7 text-slate-600">
            No coaching requests are on record yet. Submit the first leadership challenge
            above to start building this coaching module.
          </article>
        )}
      </div>
    </section>
  );
}
