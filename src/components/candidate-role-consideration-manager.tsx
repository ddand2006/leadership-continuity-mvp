"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const ROLE_CONSIDERATION_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
] as const;

type RoleOption = {
  id: string;
  title: string;
};

type ConsiderationOption = {
  roleId: string;
  roleTitle: string;
  status: "active" | "on_hold";
  isPrimary: boolean;
  mentorNames: string[];
};

export function CandidateRoleConsiderationManager({
  candidateId,
  candidateName,
  roles,
  considerations,
}: {
  candidateId: string;
  candidateName: string;
  roles: RoleOption[];
  considerations: ConsiderationOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addRoleId, setAddRoleId] = useState("");
  const [addStatus, setAddStatus] = useState<"active" | "on_hold">("active");
  const [makePrimaryOnAdd, setMakePrimaryOnAdd] = useState(false);
  const [statusByRoleId, setStatusByRoleId] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      considerations.map((consideration) => [
        consideration.roleId,
        consideration.status,
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          !considerations.some((consideration) => consideration.roleId === role.id),
      ),
    [considerations, roles],
  );

  function handleAddRole() {
    if (!addRoleId) {
      setError("Choose a role to assign to this candidate.");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(
        `/api/candidates/${candidateId}/role-considerations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roleId: addRoleId,
            status: addStatus,
            makePrimary: makePrimaryOnAdd,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to assign this position.");
        return;
      }

      setAddRoleId("");
      setAddStatus("active");
      setMakePrimaryOnAdd(false);
      setSuccess(payload.message ?? "Position assigned.");
      router.refresh();
    });
  }

  function handleUpdateRole(roleId: string, makePrimary = false) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(
        `/api/candidates/${candidateId}/role-considerations`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roleId,
            status:
              statusByRoleId[roleId] === "on_hold" ? "on_hold" : "active",
            makePrimary,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to update this position.");
        return;
      }

      setSuccess(payload.message ?? "Position updated.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Position Management
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Assign and edit positions for {candidateName}
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        Add as many roles as needed for this candidate, then mark one as the
        primary role that drives the active candidate workflow. Existing mentors
        attached to a role are carried into the candidate&apos;s role track
        automatically.
      </p>

      <div className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1.2fr_0.8fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Add position
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            value={addRoleId}
            onChange={(event) => setAddRoleId(event.target.value)}
            disabled={isPending || availableRoles.length === 0}
          >
            <option value="">Select role</option>
            {availableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Status
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
            value={addStatus}
            onChange={(event) =>
              setAddStatus(event.target.value === "on_hold" ? "on_hold" : "active")
            }
            disabled={isPending}
          >
            {ROLE_CONSIDERATION_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={makePrimaryOnAdd}
              onChange={(event) => setMakePrimaryOnAdd(event.target.checked)}
              disabled={isPending}
            />
            <span>Make primary</span>
          </label>
          <button
            type="button"
            onClick={handleAddRole}
            disabled={isPending || availableRoles.length === 0}
            className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Saving..." : "Assign Position"}
          </button>
        </div>
      </div>

      {availableRoles.length === 0 ? (
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Every available role in this organization is already attached to this
          candidate.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4">
        {considerations.length > 0 ? (
          considerations.map((consideration) => (
            <article
              key={consideration.roleId}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold text-slate-900">
                      {consideration.roleTitle}
                    </p>
                    {consideration.isPrimary ? (
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-teal-900 uppercase">
                        Primary Role
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Mentors:{" "}
                    {consideration.mentorNames.length > 0
                      ? consideration.mentorNames.join(", ")
                      : "Not assigned yet"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[12rem_auto_auto]">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Status
                    </span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      value={statusByRoleId[consideration.roleId] ?? consideration.status}
                      onChange={(event) =>
                        setStatusByRoleId((current) => ({
                          ...current,
                          [consideration.roleId]: event.target.value,
                        }))
                      }
                      disabled={isPending}
                    >
                      {ROLE_CONSIDERATION_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleUpdateRole(consideration.roleId)}
                    disabled={isPending}
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Save Status
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateRole(consideration.roleId, true)}
                    disabled={isPending || consideration.isPrimary}
                    className="interactive-contrast rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {consideration.isPrimary ? "Primary" : "Make Primary"}
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
            This candidate does not have any positions assigned yet.
          </article>
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-teal-700">{success}</p> : null}
    </section>
  );
}
