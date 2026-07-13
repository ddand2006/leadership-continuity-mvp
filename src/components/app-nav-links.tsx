"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  matchPath?: string;
};

type ResourceNavItem = {
  href: string;
  label: string;
  matchPath: string;
  matchSection?: string;
};

function isActiveNavItem(pathname: string, item: NavItem) {
  const matchPath = item.matchPath ?? item.href;

  if (matchPath === "/") {
    return pathname === "/";
  }

  return pathname === matchPath || pathname.startsWith(`${matchPath}/`);
}

export function AppNavLinks({
  initialPathname,
  navItems,
  resourceNavItems,
  showResources,
}: {
  initialPathname: string;
  navItems: NavItem[];
  resourceNavItems: ResourceNavItem[];
  showResources: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? initialPathname;
  const currentSection = searchParams.get("section");
  const resourcesIsActive = resourceNavItems.some((item) => {
    if (currentPath !== item.matchPath) {
      return false;
    }

    if (!item.matchSection) {
      return true;
    }

    return currentSection === item.matchSection;
  });

  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {navItems.map((item) => {
        const isActive = isActiveNavItem(currentPath, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                : "border-slate-200/80 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {showResources ? (
        <details className="group relative">
          <summary
            className={`flex cursor-pointer list-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              resourcesIsActive
                ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                : "border-slate-200/80 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-900"
            }`}
          >
            <span>Resources</span>
            <span
              aria-hidden="true"
              className={`transition group-open:rotate-180 ${
                resourcesIsActive ? "text-white/80" : "text-slate-400"
              }`}
            >
              ▾
            </span>
          </summary>

          <div className="absolute left-0 top-[calc(100%+0.75rem)] z-20 hidden min-w-72 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur group-open:block">
            <div className="grid gap-2 p-3">
              {resourceNavItems.map((item) => {
                const isActive =
                  currentPath === item.matchPath &&
                  (item.matchSection
                    ? currentSection === item.matchSection
                    : true);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "interactive-contrast bg-teal-900 text-white"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}
    </nav>
  );
}
