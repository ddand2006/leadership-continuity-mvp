"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type RoleOption = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  status: string;
};

export function PersonalRoleProfileForm({
  roles,
  initialRoleMode,
  initialSourceRoleId,
  initialTitle,
  initialDepartment,
  initialDescription,
  initialCurrentPositionTitle,
  initialYearsInRole,
  initialLeadershipHistory,
  initialOrganizationalContext,
}: {
  roles: RoleOption[];
  initialRoleMode: "organization_role" | "personal_role";
  initialSourceRoleId: string | null;
  initialTitle: string;
  initialDepartment: string;
  initialDescription: string;
  initialCurrentPositionTitle: string;
  initialYearsInRole: string;
  initialLeadershipHistory: string;
  initialOrganizationalContext: string;
}) {
  const router = useRouter();
  const [roleMode, setRoleMode] = useState(initialRoleMode);
  const [sourceRoleId, setSourceRoleId] = useState(initialSourceRoleId ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [department, setDepartment] = useState(initialDepartment);
  const [description, setDescription] = useState(initialDescription);
  const [currentPositionTitle, setCurrentPositionTitle] = useState(
    initialCurrentPositionTitle,
  );
  const [yearsInRole, setYearsInRole] = useState(initialYearsInRole);
  const [leadershipHistory, setLeadershipHistory] = useState(
    initialLeadershipHistory,
  );
  const [organizationalContext, setOrganizationalContext] = useState(
    initialOrganizationalContext,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedOrganizationRole = useMemo(
    () => roles.find((role) => role.id === sourceRoleId) ?? null,
    [roles, sourceRoleId],
  );

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/personal-development/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPositionTitle,
          yearsInRole:
            yearsInRole.trim().length > 0 ? Number.parseFloat(yearsInRole) : null,
          leadershipHistory,
          organizationalContext,
          roleMode,
          sourceRoleId:
            roleMode === "organization_role" && sourceRoleId
              ? sourceRoleId
              : undefined,
          title,
          department,
          description,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save your role profile.");
        return;
      }

      setSuccess(payload.message ?? "Role profile saved.");
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          My Role
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Define the role you want to develop in
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          Start by connecting to an organizational role or creating a personal role
          profile. This becomes the anchor for your leadership composite, strengths
          interpretation, 360 assessment, and coaching guidance.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Current position title
            </span>
            <input
              value={currentPositionTitle}
              onChange={(event) => setCurrentPositionTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              type="text"
              placeholder="VP - Patient Care Services"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Years in role
            </span>
            <input
              value={yearsInRole}
              onChange={(event) => setYearsInRole(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              type="number"
              min="0"
              step="0.5"
              placeholder="2.5"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800">
            <input
              checked={roleMode === "organization_role"}
              onChange={() => setRoleMode("organization_role")}
              type="radio"
              name="role_mode"
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Connect to an existing organizational role
              </span>
              <span className="mt-1 block leading-6 text-slate-600">
                Reuse a role your organization has already defined so your personal
                development aligns with the same standards used in Leadership
                Continuity.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800">
            <input
              checked={roleMode === "personal_role"}
              onChange={() => setRoleMode("personal_role")}
              type="radio"
              name="role_mode"
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Create a personal role profile
              </span>
              <span className="mt-1 block leading-6 text-slate-600">
                Define your own role if it does not exist yet in the organization
                workspace or if you want a private development context first.
              </span>
            </span>
          </label>
        </div>

        {roleMode === "organization_role" ? (
          <div className="mt-6 grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Organizational role
              </span>
              <select
                value={sourceRoleId}
                onChange={(event) => setSourceRoleId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedOrganizationRole ? (
              <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {selectedOrganizationRole.title}
                </p>
                <p className="mt-2 text-slate-600">
                  {selectedOrganizationRole.department || "No department entered"}
                </p>
                <p className="mt-3 leading-7 text-slate-600">
                  {selectedOrganizationRole.description ||
                    "No role description entered yet."}
                </p>
              </article>
            ) : (
              <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                Choose one role from the organization workspace to anchor your
                personal development profile.
              </article>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Personal role title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="text"
                  placeholder="Chief Nursing Officer"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Department
                </span>
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="text"
                  placeholder="Nursing Administration"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Role description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-40 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                placeholder="Describe the role, the leadership expectations, and what success looks like."
              />
            </label>
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Leadership history
            </span>
            <textarea
              value={leadershipHistory}
              onChange={(event) => setLeadershipHistory(event.target.value)}
              className="min-h-32 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              placeholder="Summarize the leadership roles, transitions, and experiences that shape how you lead today."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Organizational context
            </span>
            <textarea
              value={organizationalContext}
              onChange={(event) => setOrganizationalContext(event.target.value)}
              className="min-h-32 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
              placeholder="Describe team size, current pressures, strategic priorities, and realities that affect this role."
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Saving role profile..." : "Save Role Profile"}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-teal-700">{success}</p> : null}
      </div>
    </section>
  );
}
