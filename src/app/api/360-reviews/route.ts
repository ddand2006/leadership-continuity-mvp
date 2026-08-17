import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createReview360Schema } from "@/lib/review-360";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requireWorkspaceProfile } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    const { profile } = await requireWorkspaceProfile();
    if (!isAdminAppRole(profile.role)) return NextResponse.json({ error: "Only administrators can create 360 reviews." }, { status: 403 });
    const payload = createReview360Schema.parse(await request.json()); const admin = createSupabaseAdminClient();
    const employeeAssignment = payload.employeeRoleAssignmentId ? await admin.from("employee_role_assignments").select("id, role_id, organization_user_id, effective_from, roles!inner(title, updated_at)").eq("id", payload.employeeRoleAssignmentId).eq("organization_id", profile.organization_id).eq("status", "active").maybeSingle() : null;
    if (employeeAssignment?.error) throw employeeAssignment.error;
    if (payload.employeeRoleAssignmentId && !employeeAssignment?.data) return NextResponse.json({ error: "The employee no longer has an active current-role assignment." }, { status: 400 });
    const candidateResult = payload.candidateId ? await admin.from("candidates").select("id, full_name, current_role_id").eq("id", payload.candidateId).eq("organization_id", profile.organization_id).maybeSingle() : null;
    if (candidateResult?.error) throw candidateResult.error;
    if (payload.candidateId && (!candidateResult?.data || !candidateResult.data.current_role_id)) return NextResponse.json({ error: "This candidate needs a current organizational role before a 360 review can begin." }, { status: 400 });
    const roleId = employeeAssignment?.data?.role_id ?? candidateResult?.data?.current_role_id;
    const roleResult = employeeAssignment?.data ? { data: employeeAssignment.data.roles as unknown as { title: string; updated_at: string }, error: null } : await admin.from("roles").select("title, updated_at").eq("id", roleId!).eq("organization_id", profile.organization_id).maybeSingle();
    if (roleResult.error) throw roleResult.error; if (!roleResult.data) return NextResponse.json({ error: "The current role could not be found." }, { status: 400 });
    const competencies = await admin.from("role_competencies").select("id, name, definition, behavioral_indicators, weight, target_score").eq("organization_id", profile.organization_id).eq("role_id", roleId!).is("deleted_at", null).order("created_at");
    if (competencies.error) throw competencies.error; if (!competencies.data?.length) return NextResponse.json({ error: "This role has no active Ideal Role Composite competencies." }, { status: 400 });
    const role = roleResult.data;
    const cycle = await admin.from("review_360_cycles").insert({ organization_id: profile.organization_id, employee_organization_user_id: employeeAssignment?.data?.organization_user_id ?? null, employee_role_assignment_id: employeeAssignment?.data?.id ?? null, candidate_id: candidateResult?.data?.id ?? null, role_id: roleId!, role_title: role.title, composite_version: `Current composite ${role.updated_at.slice(0, 10)}`, composite_effective_date: employeeAssignment?.data?.effective_from ?? new Date().toISOString().slice(0, 10), title: payload.title, due_date: payload.dueDate ?? null, created_by_profile_id: profile.id }).select("id").single();
    if (cycle.error) throw cycle.error;
    const snapshot = await admin.from("review_360_snapshot_competencies").insert(competencies.data.map((item, index) => ({ organization_id: profile.organization_id, review_cycle_id: cycle.data.id, source_role_competency_id: item.id, name: item.name, definition: item.definition, behavioral_indicators: item.behavioral_indicators, weight: item.weight, target_score: item.target_score, display_order: index }))).select("id, behavioral_indicators");
    if (snapshot.error) throw snapshot.error;
    const questions = snapshot.data.flatMap((item) => { const prompts = (item.behavioral_indicators as string[] ?? []).slice(0, 5); return (prompts.length ? prompts : ["Demonstrates the expectations described in this competency."]).map((prompt, index) => ({ organization_id: profile.organization_id, review_cycle_id: cycle.data.id, snapshot_competency_id: item.id, prompt, display_order: index + 1 })); });
    if (questions.length) { const savedQuestions = await admin.from("review_360_snapshot_questions").insert(questions); if (savedQuestions.error) throw savedQuestions.error; }
    await admin.from("review_360_audit_events").insert({ organization_id: profile.organization_id, review_cycle_id: cycle.data.id, actor_profile_id: profile.id, event_type: "review_created" });
    return NextResponse.json({ id: cycle.data.id }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create review." }, { status: 400 }); }
}
