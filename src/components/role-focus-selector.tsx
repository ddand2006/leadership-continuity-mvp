"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RoleFocusSelectorProps = {
  roles: {
    id: string;
    title: string;
  }[];
  selectedRoleId: string | null;
  selectedMode: "flow" | "create" | "import" | "composite" | "view" | "resources";
};

export function RoleFocusSelector({
  roles,
  selectedRoleId,
  selectedMode,
}: RoleFocusSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateRoute(
    nextMode: "flow" | "create" | "import" | "composite" | "view" | "resources",
    nextRoleId?: string | null,
  ) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("mode", nextMode);

    if (nextRoleId) {
      nextParams.set("roleId", nextRoleId);
    } else {
      nextParams.delete("roleId");
    }

    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  return (
    <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] lg:sticky lg:top-8">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Role Workflow
          </p>
          <h2 className="mt-2 font-display text-2xl leading-tight text-slate-900">
            Choose what you want to do
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Pick one workflow at a time, then use the panel on the right to work
            through that role task.
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => updateRoute("flow", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "flow"
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Roles Flow
          </button>
          <button
            type="button"
            onClick={() => updateRoute("create", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "create"
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Create a Role
          </button>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Focus role
          </span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            value={selectedRoleId ?? ""}
            onChange={(event) => {
              const nextRoleId = event.currentTarget.value;
              updateRoute(selectedMode, nextRoleId || null);
            }}
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => updateRoute("import", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "import"
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Competencies
          </button>
          <button
            type="button"
            onClick={() => updateRoute("composite", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "composite"
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Role Composite
          </button>
          <button
            type="button"
            onClick={() => updateRoute("view", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "view"
                ? "border-teal-800 bg-teal-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            View a Role
          </button>
          <button
            type="button"
            onClick={() => updateRoute("resources", selectedRoleId)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              selectedMode === "resources"
                ? "border-teal-900 bg-teal-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Resources
          </button>
        </div>
      </div>
    </aside>
  );
}
