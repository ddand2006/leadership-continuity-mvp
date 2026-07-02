import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";

const processStages = [
  {
    badge: "Step 1",
    name: "Roles",
    accent: "from-amber-100 via-white to-orange-50",
    border: "border-amber-200/80",
    icon: "01",
    summary:
      "Define the leadership role, the competencies that matter most, and the composite of what success looks like before urgency takes over.",
    steps: [
      "Create role",
      "Select role",
      "Input competencies",
      "Create composite",
      "View role narrative",
    ],
  },
  {
    badge: "Step 2",
    name: "Candidates",
    accent: "from-sky-100 via-white to-cyan-50",
    border: "border-sky-200/80",
    icon: "02",
    summary:
      "Evaluate internal talent against the role using consistent evidence, strengths, readiness signals, and development gaps.",
    steps: [
      "Add candidate",
      "Select candidate",
      "Input interview scores",
      "View role fit and strengths",
      "Generate mentor report",
    ],
  },
  {
    badge: "Step 3",
    name: "Mentoring",
    accent: "from-emerald-100 via-white to-teal-50",
    border: "border-emerald-200/80",
    icon: "03",
    summary:
      "Turn assessment into guided development with mentor conversations, preparation work, and stretch assignments anchored in real leadership demands.",
    steps: [
      "Assign mentor",
      "Select track",
      "Preparation worksheet",
      "Departmental project",
      "Cross-departmental project",
    ],
  },
] as const;

const narrativePoints = [
  "Protect culture by making leadership expectations explicit instead of keeping them trapped in the experience of a few long-tenured leaders.",
  "Protect institutional knowledge by moving emerging leaders through deliberate coaching before a transition happens.",
  "Build a visible development pipeline so succession becomes an operating discipline rather than a last-minute replacement exercise.",
] as const;

const outcomes = [
  "Shared language for what great leadership looks like in each role",
  "Clearer evidence about who is ready now and who needs development",
  "Mentoring work tied directly to real hospital leadership demands",
  "A stronger internal bench that keeps knowledge inside the organization",
] as const;

const operatingSignals = [
  {
    label: "Role Clarity",
    value: "Defined before a vacancy",
    detail: "Turn implicit expectations into a visible leadership standard.",
  },
  {
    label: "Talent Evidence",
    value: "Compared consistently",
    detail: "See strengths, readiness, and developmental gaps in one flow.",
  },
  {
    label: "Mentoring Motion",
    value: "Linked to the role",
    detail: "Guide development through practical, role-based work.",
  },
] as const;

export default async function Home() {
  const isConfigured = hasSupabaseEnv();

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
              {isConfigured ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Supabase env detected
                </span>
              ) : null}
            </div>

            <div className="mt-6 max-w-4xl space-y-6">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[4.75rem] xl:leading-[0.95]">
                A development process built to raise the next generation of leaders.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Leadership Continuity helps a hospital define what leadership success looks like, identify internal talent against that standard, and move promising people into structured mentoring that grows readiness while preserving culture and institutional knowledge.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-700">
              <span className="rounded-full bg-[#fff1c7] px-4 py-2">Roles First</span>
              <span className="rounded-full bg-[#d8f8f1] px-4 py-2">Candidate Evidence</span>
              <span className="rounded-full bg-[#e5eef8] px-4 py-2">Mentoring Development</span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Open Dashboard
              </Link>
              <Link
                href="/roles"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Start With Roles
              </Link>
            </div>

            <div className="mt-10 grid gap-4 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/85 p-4 sm:grid-cols-3 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Leadership Standard
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Clarify what success means before a vacancy creates pressure.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Evidence Review
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Compare internal talent with consistent role-based evidence.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Mentoring Action
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Turn readiness insight into deliberate developmental motion.
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
                Three-Step Flow
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Roles lead to candidates, and candidates lead to mentoring.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              The system is designed as a sequence. We first define the role, then evaluate people against that role, then guide development through mentoring anchored in real leadership demands.
            </p>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-3">
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
                This process starts by clarifying leadership expectations before a vacancy creates pressure. That alone strengthens the organization because people stop guessing what success looks like in important roles.
              </p>
              <p>
                From there, the candidate workflow creates a more thoughtful picture of internal talent. Instead of choosing future leaders based on familiarity or urgency, the hospital can compare evidence, strengths, readiness, and developmental gaps in a consistent way.
              </p>
              <p>
                The mentoring stage turns that insight into action. Emerging leaders are developed in context, with real assignments, mentor conversations, and exposure to cross-functional leadership work.
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
