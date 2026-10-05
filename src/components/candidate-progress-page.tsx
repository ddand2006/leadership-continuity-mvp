import Link from "next/link";
import { Panel } from "@/components/coaching/ui";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";
import { PrintProgressSummaryButton } from "@/components/print-progress-summary-button";

type CandidateProgressPageProps = { candidateId: string };

function score(value: number | null | undefined) {
  return value == null ? "—" : Number(value).toFixed(1);
}

function proficiency(current: number | null, target: number | null) {
  if (current == null) return "Not yet assessed";
  if (target != null && current >= target) return "Proficient";
  if (current >= 3.5) return "Developing toward proficiency";
  return "Early development";
}

export async function CandidateProgressPage({ candidateId }: CandidateProgressPageProps) {
  const { profile, supabase } = await requirePaidWorkspaceProfile();
  const organizationId = profile.organization_id;
  const candidateResult = await supabase.from("candidates").select("id, full_name, current_title, target_role_id").eq("organization_id", organizationId).eq("id", candidateId).single();
  if (candidateResult.error || !candidateResult.data) throw new Error(candidateResult.error?.message ?? "Candidate could not be loaded.");
  const candidate = candidateResult.data;

  const considerationsResult = await supabase.from("candidate_role_considerations").select("role_id, status, is_primary, created_at").eq("organization_id", organizationId).eq("candidate_id", candidateId).eq("status", "active").order("created_at", { ascending: true });
  const roleIds = [...new Set([...(considerationsResult.data ?? []).map((item) => item.role_id), ...(candidate.target_role_id ? [candidate.target_role_id] : [])])];
  const [rolesResult, competenciesResult, panelsResult, assignmentsResult, recordsResult] = await Promise.all([
    roleIds.length ? supabase.from("roles").select("id, title").eq("organization_id", organizationId).in("id", roleIds) : Promise.resolve({ data: [], error: null }),
    roleIds.length ? supabase.from("role_competencies").select("id, role_id, name, target_score").eq("organization_id", organizationId).in("role_id", roleIds).is("deleted_at", null).order("name") : Promise.resolve({ data: [], error: null }),
    supabase.from("interview_panels").select("id, role_id, date_completed, created_at").eq("organization_id", organizationId).eq("candidate_id", candidateId).order("date_completed", { ascending: false }),
    supabase.from("candidate_project_assignments").select("id, status, due_date, start_date, mentor_notes, evidence_notes, development_project_id").eq("organization_id", organizationId).eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    supabase.from("development_records").select("id, role_id, mentor_id, experience_title, status, mentor_review_date, mentor_improvement_observed, development_record_competencies(competency_name, baseline_score, current_score, target_score)").eq("organization_id", organizationId).eq("candidate_id", candidateId).is("archived_at", null).order("created_at", { ascending: false }),
  ]);
  for (const result of [considerationsResult, rolesResult, competenciesResult, panelsResult, assignmentsResult, recordsResult]) if (result.error) throw new Error(result.error.message);
  const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
  const projectIds = (assignmentsResult.data ?? []).map((assignment) => assignment.development_project_id);
  const [scoresResult, projectsResult] = await Promise.all([
    panelIds.length ? supabase.from("interview_scores").select("panel_id, competency_id, score_numeric").in("panel_id", panelIds) : Promise.resolve({ data: [], error: null }),
    projectIds.length ? supabase.from("development_projects").select("id, title, description, competencies_developed").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (scoresResult.error || projectsResult.error) throw new Error(scoresResult.error?.message ?? projectsResult.error?.message);

  const roles = rolesResult.data ?? [];
  const competencies = competenciesResult.data ?? [];
  const records = recordsResult.data ?? [];
  const projectMap = new Map((projectsResult.data ?? []).map((item) => [item.id, item]));
  const projects = (assignmentsResult.data ?? []).map((item) => ({
    ...item,
    project: projectMap.get(item.development_project_id),
  }));
  const roleTitle = new Map(roles.map((item) => [item.id, item.title]));
  const latestLegacy = new Map<string, number>();
  const panelRoles = new Map((panelsResult.data ?? []).map((panel) => [panel.id, panel.role_id]));
  for (const item of scoresResult.data ?? []) { const roleId = panelRoles.get(item.panel_id); if (roleId && !latestLegacy.has(`${roleId}:${item.competency_id}`)) latestLegacy.set(`${roleId}:${item.competency_id}`, Number(item.score_numeric)); }
  const recordsByRole = new Map<string, typeof records>();
  for (const record of records) { const list = recordsByRole.get(record.role_id ?? "") ?? []; list.push(record); recordsByRole.set(record.role_id ?? "", list); }
  const roleSections = roles.map((role) => {
    const roleCompetencies = competencies.filter((item) => item.role_id === role.id);
    const roleRecords = recordsByRole.get(role.id) ?? [];
    const mentorRatings = new Map<string, number>();
    for (const record of roleRecords) for (const item of record.development_record_competencies ?? []) if (item.current_score != null && !mentorRatings.has(item.competency_name.trim().toLowerCase())) mentorRatings.set(item.competency_name.trim().toLowerCase(), Number(item.current_score));
    return { ...role, competencies: roleCompetencies, mentorRatings, reviews: roleRecords, projects: projects.filter((item) => (item.project?.competencies_developed ?? []).some((name: unknown) => roleCompetencies.some((competency) => competency.name.toLowerCase() === String(name).toLowerCase()))) };
  });

  return <main className="app-page"><div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:px-10"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Candidate progress</p><h1 className="mt-2 text-4xl font-semibold text-teal-950">{getCandidateDisplayName(candidate.full_name)}</h1><p className="mt-2 text-slate-600">Role-specific progress, projects, and mentor-rated improvement.</p></div><PrintProgressSummaryButton /></div>{roleSections.map((role, index) => <section className={`rounded-[1.5rem] border p-6 ${["border-amber-200 bg-amber-50", "border-emerald-200 bg-emerald-50", "border-rose-200 bg-rose-50", "border-blue-200 bg-blue-50"][index % 4]}`} key={role.id}><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Role {index + 1}</p><h2 className="mt-1 text-2xl font-semibold text-teal-950">{role.title}</h2></div><p className="text-sm text-slate-600">{role.competencies.length} competencies · {role.projects.length} linked projects</p></div><div className="mt-5 grid gap-3 md:grid-cols-2">{role.competencies.map((competency) => { const current = role.mentorRatings.get(competency.name.toLowerCase()) ?? latestLegacy.get(`${role.id}:${competency.id}`) ?? null; return <article className="rounded-2xl border border-white/80 bg-white/75 p-4" key={competency.id}><h3 className="font-semibold text-teal-950">{competency.name}</h3><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><span>Legacy<br/><strong>{score(latestLegacy.get(`${role.id}:${competency.id}`))}</strong></span><span>Current<br/><strong>{score(current)}</strong></span><span>Target<br/><strong>{score(competency.target_score)}</strong></span></div><p className="mt-3 text-sm font-semibold text-teal-800">{proficiency(current, competency.target_score)}</p></article>; })}</div><div className="mt-6 rounded-2xl border border-white/80 bg-white/65 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-teal-950">Projects</h3><span className="text-sm text-slate-600">{role.projects.filter((item) => item.status === "completed").length} completed · {role.projects.filter((item) => item.status !== "completed").length} in progress</span></div><div className="mt-3 grid gap-3">{role.projects.map((project) => <Link className="rounded-xl border border-white bg-white/80 p-4 transition hover:-translate-y-0.5 hover:shadow-md" href={`/mentoring?section=departmental-project&candidateId=${candidateId}&roleId=${role.id}&projectId=${project.development_project_id}`} key={project.id}><div className="flex flex-wrap justify-between gap-2"><strong>{project.project?.title ?? "Development project"}</strong><span className="text-sm font-semibold text-teal-800">{project.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">Due {project.due_date ?? "not scheduled"}</p></Link>)}{!role.projects.length && <p className="text-sm text-slate-600">No projects are linked to this role yet.</p>}</div></div><div className="mt-6 rounded-2xl border border-white/80 bg-white/65 p-4"><h3 className="text-lg font-semibold text-teal-950">Mentor rating history</h3><div className="mt-3 grid gap-3">{role.reviews.map((review) => <Link className="block rounded-xl border border-white bg-white/80 p-3 transition hover:-translate-y-0.5 hover:shadow-md" href={`/mentoring?section=leadership-development-record&candidateId=${candidateId}&roleId=${role.id}&mentorProfileId=${review.mentor_id}&recordId=${review.id}`} key={review.id}><p className="font-semibold text-teal-900">{review.experience_title} · {review.mentor_review_date ?? "Date not recorded"} · {review.status.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-600">{review.mentor_improvement_observed || "No improvement note recorded."}</p></Link>)}{!role.reviews.length && <p className="text-sm text-slate-600">No mentor reviews have been recorded for this role yet.</p>}</div></div></section>)}{!roleSections.length && <Panel title="Progress is not configured yet"><p>No active roles or competencies are available for this candidate.</p></Panel>}</div></main>;
}
