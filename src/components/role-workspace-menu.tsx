import Link from "next/link";

type RoleWorkspaceSection = {
  id: string;
  label: string;
  href: string;
};

export function RoleWorkspaceMenu({
  sections,
  activeSectionId,
}: {
  sections: RoleWorkspaceSection[];
  activeSectionId: string;
}) {
  return (
    <nav
      className="flex flex-wrap gap-3 border-b border-slate-200 pb-5"
      aria-label="Role workspace sections"
    >
      {sections.map((section) => {
        const isActive = section.id === activeSectionId;

        return (
          <Link
            key={section.id}
            href={section.href}
            prefetch={true}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              isActive
                ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
