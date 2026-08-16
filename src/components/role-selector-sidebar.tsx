import Link from "next/link";

type RoleSelectorSidebarProps = {
  roles: Array<{
    id: string;
    title: string;
    department: string | null;
    status: string;
  }>;
  selectedRoleId: string | null;
  isCreatingRole: boolean;
  selectedWorkspaceMode: "import" | "printables" | "create";
};

export function RoleSelectorSidebar({
  roles,
  selectedRoleId,
  isCreatingRole,
  selectedWorkspaceMode,
}: RoleSelectorSidebarProps) {
  return (
    <aside className="theme-panel h-fit rounded-[1.75rem] p-5 xl:sticky xl:top-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Roles</p>
      <h1 className="mt-2 font-display text-3xl text-slate-900">Add or select a role</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Create a new role or open an existing role workspace.
      </p>

      <nav className="mt-6 grid gap-2" aria-label="Role selection">
        <Link
          href="/roles?mode=create"
          aria-current={isCreatingRole ? "page" : undefined}
          className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition ${
            isCreatingRole
              ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_14px_30px_rgba(15,118,110,0.18)]"
              : "border-teal-200 bg-teal-50 text-teal-950 hover:border-teal-400 hover:bg-teal-100"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-lg leading-none">+</span>
            Add new role
          </span>
        </Link>

        {roles.length > 0 ? (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Your roles</p>
            <div className="grid gap-2">
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;

                return (
                  <Link
                    key={role.id}
                    href={`/roles?roleId=${role.id}&mode=${selectedWorkspaceMode}`}
                    aria-current={isSelected ? "page" : undefined}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "interactive-contrast border-slate-900 bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`block text-sm font-bold ${
                        isSelected ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {role.title}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${
                        isSelected ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {role.department ?? "No department"} · {role.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Your first role will appear here after you create it.
          </p>
        )}
      </nav>
    </aside>
  );
}
