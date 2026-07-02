import Link from "next/link";

const navItems = [
  { href: "/", label: "About" },
  { href: "/roles", label: "Roles" },
  { href: "/candidates", label: "Candidates" },
  { href: "/mentoring", label: "Mentoring" },
  { href: "/dashboard", label: "Dashboard" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ pathname }: { pathname: string }) {
  return (
    <header className="relative z-10 px-5 pt-4 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">
        <div className="theme-panel-strong rounded-[2rem] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-950 font-display text-lg text-teal-50">
                LC
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                  Leadership Continuity
                </p>
                <p className="text-sm text-slate-600">
                  Hospital succession planning MVP
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/auth"
                className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Sign In
              </Link>
              <Link
                href="/auth/logout"
                className="rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Log Out
              </Link>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "interactive-contrast border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                      : "border-slate-200/80 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
