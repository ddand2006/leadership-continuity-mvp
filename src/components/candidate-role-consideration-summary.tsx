"use client";

import Link from "next/link";
import { useState } from "react";

type RoleConsideration = {
  roleId: string;
  roleTitle: string;
  statusLabel: string;
  isPrimary: boolean;
  mentorNames: string[];
};

export function CandidateRoleConsiderationSummary({
  candidateId,
  considerations,
  initialExpandedRoleId,
}: {
  candidateId: string;
  considerations: RoleConsideration[];
  initialExpandedRoleId: string | null;
}) {
  const [expandedRoleId, setExpandedRoleId] = useState(
    initialExpandedRoleId && considerations.some((item) => item.roleId === initialExpandedRoleId)
      ? initialExpandedRoleId
      : null,
  );

  if (considerations.length === 0) {
    return (
      <article className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
        No role considerations are attached to this candidate yet.
      </article>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {considerations.map((consideration) => {
        const isExpanded = expandedRoleId === consideration.roleId;

        return (
          <div key={consideration.roleId} className="min-w-0">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedRoleId((current) =>
                  current === consideration.roleId ? null : consideration.roleId,
                )
              }
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                isExpanded
                  ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_14px_30px_rgba(15,118,110,0.16)]"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:border-teal-300 hover:bg-teal-50"
              }`}
            >
              {consideration.roleTitle}
            </button>

            {isExpanded ? (
              <article className="mt-3 max-w-md rounded-3xl border border-teal-200 bg-teal-50 p-5 text-sm shadow-[0_16px_36px_rgba(15,118,110,0.08)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{consideration.roleTitle}</p>
                  {consideration.isPrimary ? (
                    <span className="rounded-full bg-teal-200 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-teal-950 uppercase">
                      Primary
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-slate-700">Status: {consideration.statusLabel}</p>
                <p className="mt-2 text-slate-700">
                  Mentors: {consideration.mentorNames.length > 0
                    ? consideration.mentorNames.join(", ")
                    : "Not assigned"}
                </p>
                <Link
                  href={`/candidates/${candidateId}?roleId=${consideration.roleId}`}
                  className="mt-4 inline-flex rounded-full border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900 transition hover:border-teal-500 hover:bg-teal-100"
                >
                  Open role track
                </Link>
              </article>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
