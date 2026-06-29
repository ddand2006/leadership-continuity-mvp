import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

export default async function Home() {
  const processStages = [
    {
      name: "Roles",
      badge: "Step 1",
      tone:
        "border-amber-200 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))] text-amber-950",
      accent: "bg-[#cf641f]",
      summary:
        "Start by defining the leadership role, the competencies that matter most, and the composite of what success looks like.",
      steps: [
        "Create role",
        "Select role",
        "Input competencies",
        "Create composite",
        "View role narrative",
      ],
    },
    {
      name: "Candidates",
      badge: "Step 2",
      tone:
        "border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] text-sky-950",
      accent: "bg-[#245b9b]",
      summary:
        "Once the role is clear, evaluate internal talent against it through interview evidence, strengths, and readiness signals.",
      steps: [
        "Add candidate",
        "Select candidate",
        "Input interview scores",
        "View role fit and strengths",
        "Generate mentor report",
      ],
    },
    {
      name: "Mentoring",
      badge: "Step 3",
      tone:
        "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] text-emerald-950",
      accent: "bg-[#446533]",
      summary:
        "Move from assessment into guided development with role-based mentoring, preparation conversations, and stretch assignments.",
      steps: [
        "Assign mentor",
        "Select track",
        "Preparation worksheet",
        "Departmental project",
        "Cross-departmental project",
      ],
    },
  ];

  const narrativePoints = [
    "It protects culture by making leadership expectations explicit instead of leaving them trapped in the heads of a few long-tenured people.",
    "It protects institutional knowledge by moving emerging leaders through deliberate coaching, role-specific reflection, and practical stretch work before a transition happens.",
    "It raises the next generation of leaders by turning succession into a visible development pipeline rather than a last-minute replacement exercise.",
  ];

  const outcomes = [
    "Shared language for what great leadership looks like in each role",
    "Clearer evidence about who is ready now and who needs development",
    "Mentoring work tied directly to real hospital leadership demands",
    "A stronger internal bench that keeps knowledge in the organization",
  ];

  const isConfigured = hasSupabaseEnv();
  const user = await getCurrentUser();

  return (
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#fef3c7_0%,#f7fbfa_40%,#edf4f2_100%)]">
      <div className="absolute inset-x-0 top-0 h-80 bg-[linear-gradient(120deg,rgba(65,105,225,0.22),rgba(96,165,250,0.14),transparent)] blur-3xl" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.35fr_0.9fr] md:p-12">
          <div className="space-y-6">
            <p className="w-fit rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-sm font-semibold tracking-[0.16em] text-teal-800 uppercase">
              About The System
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
                A development process built to raise the next generation of leaders.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Leadership Continuity helps a hospital define what leadership
                success looks like, identify internal talent against that
                standard, and move promising people into structured mentoring
                that grows readiness while preserving culture and institutional
                knowledge.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
              <span className="rounded-full bg-amber-100 px-4 py-2">
                Roles First
              </span>
              <span className="rounded-full bg-teal-100 px-4 py-2">
                Candidate Evidence
              </span>
              <span className="rounded-full bg-sky-100 px-4 py-2">
                Mentoring Development
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={user ? "/dashboard" : "/auth"}
                className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                {user ? "Open Dashboard" : "Sign In"}
              </Link>
              <Link
                href="/roles"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Start With Roles
              </Link>
              <span className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                {isConfigured ? "Supabase env detected" : "Supabase env pending"}
              </span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.35)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-amber-300 uppercase">
              Why It Matters
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              {narrativePoints.map((point) => (
                <li
                  key={point}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-10">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Three-Step Flow
          </p>
          <h2 className="mt-3 font-display text-4xl text-slate-900">
            Roles lead to candidates, and candidates lead to mentoring
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            The system is designed as a sequence. We first define the role,
            then evaluate people against that role, then guide development
            through mentoring that is anchored in real leadership demands.
          </p>

          <div className="mt-8 grid gap-6">
            {processStages.map((stage, index) => (
              <div key={stage.name} className="grid gap-4">
                <article
                  className={`rounded-[1.75rem] border p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] ${stage.tone}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase">
                      {stage.badge}
                    </span>
                    <h3 className="font-display text-3xl">{stage.name}</h3>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm leading-7 opacity-90">
                    {stage.summary}
                  </p>

                  <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                    {stage.steps.map((step, stepIndex) => (
                      <div
                        key={step}
                        className="flex items-center gap-3"
                      >
                        <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                          {step}
                        </div>
                        {stepIndex < stage.steps.length - 1 ? (
                          <span className="hidden text-lg font-semibold opacity-70 lg:inline">
                            →
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>

                {index < processStages.length - 1 ? (
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <div className={`h-10 w-1 rounded-full ${stage.accent}`} />
                      <span className="text-xs font-semibold tracking-[0.14em] uppercase">
                        Feeds The Next Stage
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              The Development Narrative
            </p>
            <div className="mt-6 space-y-5 text-sm leading-8 text-slate-600">
              <p>
                This process starts by clarifying leadership expectations before
                a vacancy creates pressure. That alone strengthens the
                organization, because people stop guessing what success looks
                like in important roles.
              </p>
              <p>
                From there, the candidate workflow creates a more thoughtful
                picture of internal talent. Instead of choosing future leaders
                based on familiarity or urgency, the hospital can compare
                evidence, strengths, readiness, and developmental gaps in a
                consistent way.
              </p>
              <p>
                The mentoring stage turns that insight into action. Emerging
                leaders are developed in context, with real assignments, mentor
                conversations, and exposure to cross-functional leadership work.
                That is how culture, judgment, and practical know-how stay in
                the organization instead of walking out the door.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              What This Builds
            </p>
            <div className="mt-6 grid gap-3 text-sm leading-7 text-[#24512f]">
              {outcomes.map((outcome) => (
                <article
                  key={outcome}
                  className="rounded-2xl border border-[rgba(82,140,94,0.18)] bg-white/75 px-4 py-4"
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
