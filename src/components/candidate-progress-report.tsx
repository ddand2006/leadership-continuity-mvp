"use client";

import { useState } from "react";

type RoleProgress = {
  roleId: string;
  roleTitle: string;
  status: "active" | "on_hold";
  isPrimary: boolean;
};

type InterviewProgress = {
  roleId: string;
  panelName: string;
  occurredAt: string;
  averageScore: number | null;
};

type DevelopmentProgress = {
  roleId: string;
  roleTitle: string;
  title: string | null;
  summary: string | null;
  status: string;
  occurredAt: string;
  mentorReviewed: boolean;
};

type ProgressEvent = {
  occurredAt: string;
  label: string;
  detail: string;
};

type ReportPeriod = "year-to-date" | "selected-year" | "program-start";

function isInYear(value: string, year: number) {
  return new Date(value).getFullYear() === year;
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function formatScore(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(1)} / 5`;
}

function buildReportSummary(options: {
  interviews: InterviewProgress[];
  developmentRecords: DevelopmentProgress[];
  mentorReportCount: number;
  decisions: ProgressEvent[];
}) {
  const scoredInterviews = options.interviews
    .filter((interview) => interview.averageScore !== null)
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );
  const earliestScore = scoredInterviews[0]?.averageScore ?? null;
  const latestScore = scoredInterviews.at(-1)?.averageScore ?? null;
  const scoreChange =
    earliestScore !== null && latestScore !== null && scoredInterviews.length > 1
      ? latestScore - earliestScore
      : null;

  return {
    interviewCount: options.interviews.length,
    latestScore,
    scoreChange,
    developmentCount: options.developmentRecords.length,
    completedDevelopmentRecords: options.developmentRecords.filter(
      (record) => record.status === "completed",
    ).length,
    mentorReportCount: options.mentorReportCount,
    decisionCount: options.decisions.length,
  };
}

function buildNarrative(options: {
  candidateName: string;
  period: string;
  summary: ReturnType<typeof buildReportSummary>;
  roleContext?: string;
}) {
  const { summary } = options;
  const activity: string[] = [];

  if (summary.interviewCount > 0) {
    activity.push(
      `${summary.interviewCount} interview round${summary.interviewCount === 1 ? " was" : "s were"} recorded`,
    );
  }
  if (summary.developmentCount > 0) {
    activity.push(
      `${summary.developmentCount} development record${summary.developmentCount === 1 ? " was" : "s were"} maintained${summary.completedDevelopmentRecords > 0 ? `, with ${summary.completedDevelopmentRecords} completed` : ""}`,
    );
  }
  if (summary.mentorReportCount > 0) {
    activity.push(
      `${summary.mentorReportCount} mentor report${summary.mentorReportCount === 1 ? " was" : "s were"} added`,
    );
  }
  if (summary.decisionCount > 0) {
    activity.push(
      `${summary.decisionCount} formal leadership decision${summary.decisionCount === 1 ? " was" : "s were"} documented`,
    );
  }

  const trend =
    summary.scoreChange === null
      ? summary.interviewCount > 0
        ? "Interview feedback is available, though another scored interview will make the change over time clearer."
        : "No interview feedback has been recorded in this period yet."
      : summary.scoreChange > 0.15
        ? "Interview feedback indicates meaningful improvement from the first recorded assessment."
        : summary.scoreChange < -0.15
          ? "Interview feedback indicates an area for renewed attention compared with the first recorded assessment."
          : "Interview feedback has remained broadly consistent across the recorded assessments.";

  return `${options.candidateName}${options.roleContext ? ` is currently being considered for ${options.roleContext}.` : " has no active role consideration recorded."} During ${options.period}, ${activity.length > 0 ? `${activity.join("; ")}.` : "no mentoring, development, interview, or decision activity was recorded."} ${trend}`;
}

export function CandidateProgressReport({
  candidateName,
  roles,
  interviews,
  developmentRecords,
  mentorReportDates,
  events,
  decisionEvents,
}: {
  candidateName: string;
  roles: RoleProgress[];
  interviews: InterviewProgress[];
  developmentRecords: DevelopmentProgress[];
  mentorReportDates: string[];
  events: ProgressEvent[];
  decisionEvents: ProgressEvent[];
}) {
  const currentYear = new Date().getFullYear();
  const datedValues = [
    ...interviews.map((item) => item.occurredAt),
    ...developmentRecords.map((item) => item.occurredAt),
    ...mentorReportDates,
    ...events.map((item) => item.occurredAt),
  ].filter((value) => !Number.isNaN(new Date(value).getTime()));
  const years = Array.from(
    new Set(datedValues.map((value) => new Date(value).getFullYear())),
  ).sort((left, right) => right - left);
  const [period, setPeriod] = useState<ReportPeriod>("year-to-date");
  const [selectedYear, setSelectedYear] = useState(years[0] ?? currentYear);
  const activeRoleTitles = roles
    .filter((role) => role.status === "active")
    .map((role) => role.roleTitle);
  const roleContext =
    activeRoleTitles.length > 0
      ? activeRoleTitles.join(activeRoleTitles.length === 2 ? " and " : ", ")
      : undefined;
  const reportingYear = period === "year-to-date" ? currentYear : selectedYear;
  const isPeriodFilteredByYear = period !== "program-start";
  const periodLabel =
    period === "year-to-date"
      ? `${currentYear} Year to Date`
      : period === "selected-year"
        ? String(selectedYear)
        : "Since Program Start";
  const narrativePeriod =
    period === "year-to-date"
      ? `the ${currentYear} calendar year to date`
      : period === "selected-year"
        ? String(selectedYear)
        : "the full program period";
  const periodInterviews = isPeriodFilteredByYear
    ? interviews.filter((item) => isInYear(item.occurredAt, reportingYear))
    : interviews;
  const periodDevelopmentRecords = isPeriodFilteredByYear
    ? developmentRecords.filter((item) => isInYear(item.occurredAt, reportingYear))
    : developmentRecords;
  const periodMentorReportCount = isPeriodFilteredByYear
    ? mentorReportDates.filter((item) => isInYear(item, reportingYear)).length
    : mentorReportDates.length;
  const periodDecisionEvents = isPeriodFilteredByYear
    ? decisionEvents.filter((item) => isInYear(item.occurredAt, reportingYear))
    : decisionEvents;
  const periodEvents = isPeriodFilteredByYear
    ? events.filter((item) => isInYear(item.occurredAt, reportingYear))
    : events;
  const summary = buildReportSummary({
    interviews: periodInterviews,
    developmentRecords: periodDevelopmentRecords,
    mentorReportCount: periodMentorReportCount,
    decisions: periodDecisionEvents,
  });
  const latestEvents = [...periodEvents]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 6);

  return (
    <section className="candidate-progress-report grid gap-6">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .candidate-progress-report, .candidate-progress-report * { visibility: visible; }
          .candidate-progress-report { position: absolute; inset: 0; width: 100%; }
          .progress-report-controls { display: none !important; }
        }
      `}</style>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Candidate Progress Report
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Progress for {candidateName}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Choose the reporting period, then review the complete narrative,
              scorecard, and development activity together.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="progress-report-controls rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Print This Report
          </button>
        </div>

        <div className="progress-report-controls mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={() => setPeriod("year-to-date")}
            className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${period === "year-to-date" ? "interactive-contrast border-teal-900 bg-teal-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Current Year to Date
          </button>
          <label className={`flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${period === "selected-year" ? "border-teal-700 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700"}`}>
            <span>Select a year</span>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setPeriod("selected-year");
              }}
              className="bg-transparent outline-none"
            >
              {(years.length > 0 ? years : [currentYear]).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPeriod("program-start")}
            className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${period === "program-start" ? "interactive-contrast border-teal-900 bg-teal-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Since Program Start
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-teal-200 bg-teal-50 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-900 uppercase">{periodLabel}</p>
        <h3 className="mt-3 font-display text-3xl text-slate-900">Progress Narrative</h3>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-700">
          {buildNarrative({ candidateName, period: narrativePeriod, summary, roleContext })}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Progress Scorecard</p>
        <h3 className="mt-3 font-display text-3xl text-slate-900">Evidence of progress</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase"><tr><th className="px-4 py-3">Measure</th><th className="px-4 py-3">{periodLabel}</th></tr></thead>
            <tbody>
              {[
                ["Interview rounds", summary.interviewCount],
                ["Latest interview average", formatScore(summary.latestScore)],
                ["Change in interview average", summary.scoreChange === null ? "More data needed" : `${summary.scoreChange >= 0 ? "+" : ""}${summary.scoreChange.toFixed(1)}`],
                ["Development records", summary.developmentCount],
                ["Completed development records", summary.completedDevelopmentRecords],
                ["Mentor reports", summary.mentorReportCount],
              ].map(([measure, value]) => (
                <tr key={String(measure)} className="border-b border-slate-100"><th className="px-4 py-4 font-semibold text-slate-900">{measure}</th><td className="px-4 py-4">{value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Projects & Development</p>
        <h3 className="mt-3 font-display text-3xl text-slate-900">Development work completed and underway</h3>
        <div className="mt-6 grid gap-4">
          {[...periodDevelopmentRecords].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()).map((record, index) => (
            <article key={`${record.roleId}-${record.occurredAt}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-lg font-semibold text-slate-900">{record.title ?? "Development record"}</p><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.1em] text-slate-600 uppercase">{record.status.replaceAll("_", " ")}</span></div>
              <p className="mt-2 font-medium text-slate-600">Role: {record.roleTitle}</p>
              {record.summary ? <p className="mt-3 leading-7">{record.summary}</p> : null}
              <p className="mt-3 text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">{formatDate(record.occurredAt)}{record.mentorReviewed ? " · Mentor reviewed" : ""}</p>
            </article>
          ))}
          {periodDevelopmentRecords.length === 0 ? <p className="text-sm leading-7 text-slate-600">No development projects or records were saved for this reporting period.</p> : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Recent Activity</p>
        <div className="mt-6 grid gap-3">
          {latestEvents.length > 0 ? latestEvents.map((event, index) => (
            <article key={`${event.occurredAt}-${event.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">{event.label}</p><p className="mt-1 leading-6">{event.detail}</p><p className="mt-2 text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">{formatDate(event.occurredAt)}</p></article>
          )) : <p className="text-sm leading-7 text-slate-600">No progress activity has been recorded for this reporting period.</p>}
        </div>
      </section>
    </section>
  );
}
