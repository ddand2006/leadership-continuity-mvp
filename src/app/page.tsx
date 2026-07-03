import type { CSSProperties } from "react";
import Link from "next/link";

const cycleSteps = [
  {
    number: "1",
    title: "Identify Key Competencies",
    description:
      "The organization identifies the characteristics and competencies required for each role to create a clear standard for development and readiness.",
    accent: "#133b78",
    surface: "from-slate-50 via-white to-sky-50",
    border: "border-sky-200/80",
    desktopPosition: {
      left: "50%",
      top: "14%",
    },
    hoverShift: {
      x: "0px",
      y: "-18px",
    },
  },
  {
    number: "2",
    title: "Assign a Mentor",
    description:
      "Each individual is paired with a mentor who helps guide the process, shape priorities, and support growth through meaningful experience.",
    accent: "#4f7c3c",
    surface: "from-emerald-50 via-white to-lime-50",
    border: "border-emerald-200/80",
    desktopPosition: {
      left: "79%",
      top: "41%",
    },
    hoverShift: {
      x: "18px",
      y: "-6px",
    },
  },
  {
    number: "3",
    title: "Execute & Learn",
    description:
      "The individual applies new learning through meaningful work, gaining confidence, experience, and support from the mentor along the way.",
    accent: "#1582a0",
    surface: "from-cyan-50 via-white to-sky-50",
    border: "border-cyan-200/80",
    desktopPosition: {
      left: "72%",
      top: "79%",
    },
    hoverShift: {
      x: "16px",
      y: "14px",
    },
  },
  {
    number: "4",
    title: "Reflect & Reinforce",
    description:
      "The mentor and individual review progress, discuss lessons learned, reinforce growth, and identify the next development priority.",
    accent: "#6450aa",
    surface: "from-violet-50 via-white to-purple-50",
    border: "border-violet-200/80",
    desktopPosition: {
      left: "28%",
      top: "79%",
    },
    hoverShift: {
      x: "-16px",
      y: "14px",
    },
  },
  {
    number: "5",
    title: "Apply & Advance",
    description:
      "The individual applies stronger skills in the role and prepares for greater responsibility as the cycle continues.",
    accent: "#d48812",
    surface: "from-amber-50 via-white to-orange-50",
    border: "border-amber-200/80",
    desktopPosition: {
      left: "21%",
      top: "41%",
    },
    hoverShift: {
      x: "-18px",
      y: "-6px",
    },
  },
] as const;

const principles = [
  {
    title: "Identify Potential",
    description:
      "Recognize individuals who demonstrate the capacity and desire to grow into future leadership roles.",
  },
  {
    title: "Develop Intentionally",
    description:
      "Create personalized development plans based on the competencies required for future success.",
  },
  {
    title: "Learn Through Experience",
    description:
      "Assign meaningful projects and increasing responsibility that build confidence and capability.",
  },
  {
    title: "Mentor With Purpose",
    description:
      "Transfer knowledge, judgment, and organizational wisdom through structured mentoring relationships.",
  },
  {
    title: "Measure Readiness",
    description:
      "Use assessments, observations, and demonstrated performance to evaluate leadership growth objectively.",
  },
  {
    title: "Sustain the Pipeline",
    description:
      "Leadership continuity is never complete. Every developed leader becomes responsible for helping develop the next generation.",
  },
] as const;

const outcomes = [
  "Stronger leaders at every level",
  "Greater employee engagement and retention",
  "Increased leadership readiness",
  "Preservation of institutional knowledge",
  "Stronger organizational culture",
  "A sustainable pipeline of future leaders",
] as const;

const narrativeSections = [
  {
    eyebrow: "Purpose",
    title:
      "Your next generation of leaders is probably already working in your organization.",
    body:
      "Every organization has people who believe in its mission, understand its culture, and are committed to its success. They know how the organization operates, they understand its values, and they have already demonstrated a willingness to invest their time, energy, and talent in helping it grow.\n\nThe question is not whether future leaders exist within your organization. The question is whether you are intentionally preparing them for greater responsibility.\n\nIf every critical leadership vacancy begins with an external search, it may be worth asking whether enough has been invested in developing the people who have already chosen to invest in your organization.\n\nThe Leadership Continuity System provides a structured process for identifying, developing, and preparing future leaders through assessments, individualized development plans, meaningful leadership experiences, mentoring, and measurable progress. Instead of hoping leadership emerges when it is needed, organizations create a repeatable system for building leadership from within.",
  },
  {
    eyebrow: "Philosophy",
    title: "Leadership is not discovered. It is developed.",
    body:
      "Great leaders are rarely created overnight. They are developed through intentional experiences, constructive feedback, meaningful challenges, and opportunities to grow.\n\nMentoring is an important part of that journey, but it is only one component.\n\nThe Leadership Continuity System combines leadership assessments, role-specific competencies, personalized development plans, mentoring relationships, real organizational projects, coaching, and measurable milestones. Every step is designed to help individuals develop the knowledge, judgment, confidence, and leadership behaviors needed to succeed in future roles.\n\nDevelopment becomes intentional instead of informal, measurable instead of subjective, and aligned with the long-term needs of the organization.",
  },
  {
    eyebrow: "Impact",
    title: "Develop people. Preserve culture. Strengthen the future.",
    body:
      "Organizations that intentionally develop leaders from within create more than a succession plan.\n\nThey retain institutional knowledge, strengthen organizational culture, improve employee engagement, increase retention, reduce the cost and disruption of leadership turnover, and build a dependable pipeline of capable leaders who are prepared when opportunities arise.\n\nLeadership continuity is not about replacing people.\n\nIt is about continuously developing people so the organization, its culture, and its future become stronger with every generation of leaders.",
  },
] as const;

function NarrativeAccordionItem(props: {
  eyebrow: string;
  title: string;
  body: string;
  groupName: string;
}) {
  const [leadParagraph, ...remainingParagraphs] = props.body.split("\n\n");
  const remainingBody = remainingParagraphs.join("\n\n");

  return (
    <details className="group rounded-[1.5rem] border border-slate-200/80 bg-white/80" name={props.groupName}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {props.eyebrow}
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
            {props.title}
          </h3>
          <p className="mt-4 text-sm leading-8 text-slate-600">{leadParagraph}</p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
          Expand
        </span>
      </summary>
      {remainingBody ? (
        <div className="border-t border-slate-200/80 px-5 py-5">
          <p className="whitespace-pre-line text-sm leading-8 text-slate-600">
            {remainingBody}
          </p>
        </div>
      ) : null}
    </details>
  );
}

function PrincipleAccordionItem(props: {
  index: number;
  title: string;
  description: string;
  groupName: string;
}) {
  return (
    <details
      className="group rounded-[1.35rem] border border-slate-200/80 bg-white/80"
      name={props.groupName}
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 px-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a254e] text-sm font-semibold text-white">
          {props.index}
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900 sm:text-lg">
            {props.title}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
          Expand
        </span>
      </summary>
      <div className="border-t border-slate-200/80 px-4 py-4">
        <p className="text-sm leading-7 text-slate-600">{props.description}</p>
      </div>
    </details>
  );
}

function CycleStepCard(props: {
  number: string;
  title: string;
  description: string;
  accent: string;
  surface: string;
  border: string;
  desktopPosition?: CSSProperties;
  hoverShift?: {
    x: string;
    y: string;
  };
}) {
  return (
    <article
      tabIndex={0}
      className={`cycle-step-card group relative rounded-[1.75rem] border ${props.border} bg-gradient-to-br ${props.surface} p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition duration-300 ease-out hover:z-30 hover:shadow-[0_28px_70px_rgba(15,23,42,0.16)] focus:z-30 focus:shadow-[0_28px_70px_rgba(15,23,42,0.16)] focus:outline-none lg:absolute lg:z-10 lg:h-[13.75rem] lg:w-[20rem]`}
      style={{
        ...props.desktopPosition,
        ["--cycle-hover-x" as string]: props.hoverShift?.x ?? "0px",
        ["--cycle-hover-y" as string]: props.hoverShift?.y ?? "0px",
      }}
    >
      <div
        className="absolute -top-5 left-5 flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
        style={{ backgroundColor: props.accent }}
      >
        {props.number}
      </div>
      <div className="mt-6 flex h-full flex-col">
        <h3
          className="min-h-[2.75rem] text-xl leading-tight font-semibold tracking-[-0.03em]"
          style={{ color: props.accent }}
        >
          {props.title}
        </h3>
        <p
          className="mt-0.5 text-sm leading-7 text-slate-700"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 4,
            overflow: "hidden",
          }}
        >
          {props.description}
        </p>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#f6f3ea_0%,#eff6f5_46%,#e7eef2_100%)] text-slate-950">
      <div className="relative mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <section className="theme-panel-strong overflow-hidden rounded-[2rem]">
          <div className="bg-[linear-gradient(135deg,#08244a,#123d76)] px-6 py-5 text-white sm:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/85 bg-white/8 text-3xl font-semibold">
                  1
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                    Leadership Continuity System
                  </p>
                  <h1 className="mt-1 text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl lg:text-[3.1rem]">
                    The Leadership Continuity Cycle
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth?mode=signup"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold !text-[#123d76] transition hover:bg-sky-50"
                  style={{ WebkitTextFillColor: "#123d76" }}
                >
                  Create an Account
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
                >
                  Read About
                </Link>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="mx-auto max-w-5xl text-center text-lg leading-8 text-[#123d76] sm:text-[1.35rem]">
              &ldquo;The strongest organizations aren&apos;t built by hiring great leaders. They&apos;re built by continuously developing the leaders they already have.&rdquo;
            </p>

            <div className="mt-8 rounded-[2rem] border border-slate-200/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-6 lg:p-8">
              <div className="grid gap-5 lg:hidden">
                {cycleSteps.map((step) => (
                  <CycleStepCard key={step.number} {...step} />
                ))}
              </div>

              <div className="relative hidden min-h-[50rem] lg:block">
                <div className="absolute left-1/2 top-1/2 z-0 h-[37rem] w-[37rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[8px] border-[#08244a]" />

                {cycleSteps.map((step) => (
                  <CycleStepCard key={step.number} {...step} />
                ))}

                <div className="absolute left-1/2 top-1/2 z-10 flex h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[10px] border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef3f9_100%)] px-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0a254e] text-2xl font-semibold text-white">
                    LC
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[#123d76]">
                    Mentor & Mentee
                  </h2>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    Open. Honest. Collaborative.
                    <br />
                    Committed to growth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="theme-panel rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Why Leadership Continuity Matters
            </p>
            <div className="mt-5 space-y-4">
              {narrativeSections.map((section) => (
                <NarrativeAccordionItem
                  key={section.eyebrow}
                  eyebrow={section.eyebrow}
                  title={section.title}
                  body={section.body}
                  groupName="leadership-continuity-narrative"
                />
              ))}
            </div>
          </div>

          <aside className="grid gap-6">
            <div className="theme-panel rounded-[2rem] p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                The Six Principles of Leadership Continuity
              </p>
              <div className="mt-5 grid gap-3">
                {principles.map((principle, index) => (
                  <PrincipleAccordionItem
                    key={principle.title}
                    index={index + 1}
                    title={principle.title}
                    description={principle.description}
                    groupName="leadership-continuity-principles"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-[linear-gradient(135deg,#08244a,#123d76)] p-6 text-white shadow-[0_28px_70px_rgba(2,6,23,0.22)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                Organizational Impact
              </p>
              <p className="mt-3 text-sm leading-7 text-sky-50">
                Leadership development that strengthens the entire organization.
              </p>
              <div className="mt-5 grid gap-3">
                {outcomes.map((outcome) => (
                  <div
                    key={outcome}
                    className="rounded-[1.35rem] border border-white/10 bg-white/8 px-4 py-4 text-sm leading-7 text-sky-50"
                  >
                    {outcome}
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-2xl font-semibold tracking-[-0.03em]">
                  Every leader develops the next.
                </p>
                <p className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.03em] text-sky-50">
                  Every generation strengthens the organization.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
