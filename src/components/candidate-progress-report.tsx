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
  status: string;
  occurredAt: string;
  mentorReviewed: boolean;
};

type ProgressEvent = {
  occurredAt: string;
  label: string;
  detail: string;
};

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
  return value === null ? "Not scored" : `${value.toFixed(1)} / 5`;
}

function buildReportSummary(options: {
  label: string;
  interviews: InterviewProgress[];
  developmentRecords: DevelopmentProgress[];
  mentorReportCount: number;
  decisions: ProgressEvent[];
}) {
  const scoredInterviews = options.interviews.filter(
    (interview) => interview.averageScore !== null,
  );
  const earliestScore = scoredInterviews[0]?.averageScore ?? null;
  const latestScore = scoredInterviews.at(-1)?.averageScore ?? null;
  const scoreChange =
    earliestScore !== null && latestScore !== null && scoredInterviews.length > 1
      ? latestScore - earliestScore
      : null;
  const completedDevelopmentRecords = options.developmentRecords.filter(
    (record) => record.status === "completed",
  ).length;

  return {
    label: options.label,
    interviewCount: options.interviews.length,
    latestScore,
    scoreChange,
    developmentCount: options.developmentRecords.length,
    completedDevelopmentRecords,
    mentorReportCount: options.mentorReportCount,
    decisionCount: options.decisions.length,
  };
}

export function CandidateProgressReport({
  candidateName,
  roles,
  interviews,
  developmentRecords,
  mentorReportDates,
  events,
}: {
  candidateName: string;
  roles: RoleProgress[];
  interviews: InterviewProgress[];
  developmentRecords: DevelopmentProgress[];
  mentorReportDates: string[];
  events: ProgressEvent[];
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
  const yearToDate = buildReportSummary({
    label: `${currentYear} year to date`,
    interviews: interviews.filter((item) => isInYear(item.occurredAt, currentYear)),
    developmentRecords: developmentRecords.filter((item) =>
      isInYear(item.occurredAt, currentYear),
    ),
    mentorReportCount: mentorReportDates.filter((item) => isInYear(item, currentYear))
      .length,
    decisions: events.filter((item) => isInYear(item.occurredAt, currentYear)),
  });
  const sinceStart = buildReportSummary({
    label: "Since program start",
    interviews,
    developmentRecords,
    mentorReportCount: mentorReportDates.length,
    decisions: events,
  });
  const latestEvents = [...events]
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 6);

  return (
    <section className="grid gap-6">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Candidate Progress Report
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Progress for {candidateName}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          Track growth through interviews, mentoring, development work, and
          leadership decisions. Use the summaries below to compare progress this
          year, across the full program, and year by year.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl border border-teal-200 bg-teal-50 p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-teal-900 uppercase">
              Roles in consideration
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{roles.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {roles.filter((role) => role.status === "active").length} active role
              {roles.filter((role) => role.status === "active").length === 1 ? "" : "s"}
              {roles.some((role) => role.isPrimary) ? ", including a primary role." : "."}
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Latest interview average
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {formatScore(sinceStart.latestScore)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {sinceStart.scoreChange === null
                ? "Complete at least two scored interviews to show change over time."
                : `${sinceStart.scoreChange >= 0 ? "+" : ""}${sinceStart.scoreChange.toFixed(1)} since the first scored interview.`}
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Development momentum
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {sinceStart.completedDevelopmentRecords} completed
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {sinceStart.developmentCount} development record
              {sinceStart.developmentCount === 1 ? "" : "s"} saved overall.
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {[yearToDate, sinceStart].map((summary) => (
          <article
            key={summary.label}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]"
          >
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
              {summary.label}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <p><span className="block text-2xl font-semibold text-slate-900">{summary.interviewCount}</span>interview round{summary.interviewCount === 1 ? "" : "s"}</p>
              <p><span className="block text-2xl font-semibold text-slate-900">{summary.developmentCount}</span>development record{summary.developmentCount === 1 ? "" : "s"}</p>
              <p><span className="block text-2xl font-semibold text-slate-900">{summary.mentorReportCount}</span>mentor report{summary.mentorReportCount === 1 ? "" : "s"}</p>
              <p><span className="block text-2xl font-semibold text-slate-900">{summary.decisionCount}</span>leadership decision{summary.decisionCount === 1 ? "" : "s"}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Annual History
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {years.length > 0 ? years.map((year) => {
            const summary = buildReportSummary({
              label: String(year),
              interviews: interviews.filter((item) => isInYear(item.occurredAt, year)),
              developmentRecords: developmentRecords.filter((item) => isInYear(item.occurredAt, year)),
              mentorReportCount: mentorReportDates.filter((item) => isInYear(item, year)).length,
              decisions: events.filter((item) => isInYear(item.occurredAt, year)),
            });

            return (
              <article key={year} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                <p className="text-2xl font-semibold text-slate-900">{year}</p>
                <p className="mt-3">{summary.interviewCount} interview rounds · {summary.developmentCount} development records</p>
                <p className="mt-2">Latest interview: {formatScore(summary.latestScore)}</p>
                <p className="mt-2">{summary.mentorReportCount} mentor reports · {summary.decisionCount} decisions</p>
              </article>
            );
          }) : (
            <p className="text-sm leading-7 text-slate-600">
              Progress history will appear after interviews, mentoring, development, or leadership decisions are recorded.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Recent Progress
        </p>
        <div className="mt-6 grid gap-3">
          {latestEvents.length > 0 ? latestEvents.map((event, index) => (
            <article key={`${event.occurredAt}-${event.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{event.label}</p>
              <p className="mt-1 leading-6">{event.detail}</p>
              <p className="mt-2 text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">{formatDate(event.occurredAt)}</p>
            </article>
          )) : (
            <p className="text-sm leading-7 text-slate-600">No progress activity has been recorded yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}
