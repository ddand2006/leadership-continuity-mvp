import { redirect } from "next/navigation";
import { Review360Workspace } from "@/components/review-360-workspace";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type Review360PageProps = { searchParams: Promise<{ candidateId?: string }> };

export default async function Review360Page({ searchParams }: Review360PageProps) {
  const { candidateId } = await searchParams;
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  if (!isAdminAppRole(profile.role)) redirect("/dashboard?message=360+Review+is+available+to+organization+administrators+only");
  const [assignmentsResult, usersResult, rolesResult, candidatesResult, cyclesResult, respondentsResult] = await Promise.all([
    supabase.from("employee_role_assignments").select("id, organization_user_id, role_id, department").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("organization_users").select("id, first_name, last_name").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("roles").select("id, title").eq("organization_id", profile.organization_id),
    supabase.from("candidates").select("id, full_name, current_role_id").eq("organization_id", profile.organization_id).not("current_role_id", "is", null).order("full_name"),
    supabase.from("review_360_cycles").select("id, employee_organization_user_id, candidate_id, role_title, title, status, due_date").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }),
    supabase.from("review_360_respondents").select("review_cycle_id, status").eq("organization_id", profile.organization_id),
  ]);
  for (const result of [assignmentsResult, usersResult, rolesResult, candidatesResult, cyclesResult, respondentsResult]) if (result.error) throw new Error(result.error.message);
  const users = new Map((usersResult.data ?? []).map((user) => [user.id, `${user.first_name} ${user.last_name}`]));
  const roles = new Map((rolesResult.data ?? []).map((role) => [role.id, role.title]));
  const candidates = new Map((candidatesResult.data ?? []).map((candidate) => [candidate.id, candidate.full_name]));
  const respondents = respondentsResult.data ?? [];
  const subjects = [
    ...(assignmentsResult.data ?? []).map((assignment) => ({ value: `employee:${assignment.id}`, name: users.get(assignment.organization_user_id) ?? "Unknown employee", roleTitle: roles.get(assignment.role_id) ?? "Unknown role", kind: "employee" as const })),
    ...(candidatesResult.data ?? []).map((candidate) => ({ value: `candidate:${candidate.id}`, name: candidate.full_name, roleTitle: roles.get(candidate.current_role_id!) ?? "Unknown role", kind: "candidate" as const })),
  ];
  return <main className="app-page"><div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12"><section className="theme-panel-strong rounded-[2rem] p-8"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Current-role feedback</p><h1 className="mt-3 font-display text-5xl text-slate-900">360° Role Competency Review</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">Evaluate observable behavior against the person’s current Ideal Role Composite. Results are developmental, confidential, and distinct from succession readiness.</p></section><Review360Workspace subjects={subjects} employees={(usersResult.data ?? []).map((user) => ({ id: user.id, name: `${user.first_name} ${user.last_name}` }))} roles={(rolesResult.data ?? []).map((role) => ({ id: role.id, title: role.title }))} initialSubjectValue={candidateId ? `candidate:${candidateId}` : undefined} cycles={(cyclesResult.data ?? []).map((cycle) => { const related = respondents.filter((respondent) => respondent.review_cycle_id === cycle.id); return { id: cycle.id, title: cycle.title, employeeName: cycle.candidate_id ? candidates.get(cycle.candidate_id) ?? "Unknown candidate" : users.get(cycle.employee_organization_user_id ?? "") ?? "Unknown employee", roleTitle: cycle.role_title, status: cycle.status, dueDate: cycle.due_date, invited: related.length, completed: related.filter((respondent) => respondent.status === "completed").length }; })} /></div></main>;
}
