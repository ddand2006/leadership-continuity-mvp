import Link from "next/link";

const navItems = [
  { href: "/", label: "About" },
  { href: "/roles", label: "Roles" },
  { href: "/candidates", label: "Candidates" },
  { href: "/mentoring", label: "Mentoring" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 sm:px-10 lg:px-12">
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
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Log Out
            </Link>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
