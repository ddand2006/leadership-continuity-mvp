import Link from "next/link";

type MentoringAssignmentSidebarProps = {
  assignments: Array<{
    key: string;
    candidateId: string;
    candidateName: string;
    currentTitle: string | null;
    roleId: string;
    roleTitle: string;
    mentorProfileId: string | null;
    mentorName: string;
    status: string | null;
  }>;
  selectedAssignmentKey: string | null;
  sectionId: string;
};

export function MentoringAssignmentSidebar({
  assignments,
  selectedAssignmentKey,
  sectionId,
}: MentoringAssignmentSidebarProps) {
  return (
    <aside className="theme-panel h-fit rounded-[1.75rem] p-5 xl:sticky xl:top-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">Mentoring tracks</p>
      <h1 className="mt-2 font-display text-3xl text-slate-900">Select a mentoring track</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Open a candidate, role, and mentor combination to work in its mentoring record.</p>
      <nav className="mt-6 grid gap-2" aria-label="Mentoring track selection">
        {assignments.map((assignment) => {
          const isSelected = assignment.key === selectedAssignmentKey;
          const params = new URLSearchParams({
            section: sectionId,
            candidateId: assignment.candidateId,
            roleId: assignment.roleId,
          });
          if (assignment.mentorProfileId) params.set("mentorProfileId", assignment.mentorProfileId);
          return (
            <Link
              key={assignment.key}
              href={`/mentoring?${params.toString()}`}
              aria-current={isSelected ? "page" : undefined}
              className={`rounded-2xl border px-4 py-3 text-left transition ${isSelected ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_30px_rgba(15,23,42,0.14)]" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <span className="block text-sm font-semibold">{assignment.candidateName}</span>
              <span className={`mt-1 block text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>{assignment.roleTitle}</span>
              <span className={`mt-1 block text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>Mentor: {assignment.mentorName}</span>
              <span className={`mt-1 block text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>{assignment.currentTitle ?? "No current title"} · {(assignment.status ?? "active").replaceAll("_", " ")}</span>
            </Link>
          );
        })}
        {assignments.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">No mentoring tracks are available to this account.</p> : null}
      </nav>
    </aside>
  );
}
