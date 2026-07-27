"use client";

import { useState } from "react";
import Link from "next/link";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";

type AccountMenuProps = {
  initials: string;
  displayName: string;
  email: string | null;
  accountLandingHref: string;
  accountLandingLabel: string;
};

export function AccountMenu({
  initials,
  displayName,
  email,
  accountLandingHref,
  accountLandingLabel,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useDismissibleLayer<HTMLDivElement>(isOpen, () => setIsOpen(false));

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 px-2 py-2 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:border-teal-200 hover:text-teal-900"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-xs font-bold tracking-[0.16em] text-white">
          {initials}
        </span>
        <span className="hidden max-w-40 truncate sm:block">{displayName}</span>
        <span
          aria-hidden="true"
          className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-72 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="border-b border-slate-200/80 px-5 py-4">
            <p className="text-sm font-semibold text-slate-950">{displayName}</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              {email ?? "Signed in"}
            </p>
          </div>

          <div className="grid gap-2 p-3">
            <Link
              href={accountLandingHref}
              onClick={() => setIsOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              {accountLandingLabel}
            </Link>
            <Link
              href="/auth/logout"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            >
              Sign Out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
