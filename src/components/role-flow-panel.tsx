"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FLOWCHART_ACTION_DISABLED_CLASS,
  FLOWCHART_ACTION_ENABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_DISABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_ENABLED_CLASS,
  FLOWCHART_SELECT_INPUT_CLASS,
  FLOWCHART_SELECT_PANEL_CLASS,
  FLOWCHART_START_BUTTON_CLASS,
} from "@/components/flowchart-theme";

type RoleFlowPanelProps = {
  roles: {
    id: string;
    title: string;
    department: string | null;
    hasCompositeDocument: boolean;
    hasCompetencies: boolean;
  }[];
  selectedRoleId: string | null;
};

type FlowAction = {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function RoleFlowPanel({
  roles,
  selectedRoleId,
}: RoleFlowPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

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

  const actions: FlowAction[] = [
    {
      title: "Input Competencies",
      description: selectedRole
        ? "Open the competencies and composites workflow for this role."
        : "Choose a role first to attach competencies.",
      onClick: selectedRole
        ? () => updateRoute("import", selectedRole.id)
        : undefined,
      disabled: !selectedRole,
    },
    {
      title: "Create and Download Composite",
      description: selectedRole
        ? selectedRole.hasCompositeDocument
          ? "Open the composite workflow to download or maintain the Word document."
          : "Open the composite workflow to generate the role composite."
        : "Choose a role first to create its composite.",
      onClick: selectedRole
        ? () => updateRoute("composite", selectedRole.id)
        : undefined,
      disabled: !selectedRole,
    },
    {
      title: "View and Download Role Narrative",
      description: selectedRole
        ? "Open the printable role view and download-ready narrative layout."
        : "Choose a role first to view its narrative.",
      href: selectedRole ? `/roles/${selectedRole.id}/print` : undefined,
      disabled: !selectedRole,
    },
    {
      title: "Interview Questions and Scorecard",
      description: selectedRole
        ? "Generate role-based interview questions and a scorecard."
        : "Choose a role first to open interview resources.",
      onClick: selectedRole
        ? () => updateRoute("resources", selectedRole.id)
        : undefined,
      disabled: !selectedRole,
    },
  ];

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Roles Flow
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Follow one clear role workflow
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        Use this flow to move from role setup into competencies, composites,
        printable role narrative, and interview tools without jumping around the
        page.
      </p>

      {roles.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          No roles exist yet. Start with <span className="font-semibold">Create Roles</span> to
          add the first role record.
        </div>
      ) : null}

      {roles.length > 0 ? (
        <div className="mt-8 overflow-x-auto">
          <div className="hidden min-w-[980px] grid-cols-[12rem_16rem_1fr] items-center gap-10 lg:grid">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => updateRoute("create", selectedRoleId)}
                className={`group relative flex h-36 w-36 items-center justify-center ${FLOWCHART_START_BUTTON_CLASS}`}
                style={{ transform: "rotate(45deg)" }}
              >
                <span
                  className="px-4 text-center text-lg font-semibold leading-6"
                  style={{ transform: "rotate(-45deg)" }}
                >
                  CREATE
                  <br />
                  ROLES
                </span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute top-1/2 left-[-2.5rem] h-[2px] w-10 -translate-y-1/2 bg-slate-900" />
              <div className={FLOWCHART_SELECT_PANEL_CLASS}>
                <p className="text-center text-lg font-semibold">Select Role</p>
                <select
                  className={FLOWCHART_SELECT_INPUT_CLASS}
                  value={selectedRoleId ?? ""}
                  onChange={(event) =>
                    updateRoute("flow", event.currentTarget.value || null)
                  }
                >
                  <option value="" className="text-slate-900">
                    Select role
                  </option>
                  {roles.map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                      className="text-slate-900"
                    >
                      {role.title}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-center text-xs leading-6 text-white/80">
                  {selectedRole
                    ? `${selectedRole.title}${selectedRole.department ? ` • ${selectedRole.department}` : ""}`
                    : "Choose one role to activate the next steps."}
                </p>
              </div>
              <div className="absolute top-1/2 left-full h-[2px] w-14 -translate-y-1/2 bg-slate-900" />
            </div>

            <div className="relative pl-14">
              <div className="absolute top-12 left-3 bottom-12 w-[2px] bg-slate-900" />
              <div className="flex flex-col gap-6">
                {actions.map((action) => (
                  <div key={action.title} className="relative">
                    <div className="absolute top-1/2 left-[-2.75rem] h-[2px] w-11 -translate-y-1/2 bg-slate-900" />
                  {action.href && !action.disabled ? (
                    <Link
                      href={action.href}
                      className={FLOWCHART_ACTION_ENABLED_CLASS}
                    >
                      <p className="text-center text-2xl font-semibold leading-tight">
                        {action.title}
                      </p>
                      <p className="mt-3 text-center text-sm leading-6 text-white/80">
                        {action.description}
                      </p>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={`w-full ${action.disabled ? FLOWCHART_ACTION_DISABLED_CLASS : FLOWCHART_ACTION_ENABLED_CLASS}`}
                    >
                      <p className="text-center text-2xl font-semibold leading-tight">
                        {action.title}
                      </p>
                      <p className="mt-3 text-center text-sm leading-6">
                        {action.description}
                      </p>
                    </button>
                  )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:hidden">
            <button
              type="button"
              onClick={() => updateRoute("create", selectedRoleId)}
              className={FLOWCHART_START_BUTTON_CLASS}
            >
              <p className="text-sm font-semibold tracking-[0.14em] uppercase">
                Start
              </p>
              <p className="mt-2 text-2xl font-semibold">Create Roles</p>
            </button>

            <div className={FLOWCHART_SELECT_PANEL_CLASS}>
              <p className="text-sm font-semibold tracking-[0.14em] uppercase">
                Select Role
              </p>
              <select
                className={FLOWCHART_SELECT_INPUT_CLASS}
                value={selectedRoleId ?? ""}
                onChange={(event) =>
                  updateRoute("flow", event.currentTarget.value || null)
                }
              >
                <option value="" className="text-slate-900">
                  Select role
                </option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id} className="text-slate-900">
                    {role.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4">
              {actions.map((action) =>
                action.href && !action.disabled ? (
                  <Link
                    key={action.title}
                    href={action.href}
                    className={FLOWCHART_MOBILE_ACTION_ENABLED_CLASS}
                  >
                    <p className="text-lg font-semibold text-white">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      {action.description}
                    </p>
                  </Link>
                ) : (
                  <button
                    key={action.title}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`${FLOWCHART_MOBILE_ACTION_DISABLED_CLASS} disabled:cursor-not-allowed`}
                  >
                    <p className="text-lg font-semibold text-slate-600">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {action.description}
                    </p>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedRole ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-700">
          <span className="font-semibold text-slate-900">{selectedRole.title}</span>
          {selectedRole.department ? ` • ${selectedRole.department}` : ""}
          {selectedRole.hasCompetencies
            ? " already has competency data attached."
            : " still needs competencies attached."}{" "}
          {selectedRole.hasCompositeDocument
            ? "Its Word composite is already available to view or download."
            : "Its Word composite has not been created yet."}
        </div>
      ) : null}
    </section>
  );
}
