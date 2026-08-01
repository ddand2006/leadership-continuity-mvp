"use client";

import { useState } from "react";
import {
  getTrainingProgramMatches,
  normalizeTrainingCompetencyName,
  type TemporaryTrainingProgram,
  type TrainingMatchStrength,
} from "@/lib/outside-training-programs";

type TrainingRole = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  competencies: Array<{
    id: string;
    name: string;
    definition: string | null;
    weight: number;
  }>;
};

const strengthLabel: Record<TrainingMatchStrength, string> = {
  strong: "Strong match",
  moderate: "Moderate match",
  supporting: "Supporting match",
};

function orderedCompetencies(role: TrainingRole | null) {
  return [...(role?.competencies ?? [])].sort(
    (left, right) => right.weight - left.weight,
  );
}

export function OutsideTrainingFinder({
  roles,
  programs,
}: {
  roles: TrainingRole[];
  programs: TemporaryTrainingProgram[];
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const [selectedCompetencyId, setSelectedCompetencyId] = useState(
    orderedCompetencies(roles[0] ?? null)[0]?.id ?? "",
  );
  const [roleSearch, setRoleSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;
  const selectedCompetencies = orderedCompetencies(selectedRole);
  const selectedCompetency =
    selectedCompetencies.find((competency) => competency.id === selectedCompetencyId) ??
    selectedCompetencies[0] ??
    null;
  const departments = Array.from(
    new Set(roles.map((role) => role.department).filter(Boolean) as string[]),
  ).sort();
  const visibleRoles = roles.filter((role) => {
    const searchMatches = `${role.title} ${role.department ?? ""}`
      .toLowerCase()
      .includes(roleSearch.trim().toLowerCase());
    const departmentMatches =
      departmentFilter === "all" || role.department === departmentFilter;

    return searchMatches && departmentMatches;
  });
  const programMatches = selectedCompetency
    ? getTrainingProgramMatches(selectedCompetency.name, programs)
    : [];
  const selectedCompetencyName = selectedCompetency
    ? normalizeTrainingCompetencyName(selectedCompetency.name)
    : "";
  const relatedRoles = selectedCompetency
    ? roles
        .filter((role) => role.id !== selectedRole?.id)
        .flatMap((role) => {
          const competency = orderedCompetencies(role).find(
            (item) => normalizeTrainingCompetencyName(item.name) === selectedCompetencyName,
          );

          return competency ? [{ role, competency }] : [];
        })
    : [];

  function selectRole(role: TrainingRole) {
    const nextCompetencies = orderedCompetencies(role);
    setSelectedRoleId(role.id);
    setSelectedCompetencyId(nextCompetencies[0]?.id ?? "");
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1fr_1.28fr] xl:items-start">
      <section className="theme-panel h-fit rounded-[1.75rem] p-5 xl:sticky xl:top-8">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          1. Select role
        </p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">Organizational roles</h2>
        <input
          className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500"
          type="search"
          value={roleSearch}
          onChange={(event) => setRoleSearch(event.currentTarget.value)}
          placeholder="Search roles"
        />
        {departments.length > 1 ? (
          <select
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.currentTarget.value)}
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        ) : null}
        <div className="mt-5 grid max-h-[32rem] gap-2 overflow-y-auto pr-1">
          {visibleRoles.map((role) => {
            const isSelected = role.id === selectedRole?.id;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_14px_30px_rgba(15,118,110,0.18)]"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold">{role.title}</span>
                <span className={`mt-1 block text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                  {role.department ?? "No department"} · {role.competencies.length}{" "}
                  {role.competencies.length === 1 ? "priority" : "priorities"}
                </span>
              </button>
            );
          })}
          {visibleRoles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              {roles.length === 0
                ? "No roles are available yet. Add organizational roles and assign leadership competencies before using the training finder."
                : "No roles match this search."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          2. Select priority
        </p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">
          {selectedRole?.title ?? "Leadership priorities"}
        </h2>
        {selectedRole?.department ? (
          <p className="mt-2 text-sm font-medium text-teal-800">{selectedRole.department}</p>
        ) : null}
        {selectedRole?.description ? (
          <p className="mt-4 text-sm leading-7 text-slate-600">{selectedRole.description}</p>
        ) : null}
        <div className="mt-6 grid gap-3">
          {selectedCompetencies.map((competency, index) => {
            const isSelected = competency.id === selectedCompetency?.id;
            const matchCount = getTrainingProgramMatches(competency.name, programs).length;

            return (
              <button
                key={competency.id}
                type="button"
                onClick={() => setSelectedCompetencyId(competency.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-teal-800 bg-teal-50 shadow-[0_12px_30px_rgba(15,118,110,0.1)]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-slate-900">{competency.name}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    #{index + 1}
                  </span>
                </div>
                {competency.definition ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{competency.definition}</p>
                ) : null}
                <p className="mt-3 text-xs font-semibold tracking-[0.08em] text-teal-800 uppercase">
                  {matchCount} matching program{matchCount === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
          {selectedRole && selectedCompetencies.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              No leadership priorities have been assigned to this role. Complete the
              role composite or assign competencies to generate recommendations.
            </p>
          ) : null}
          {!selectedRole ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              Select a role to review its leadership priorities.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-6 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
          3. Review programs
        </p>
        <h2 className="mt-2 font-display text-3xl text-[#183822]">
          {selectedCompetency ? `Training for ${selectedCompetency.name}` : "Recommended training"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#24512f]">
          Preliminary research for discussion — not a formal endorsement or a saved
          training selection.
        </p>

        <div className="mt-6 grid gap-4">
          {programMatches.map(({ program, match }) => (
            <article
              key={program.id}
              className="rounded-3xl border border-[rgba(82,140,94,0.18)] bg-white/80 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-[#183822]">{program.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#24512f]">{program.provider}</p>
                </div>
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">
                  {strengthLabel[match.strength]}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#24512f]">{program.description}</p>
              <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
                <span className="font-semibold">Why it may fit: </span>{match.explanation}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold text-[#183822]">Format</dt><dd className="mt-1 text-[#24512f]">{program.deliveryFormat}</dd></div>
                <div><dt className="font-semibold text-[#183822]">Typical duration</dt><dd className="mt-1 text-[#24512f]">{program.typicalDuration}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-[#183822]">Audience</dt><dd className="mt-1 text-[#24512f]">{program.intendedAudience}</dd></div>
              </dl>
              <a
                href={program.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex text-sm font-semibold text-teal-800 transition hover:text-teal-950"
              >
                View program
              </a>
            </article>
          ))}
          {selectedCompetency && programMatches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[rgba(82,140,94,0.3)] bg-white/70 px-4 py-4 text-sm leading-7 text-[#24512f]">
              No preliminary programs are mapped to this leadership priority yet.
              It can be marked for research when the managed training catalog is added.
            </p>
          ) : null}
        </div>

        {selectedCompetency ? (
          <section className="mt-6 border-t border-[rgba(82,140,94,0.2)] pt-6">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
              Shared development opportunity
            </p>
            <p className="mt-3 text-sm leading-7 text-[#24512f]">
              {selectedCompetency.name} is a priority for {relatedRoles.length + 1} role
              {relatedRoles.length === 0 ? "" : "s"}. A shared cohort may be more
              efficient than separate training purchases.
            </p>
            <h3 className="mt-5 text-lg font-semibold text-[#183822]">Other roles that may benefit</h3>
            <div className="mt-3 grid gap-2">
              {relatedRoles.map(({ role, competency }) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className="rounded-2xl border border-[rgba(82,140,94,0.18)] bg-white/70 px-4 py-3 text-left transition hover:bg-white"
                >
                  <span className="block text-sm font-semibold text-[#183822]">{role.title}</span>
                  <span className="mt-1 block text-xs text-[#24512f]">
                    {role.department ?? "No department"} · Priority #{orderedCompetencies(role).findIndex((item) => item.id === competency.id) + 1}
                  </span>
                </button>
              ))}
              {relatedRoles.length === 0 ? (
                <p className="text-sm leading-6 text-[#24512f]">
                  No other active roles currently share this exact competency.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}
