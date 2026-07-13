import Link from "next/link";

type PersonalDevelopmentSection = {
  id: string;
  label: string;
  href: string;
};

export function PersonalDevelopmentWorkspaceMenu({
  leaderName,
  detailItems,
  sections,
  activeSectionId,
}: {
  leaderName: string;
  detailItems: string[];
  sections: readonly PersonalDevelopmentSection[];
  activeSectionId: string;
}) {
  return (
    <section className="w-full rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Personal Development Workspace
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-slate-900">
            {leaderName}
          </h1>
          <ul className="mt-4 grid gap-2 text-sm leading-7 text-slate-600">
            {detailItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="-mx-2 overflow-x-auto px-2 pb-1">
          <div className="flex min-w-max flex-nowrap gap-3">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;

            return (
              <Link
                key={section.id}
                href={section.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                    : "border-slate-200/80 bg-white/85 text-slate-700 hover:bg-white"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}
