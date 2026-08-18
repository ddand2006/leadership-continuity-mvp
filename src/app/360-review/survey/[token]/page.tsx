import { Review360ResponseForm } from "@/components/review-360-response-form";
import { hashReview360Token } from "@/lib/review-360";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrganizationAccessStatus } from "@/lib/organization-access";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const respondent = await admin.from("review_360_respondents").select("review_cycle_id,status").eq("token_hash", hashReview360Token(token)).maybeSingle();
  if (respondent.error) throw new Error(respondent.error.message);
  if (!respondent.data) return <main className="app-page p-12">This survey link is not available.</main>;
  const [cycle, competencies, questions] = await Promise.all([
    admin.from("review_360_cycles").select("organization_id, role_title, employee_organization_user_id, candidate_id").eq("id", respondent.data.review_cycle_id).single(),
    admin.from("review_360_snapshot_competencies").select("id,name,definition").eq("review_cycle_id", respondent.data.review_cycle_id).order("display_order"),
    admin.from("review_360_snapshot_questions").select("id,snapshot_competency_id,prompt,display_order").eq("review_cycle_id", respondent.data.review_cycle_id).order("display_order"),
  ]);
  if (cycle.error || competencies.error || questions.error) throw new Error(cycle.error?.message ?? competencies.error?.message ?? questions.error?.message);
  if (await getOrganizationAccessStatus(cycle.data.organization_id) === "payment_hold") return <main className="app-page p-12">This survey is temporarily unavailable. Please contact the organization that invited you.</main>;
  const subject = cycle.data.candidate_id
    ? await admin.from("candidates").select("full_name").eq("id", cycle.data.candidate_id).maybeSingle()
    : await admin.from("organization_users").select("first_name,last_name").eq("id", cycle.data.employee_organization_user_id).maybeSingle();
  if (subject.error) throw new Error(subject.error.message);
  const employeeName = cycle.data.candidate_id
    ? subject.data && "full_name" in subject.data ? subject.data.full_name : "this candidate"
    : subject.data && "first_name" in subject.data ? `${subject.data.first_name} ${subject.data.last_name}` : "this employee";
  return <main className="app-page"><div className="mx-auto max-w-3xl px-6 py-12"><p className="text-sm font-semibold text-teal-700">360° ROLE COMPETENCY REVIEW</p><h1 className="mt-3 font-display text-4xl">360 Review for {employeeName}</h1><p className="mt-2 text-lg font-semibold text-slate-700">Current role: {cycle.data.role_title}</p><p className="mt-3 text-slate-600">Rate observable behavior fairly. N/A responses are excluded from scoring.</p><div className="mt-8"><Review360ResponseForm token={token} employeeName={employeeName} competencies={(competencies.data ?? []).map((competency) => ({ id: competency.id, name: competency.name, definition: competency.definition, questions: (questions.data ?? []).filter((question) => question.snapshot_competency_id === competency.id).map((question) => ({ id: question.id, prompt: question.prompt, displayOrder: question.display_order })) }))} completed={respondent.data.status === "completed"} /></div></div></main>;
}
