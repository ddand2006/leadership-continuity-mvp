"use client";

import { useEffect, useState, useTransition } from "react";
import {
  roleSurveyQuestionDefinitions,
  type RoleSurveyQuestionKey,
  type RoleSurveyResponsePayload,
} from "@/lib/role-competency-surveys";

type RoleSurveyResponseFormProps = {
  token: string;
  recipientName: string;
  surveyTitle: string;
  roleTitle: string;
  introMessage: string | null;
  thankYouMessage: string | null;
  surveyStatus: "draft" | "active" | "closed";
  recipientStatus: "pending" | "opened" | "completed";
  completedAt: string | null;
};

const emptyResponsePayload: RoleSurveyResponsePayload = {
  essential_knowledge: "",
  critical_skills: "",
  personality_traits: "",
  relationship_style: "",
  organizational_presence: "",
  cross_department_collaboration: "",
  signals_of_success: "",
  common_derailers: "",
  development_priorities: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function RoleSurveyResponseForm({
  token,
  recipientName,
  surveyTitle,
  roleTitle,
  introMessage,
  thankYouMessage,
  surveyStatus,
  recipientStatus,
  completedAt,
}: RoleSurveyResponseFormProps) {
  const [answers, setAnswers] =
    useState<RoleSurveyResponsePayload>(emptyResponsePayload);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasMarkedOpen, setHasMarkedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (
      hasMarkedOpen ||
      surveyStatus !== "active" ||
      recipientStatus === "completed"
    ) {
      return;
    }

    setHasMarkedOpen(true);
    void fetch(`/api/role-surveys/respond/${token}`, {
      method: "PATCH",
    }).catch(() => null);
  }, [hasMarkedOpen, recipientStatus, surveyStatus, token]);

  if (recipientStatus === "completed") {
    return (
      <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/90 p-8 text-emerald-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase">
          Survey Received
        </p>
        <h1 className="mt-3 font-display text-4xl">
          Thank you, {recipientName}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7">
          Your response for <span className="font-semibold">{surveyTitle}</span>
          {" "}has already been submitted
          {completedAt ? ` on ${formatDate(completedAt)}` : ""}.
        </p>
      </section>
    );
  }

  if (surveyStatus !== "active") {
    return (
      <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase">
          Survey Unavailable
        </p>
        <h1 className="mt-3 font-display text-4xl">
          This survey is not accepting responses right now
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7">
          The survey for <span className="font-semibold">{roleTitle}</span> is
          currently closed or still being prepared.
        </p>
      </section>
    );
  }

  if (success) {
    return (
      <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/90 p-8 text-emerald-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] uppercase">
          Response Submitted
        </p>
        <h1 className="mt-3 font-display text-4xl">
          Thank you, {recipientName}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7">
          {thankYouMessage ||
            "Your input has been recorded and will help strengthen this role profile."}
        </p>
      </section>
    );
  }

  function updateAnswer(key: RoleSurveyQuestionKey, value: string) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/role-surveys/respond/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(answers),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to submit your survey response.");
        return;
      }

      setSuccess(payload.message ?? "Your survey response was submitted.");
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
        Role Competency Survey
      </p>
      <h1 className="mt-3 font-display text-4xl text-slate-950">
        {surveyTitle}
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        {introMessage ||
          `Please share what success really looks like in ${roleTitle}. Your input will help define the competencies and behaviors that matter most.`}
      </p>
      <p className="mt-4 text-sm font-semibold text-slate-700">
        Responding as: {recipientName}
      </p>

      <div className="mt-8 grid gap-6">
        {roleSurveyQuestionDefinitions.map((question) => (
          <label
            key={question.key}
            className="block rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
          >
            <span className="block text-base font-semibold text-slate-900">
              {question.shortLabel}
            </span>
            <span className="mt-2 block text-sm leading-7 text-slate-700">
              {question.prompt}
            </span>
            <span className="mt-2 block text-xs leading-6 text-slate-500">
              {question.helpText}
            </span>
            <textarea
              className="mt-4 min-h-32 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-700"
              value={answers[question.key]}
              onChange={(event) =>
                updateAnswer(question.key, event.currentTarget.value)
              }
              placeholder="Add your thoughts here"
            />
          </label>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? "Submitting..." : "Submit Survey Response"}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </section>
  );
}
