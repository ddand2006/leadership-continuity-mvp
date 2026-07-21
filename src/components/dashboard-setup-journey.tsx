import Link from "next/link";

export type DashboardSetupJourneyStep = {
  id: string;
  label: string;
  description: string;
  statusLabel: string;
  complete: boolean;
  href: string;
  actionLabel: string;
};

export type DashboardSetupJourneySummary = {
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  primaryActionHref: string | null;
  primaryActionLabel: string | null;
  primaryActionTitle: string | null;
  primaryActionDescription: string | null;
  counts: {
    roles: number;
    candidates: number;
    mentors: number;
    mentorAssignments: number;
    developmentRecords: number;
  };
  steps: DashboardSetupJourneyStep[];
};

export function DashboardSetupJourney({
  summary,
}: {
  summary: DashboardSetupJourneySummary;
}) {
  const progressPercent =
    summary.totalSteps > 0
      ? Math.round((summary.completedSteps / summary.totalSteps) * 100)
      : 0;

  return (
    <section className="theme-panel-strong rounded-[2rem] p-5 sm:p-8">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Setup Journey
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
            Launch your mentoring program one step at a time
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Keep administrators in one clear sequence: confirm company settings,
            define the priority roles, add people, connect candidate-role tracks
            to mentors, and start the first development record.
          </p>
        </div>

        <article className="rounded-[1.5rem] border border-teal-200 bg-teal-50/80 p-5 shadow-[0_20px_60px_rgba(15,118,110,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-teal-800 uppercase">
                Setup Progress
              </p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">
                {summary.completedSteps}/{summary.totalSteps}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {summary.isComplete
                  ? "The core onboarding path is complete and mentoring work is live."
                  : `${progressPercent}% complete. Follow the next guided step to keep the program moving.`}
              </p>
            </div>
            <div className="rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold tracking-[0.14em] text-teal-800 uppercase">
              {summary.isComplete ? "Live" : "In Setup"}
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-teal-800 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Roles
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.counts.roles}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                People
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.counts.candidates + summary.counts.mentors}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {summary.counts.candidates} candidates • {summary.counts.mentors} mentors
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Mentor Tracks
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.counts.mentorAssignments}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                Live Records
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {summary.counts.developmentRecords}
              </p>
            </div>
          </div>

          {summary.primaryActionHref &&
          summary.primaryActionLabel &&
          summary.primaryActionTitle &&
          summary.primaryActionDescription ? (
            <div className="mt-5 rounded-[1.25rem] border border-teal-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-teal-800 uppercase">
                Next Guided Step
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {summary.primaryActionTitle}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {summary.primaryActionDescription}
              </p>
              <Link
                href={summary.primaryActionHref}
                className="interactive-contrast mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                {summary.primaryActionLabel}
              </Link>
            </div>
          ) : null}
        </article>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        {summary.steps.map((step, index) => (
          <article
            key={step.id}
            className={`rounded-[1.5rem] border p-5 ${
              step.complete
                ? "border-teal-200 bg-teal-50/70"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900">
                {index + 1}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase ${
                  step.complete
                    ? "bg-teal-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {step.complete ? "Complete" : "Next Up"}
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900">
              {step.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {step.description}
            </p>
            <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
              {step.statusLabel}
            </p>
            <Link
              href={step.href}
              className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold transition ${
                step.complete
                  ? "border border-teal-200 bg-white text-teal-900 hover:border-teal-400"
                  : "interactive-contrast bg-slate-950 text-white hover:bg-teal-900"
              }`}
            >
              {step.actionLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
