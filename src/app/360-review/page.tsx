import { redirect } from "next/navigation";
import { Review360Workspace } from "@/components/review-360-workspace";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

export default async function Review360Page() {
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  if (!isAdminAppRole(profile.role)) redirect("/dashboard?message=360+Review+is+available+to+organization+administrators+only");
  const [assignmentsResult, usersResult, rolesResult, cyclesResult, respondentsResult] = await Promise.all([
    supabase.from("employee_role_assignments").select("id, organization_user_id, role_id, department").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("organization_users").select("id, first_name, last_name").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("roles").select("id, title").eq("organization_id", profile.organization_id),
    supabase.from("review_360_cycles").select("id, employee_organization_user_id, role_title, title, status, due_date").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }),
    supabase.from("review_360_respondents").select("review_cycle_id, status").eq("organization_id", profile.organization_id),
  ]);
  for (const result of [assignmentsResult, usersResult, rolesResult, cyclesResult, respondentsResult]) if (result.error) throw new Error(result.error.message);
  const users = new Map((usersResult.data ?? []).map(user => [user.id, `${user.first_name} ${user.last_name}`])); const roles = new Map((rolesResult.data ?? []).map(role => [role.id, role.title]));
  const respondents = respondentsResult.data ?? [];
  return <main className="app-page"><div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12"><section className="theme-panel-strong rounded-[2rem] p-8"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Current-role feedback</p><h1 className="mt-3 font-display text-5xl text-slate-900">360° Role Competency Review</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">Evaluate observable behavior against the employee’s current Ideal Role Composite. Results are developmental, confidential, and distinct from succession readiness.</p></section><Review360Workspace assignments={(assignmentsResult.data ?? []).map(a=>({ id:a.id, employeeName:users.get(a.organization_user_id) ?? "Unknown employee", roleTitle:roles.get(a.role_id) ?? "Unknown role", department:a.department }))} cycles={(cyclesResult.data ?? []).map(c=>{ const related=respondents.filter(r=>r.review_cycle_id===c.id); return { id:c.id,title:c.title,employeeName:users.get(c.employee_organization_user_id) ?? "Unknown employee",roleTitle:c.role_title,status:c.status,dueDate:c.due_date,invited:related.length,completed:related.filter(r=>r.status==="completed").length }; })}/></div></main>;
}
