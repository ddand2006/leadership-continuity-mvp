import Link from "next/link";

const processStages = [
  {
    badge: "Step 1",
    name: "Confirm company settings",
    accent: "from-amber-100 via-white to-orange-50",
    border: "border-amber-200/80",
    icon: "01",
    summary:
      "Confirm company settings, including the organization name and industry, before building the program.",
    steps: [
      "Company settings",
      "Organization profile",
      "Product access",
    ],
  },
  {
    badge: "Step 2",
    name: "Add priority roles",
    accent: "from-sky-100 via-white to-cyan-50",
    border: "border-sky-200/80",
    icon: "02",
    summary:
      "Define the leadership roles you want to protect first, so every candidate and mentor track has a clear destination.",
    steps: [
      "Priority roles",
      "Role competencies",
      "Leadership standard",
    ],
  },
  {
    badge: "Step 3",
    name: "Add people",
    accent: "from-emerald-100 via-white to-teal-50",
    border: "border-emerald-200/80",
    icon: "03",
    summary:
      "Add the candidates who will move through the succession process and the mentors who will guide them.",
    steps: [
      "Candidate profiles",
      "Mentor profiles",
      "User access",
    ],
  },
  {
    badge: "Step 4",
    name: "Connect mentor tracks",
    accent: "from-violet-100 via-white to-indigo-50",
    border: "border-violet-200/80",
    icon: "04",
    summary:
      "Connect each candidate to a priority role and mentor, creating a focused development track with shared context.",
    steps: [
      "Candidate",
      "Target role",
      "Assigned mentor",
    ],
  },
  {
    badge: "Step 5",
    name: "Start a development record",
    accent: "from-rose-100 via-white to-orange-50",
    border: "border-rose-200/80",
    icon: "05",
    summary:
      "Launch the leadership development record and use mentoring activities, project work, and readiness reviews to build evidence over time.",
    steps: [
      "Development record",
      "Mentoring activities",
      "Readiness review",
    ],
  },
] as const;

const narrativePoints = [
  "Give every development conversation a clear target role, a named mentor, and a shared record of progress.",
  "Turn succession planning into active development by connecting people, roles, mentoring work, and readiness evidence in one process.",
  "See which priority roles have a development pipeline and where the organization needs to build more coverage.",
] as const;

const outcomes = [
  "A clear onboarding path from company setup through active development",
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
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#fff6d8_0%,#f4fbf8_42%,#edf4f2_100%)] text-slate-950">
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(115deg,rgba(19,78,74,0.12),rgba(59,130,246,0.08),transparent)] blur-3xl" />
      <div className="absolute left-1/2 top-20 h-64 w-64 -translate-x-1/2 rounded-full bg-[rgba(255,255,255,0.6)] blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[1380px] flex-col gap-12 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.78fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/84 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-800">
                About The System
              </span>
            </div>

            <div className="mt-6 max-w-4xl space-y-6">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[4.75rem] xl:leading-[0.95]">
                A clear path from priority role to leadership readiness.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Leadership Continuity gives your organization a guided way to set up the program, identify the roles that matter most, connect candidates with mentors, and record the development work that builds leadership readiness.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
              <span className="rounded-full bg-[#fff1c7] px-4 py-2">Priority Roles</span>
              <span className="rounded-full bg-[#d8f8f1] px-4 py-2">Mentor Tracks</span>
              <span className="rounded-full bg-[#e5eef8] px-4 py-2">Development Records</span>
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

            <div className="mt-10 grid gap-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/85 p-4 sm:grid-cols-3 sm:p-5">
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
            <div className="rounded-[2rem] bg-[#04111f] p-6 text-white shadow-[0_30px_90px_rgba(2,6,23,0.28)] sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                Why It Matters
              </p>
              <div className="mt-5 space-y-4">
                {narrativePoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/75 bg-white/82 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Continuity Lens
              </p>
              <div className="mt-5 space-y-4">
                {operatingSignals.map((signal) => (
                  <article
                    key={signal.label}
                    className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/85 p-4"
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

        <section className="rounded-[2rem] border border-white/75 bg-white/82 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.07)] backdrop-blur sm:p-8 lg:p-10">
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
              Follow the same five steps shown on the Dashboard: confirm company settings, add priority roles, add candidates and mentors, connect mentor tracks, and start the first leadership development record.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {processStages.map((stage) => (
              <article
                key={stage.name}
                className={`rounded-[1.75rem] border ${stage.border} bg-gradient-to-br ${stage.accent} p-6 shadow-[0_16px_45px_rgba(15,23,42,0.05)]`}
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
                  <span className="rounded-full border border-slate-200/70 bg-white/75 px-3 py-1 text-xs font-semibold text-slate-700">
                    {stage.icon}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  {stage.summary}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {stage.steps.map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/75 bg-white/82 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.07)] backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              The Development Narrative
            </p>
            <div className="mt-5 space-y-4 text-base leading-8 text-slate-600">
              <p>
                Begin by confirming company settings and selecting the priority roles you want your continuity plan to protect. Those roles give the program a practical focus from the beginning.
              </p>
              <p>
                Next, add candidates and mentors, then connect each candidate to a target role and mentor. A mentor track gives everyone the same view of the development goal and the relationship supporting it.
              </p>
              <p>
                Finally, start a leadership development record. Use mentoring conversations, preparation work, projects, and readiness reviews to document the experience and evidence that build role readiness.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgba(2,6,23,0.28)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              What This Builds
            </p>
            <div className="mt-6 grid gap-3 text-sm leading-7 text-slate-200">
              {outcomes.map((outcome) => (
                <article
                  key={outcome}
                  className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4"
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
