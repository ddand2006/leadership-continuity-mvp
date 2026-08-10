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
      `${summary.decisionCount} leadership decision${summary.decisionCount === 1 ? " was" : "s were"} documented`,
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
  const activeRoleTitles = roles
    .filter((role) => role.status === "active")
    .map((role) => role.roleTitle);
  const roleContext =
    activeRoleTitles.length > 0
      ? activeRoleTitles.join(activeRoleTitles.length === 2 ? " and " : ", ")
      : undefined;

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
          A narrative record of the candidate&apos;s development, drawing from
          interviews, mentoring, development work, and leadership decisions.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-teal-200 bg-teal-50 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-900 uppercase">
          {yearToDate.label}
        </p>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-700">
          {buildNarrative({
            candidateName,
            period: `the ${currentYear} calendar year to date`,
            summary: yearToDate,
            roleContext,
          })}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Since Program Start
        </p>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-700">
          {buildNarrative({
            candidateName,
            period: "the full program period",
            summary: sinceStart,
            roleContext,
          })}
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Annual Narrative History
        </p>
        <div className="mt-6 grid gap-4">
          {years.length > 0 ? years.map((year) => {
            const summary = buildReportSummary({
              label: String(year),
              interviews: interviews.filter((item) => isInYear(item.occurredAt, year)),
              developmentRecords: developmentRecords.filter((item) => isInYear(item.occurredAt, year)),
              mentorReportCount: mentorReportDates.filter((item) => isInYear(item, year)).length,
              decisions: events.filter((item) => isInYear(item.occurredAt, year)),
            });

            return (
              <article key={year} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                <p className="text-lg font-semibold text-slate-900">{year}</p>
                <p className="mt-3 leading-7">
                  {buildNarrative({
                    candidateName,
                    period: String(year),
                    summary,
                    roleContext,
                  })}
                </p>
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
