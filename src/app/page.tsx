export default function Home() {
  const launchTracks = [
    "Separate Supabase project with its own Postgres schema and RLS policies.",
    "Standalone Next.js frontend for hospital admins, interviewers, and mentors.",
    "OpenAI-powered report generation using structured JSON instead of model training.",
  ];

  const mvpModules = [
    "Role composite builder",
    "Behavioral interview guide generation",
    "Candidate profile and full 34 CliftonStrengths entry",
    "Interview scoring and weighted fit analysis",
    "Mentor reports with project recommendations",
    "30/60/90-day development planning",
  ];

  return (
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#fef3c7_0%,#f7fbfa_40%,#edf4f2_100%)]">
      <div className="absolute inset-x-0 top-0 h-80 bg-[linear-gradient(120deg,rgba(15,118,110,0.18),rgba(245,158,11,0.12),transparent)] blur-3xl" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-12 sm:px-10 lg:px-12">
        <section className="grid gap-8 rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.35fr_0.9fr] md:p-12">
          <div className="space-y-6">
            <p className="w-fit rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-sm font-semibold tracking-[0.16em] text-teal-800 uppercase">
              Leadership Continuity System MVP
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
                A standalone hospital succession platform, separate from Jobbora.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                This workspace is now set up as its own frontend and its own
                codebase, ready for a dedicated Supabase database, OpenAI report
                generation, and a separate GitHub repository.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
              <span className="rounded-full bg-amber-100 px-4 py-2">
                Next.js App Router
              </span>
              <span className="rounded-full bg-teal-100 px-4 py-2">
                Supabase Postgres
              </span>
              <span className="rounded-full bg-sky-100 px-4 py-2">
                Structured OpenAI Outputs
              </span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.35)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-amber-300 uppercase">
              Launch Tracks
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              {launchTracks.map((track) => (
                <li
                  key={track}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  {track}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              MVP Surface Area
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {mvpModules.map((module) => (
                <article
                  key={module}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {module}
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-teal-200 bg-teal-950 p-8 text-teal-50 shadow-[0_20px_60px_rgba(13,148,136,0.18)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-200 uppercase">
              Ready Next
            </p>
            <div className="mt-6 space-y-5 text-sm leading-7 text-teal-100">
              <p>
                The repo includes environment scaffolding, Supabase client
                helpers, and an initial SQL migration for the hospital-specific
                schema.
              </p>
              <p>
                From here we can build the authenticated dashboard, CRUD flows,
                AI routes, scoring logic, and seed data from the product spec.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
