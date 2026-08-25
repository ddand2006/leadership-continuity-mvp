import Link from "next/link";

const processStages = [
  {
    badge: "Step 1",
    name: "Add priority roles",
    icon: "01",
    summary:
      "Define the leadership roles you want to protect first, so every candidate and mentor track has a clear destination.",
  },
  {
    badge: "Step 2",
    name: "Add people",
    icon: "02",
    summary:
      "Add the candidates who will move through the succession process and the mentors who will guide them.",
  },
  {
    badge: "Step 3",
    name: "Connect mentor tracks",
    icon: "03",
    summary:
      "Connect each candidate to a priority role and mentor, creating a focused development track with shared context.",
  },
  {
    badge: "Step 4",
    name: "Start a development record",
    icon: "04",
    summary:
      "Launch the leadership development record and use mentoring activities, project work, and readiness reviews to build evidence over time.",
  },
  {
    badge: "Step 5",
    name: "Build bench strength, retain culture",
    icon: "05",
    summary:
      "Use the insight from each development track to strengthen the internal bench while carrying forward the values and knowledge that make your organization distinct.",
  },
] as const;

const narrativePoints = [
  "Give every development conversation a clear target role, a named mentor, and a shared record of progress.",
  "Turn succession planning into active development by connecting people, roles, mentoring work, and readiness evidence in one process.",
  "See which priority roles have a development pipeline and where the organization needs to build more coverage.",
] as const;

const outcomes = [
  "A clear path from priority roles through active development",
  "Candidate-role mentor tracks that keep development focused",
  "Leadership development records that make progress visible over time",
  "A stronger bench for the priority roles the organization needs to protect",
] as const;

const operatingSignals = [
  {
    label: "Priority Roles",
    value: "Chosen intentionally",
    detail: "Start with the roles where continuity matters most.",
  },
  {
    label: "Mentor Tracks",
    value: "Connected with purpose",
    detail: "Pair each candidate, target role, and mentor in one focused track.",
  },
  {
    label: "Development Evidence",
    value: "Recorded over time",
    detail: "Use the development record and readiness review to see progress.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="app-page flex-1 text-slate-950">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.78fr]">
          <div className="theme-panel-strong overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                About The System
              </span>
            </div>

            <div className="mt-6 max-w-4xl space-y-6">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[4.75rem] xl:leading-[0.95]">
                A clear path from priority role to leadership readiness.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Leadership Continuity gives your organization a guided way to identify the roles that matter most, connect candidates with mentors, and record the development work that builds leadership readiness.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
              <span className="rounded-full bg-teal-50 px-4 py-2 text-teal-800">Priority Roles</span>
              <span className="rounded-full bg-slate-100 px-4 py-2">Mentor Tracks</span>
              <span className="rounded-full bg-teal-50 px-4 py-2 text-teal-800">Development Records</span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="interactive-contrast inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Dashboard
              </Link>
              <Link
                href="/roles"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Add Priority Roles
              </Link>
            </div>

            <div className="mt-10 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Priority Roles
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Define the roles your succession program needs to protect.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Mentor Tracks
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Connect each candidate, role, and mentor in a shared track.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Development Records
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Capture development work and review readiness over time.
                </p>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="theme-panel rounded-[2rem] p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                Why It Matters
              </p>
              <div className="mt-5 space-y-4">
                {narrativePoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="theme-panel rounded-[2rem] p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Continuity Lens
              </p>
              <div className="mt-5 space-y-4">
                {operatingSignals.map((signal) => (
                  <article
                    key={signal.label}
                    className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {signal.value}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {signal.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="theme-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Guided Setup Journey
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Set up the program, then put mentoring work in motion.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Start with priority roles, add the people who will do the work, connect each candidate to a mentor track, and use development records to build the leadership bench while retaining your culture.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {processStages.map((stage) => (
              <article
                key={stage.name}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgba(36,95,135,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {stage.badge}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      {stage.name}
                    </h3>
                  </div>
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                    {stage.icon}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  {stage.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="theme-panel rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              The Development Narrative
            </p>
            <div className="mt-5 space-y-4 text-base leading-8 text-slate-600">
              <p>
                Begin by selecting the priority roles you want your continuity plan to protect. Those roles give the program a practical focus from the beginning.
              </p>
              <p>
                Next, add candidates and mentors, then connect each candidate to a target role and mentor. A mentor track gives everyone the same view of the development goal and the relationship supporting it.
              </p>
              <p>
                Start a leadership development record to document mentoring conversations, preparation work, projects, and readiness evidence. Over time, that work builds a stronger bench while helping the organization retain its culture and institutional knowledge.
              </p>
            </div>
          </div>

          <div className="theme-panel rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              What This Builds
            </p>
            <div className="mt-6 grid gap-3 text-sm leading-7 text-slate-600">
              {outcomes.map((outcome) => (
                <article
                  key={outcome}
                  className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  {outcome}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
