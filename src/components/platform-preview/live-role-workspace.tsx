import Link from "next/link";
import { Panel } from "@/components/coaching/ui";
import { requirePlatformPreviewAdministrator } from "@/lib/platform-preview/server";
import { requireWorkspaceProfile } from "@/lib/workspace";

type LiveRole = "candidate" | "mentor";

export async function LiveRoleWorkspace({ role, section = "home", candidateId }: { role: LiveRole; section?: string; candidateId?: string }) {
  await requirePlatformPreviewAdministrator();
  const { profile, supabase: db } = await requireWorkspaceProfile();
  const organizationId = profile.organization_id;
  const assignments = await db.from("mentor_role_assignments").select("candidate_id, role_id, mentor_profile_id, status").eq("organization_id", organizationId).eq("status", "active").order("created_at", { ascending: true });
  const assignedCandidateIds = [...new Set((assignments.data ?? []).map((item) => item.candidate_id))];
  const candidates = assignedCandidateIds.length > 0
    ? await db.from("candidates").select("id, full_name, current_title, target_role_id").eq("organization_id", organizationId).in("id", assignedCandidateIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (assignments.error || candidates.error) throw new Error(assignments.error?.message ?? candidates.error?.message);
  const candidate = candidates.data?.find((item) => item.id === candidateId) ?? candidates.data?.[0];
  const assignment = candidate ? assignments.data?.find((item) => item.candidate_id === candidate.id) : undefined;
  const roleResult = assignment?.role_id || candidate?.target_role_id
    ? await db.from("roles").select("id, title, department, description").eq("organization_id", organizationId).eq("id", assignment?.role_id ?? candidate?.target_role_id).maybeSingle()
    : { data: null, error: null };
  const competencies = roleResult.data
    ? await db.from("role_competencies").select("id, name, target_score, weight").eq("organization_id", organizationId).eq("role_id", roleResult.data.id).order("name")
    : { data: [], error: null };
  const considerations = role === "candidate" && candidate
    ? await db.from("candidate_role_considerations").select("role_id, status, created_at").eq("organization_id", organizationId).eq("candidate_id", candidate.id).eq("status", "active").order("created_at", { ascending: true })
    : { data: [], error: null };
  const consideredRoleIds = [...new Set([
    ...(considerations.data ?? []).map((item) => item.role_id),
    ...(candidate?.target_role_id ? [candidate.target_role_id] : []),
  ])];
  const consideredRoles = consideredRoleIds.length > 0
    ? await db.from("roles").select("id, title").eq("organization_id", organizationId).in("id", consideredRoleIds)
    : { data: [], error: null };
  const consideredCompetencies = consideredRoleIds.length > 0
    ? await db.from("role_competencies").select("id, role_id, name, target_score, weight").eq("organization_id", organizationId).in("role_id", consideredRoleIds).order("name")
    : { data: [], error: null };
  if (considerations.error || consideredRoles.error || consideredCompetencies.error) {
    throw new Error(considerations.error?.message ?? consideredRoles.error?.message ?? consideredCompetencies.error?.message);
  }
  const roleTracks = (consideredRoles.data ?? []).map((consideredRole) => ({
    ...consideredRole,
    competencies: (consideredCompetencies.data ?? []).filter((item) => item.role_id === consideredRole.id),
  }));
  const name = candidate?.full_name || "No candidate selected";
  const title = roleResult.data?.title || "Target role not assigned";
  const liveLink = candidate && roleResult.data
    ? role === "candidate"
      ? `/candidates/${candidate.id}?roleId=${roleResult.data.id}&viewAs=candidate`
      : `/mentoring?candidateId=${candidate.id}&roleId=${roleResult.data.id}`
    : role === "candidate" ? "/candidates?viewAs=candidate" : "/mentoring";
  const preparationHref = assignment
    ? `/mentoring?section=preparation-worksheet&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}&mentorProfileId=${assignment.mentor_profile_id ?? ""}`
    : `/mentoring?candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`;
  const cards = role === "candidate"
    ? [
        ["My Role Profile", `Your target role is ${title}. Review readiness, role considerations, assessments, strengths, and the competencies that define success.`, `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}&section=role-fit&viewAs=candidate`],
        ["Progress", "Review legacy scores, mentor-rated proficiency, and completed or active projects by role.", `/candidates/${candidate?.id ?? ""}/progress?roleId=${roleResult.data?.id ?? ""}&viewAs=candidate`],
        ["Mentoring Track", assignment ? "Open your assigned preparation worksheet and complete the mentoring track." : "No mentor assignment is attached yet.", preparationHref],
      ]
    : [
        ["Candidate Profile", "Review the candidate's position, assessments, 360 reviews, and strengths evidence.", `/candidates/${candidate?.id ?? ""}?section=candidate-profile&roleId=${roleResult.data?.id ?? ""}`],
        ["Role Fit", "Compare the candidate with the target role's competencies, strengths, and readiness.", `/candidates/${candidate?.id ?? ""}?section=role-fit&roleId=${roleResult.data?.id ?? ""}`],
        ["Progress Report", "Review legacy scores, mentor-rated proficiency, and completed or active projects.", `/candidates/${candidate?.id ?? ""}/progress?roleId=${roleResult.data?.id ?? ""}`],
        ["Mentor Report", "Review the latest mentor-facing development narrative and priorities.", `/candidates/${candidate?.id ?? ""}?section=mentor-report&roleId=${roleResult.data?.id ?? ""}`],
        ["Leadership Development Record", "Define a stretch experience, target competencies, feedback, and review cycle.", `/mentoring?section=leadership-development-record&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
        ["Readiness Review", "Review evidence of growth and record the next leadership recommendation.", `/mentoring?section=readiness-review&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
        ["Mentor Scorecard", "Track mentor engagement, current reports, and timely reviews.", `/mentoring?section=mentor-scorecard&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
        ["Additional Resources", "Open preparation worksheets and departmental project tools.", `/mentoring?section=resources&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
      ];
  const sectionTitles: Record<string, string> = {
    candidates: "My Candidates",
    mentoring: "Mentoring Track",
    development: "Development Plan",
    projects: "Projects",
    resources: "Mentor Resources",
    notifications: "Notifications",
  };
  const sectionLinks = role === "mentor" ? [
    ["Preparation Worksheet", preparationHref],
    ["Development Plan", `/candidates/${candidate?.id ?? ""}/development?roleId=${roleResult.data?.id ?? ""}`],
    ["Departmental Project", `/mentoring?section=departmental-project&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
    ["Mentor Resources", `/mentoring?section=resources&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
  ] : [];
  const withMentorView = (href: string) => role === "mentor"
    ? `${href}${href.includes("?") ? "&" : "?"}viewAs=mentor&candidateId=${encodeURIComponent(candidate?.id ?? "")}&mentorProfileId=${encodeURIComponent(assignment?.mentor_profile_id ?? "")}`
    : href;
  return <main className="app-page"><div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:px-10"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">{role === "candidate" ? "Candidate Workspace" : "Mentor Workspace"}</p><h1 className="mt-2 text-3xl font-semibold text-teal-950">{role === "candidate" ? `Welcome, ${name.split(" ")[0]}` : sectionTitles[section] ?? "Mentoring Dashboard"}</h1><p className="mt-2 text-slate-600">Live role-based workspace connected to your organization’s configured roles, competencies, and mentoring records.</p></header>{role === "mentor" && <Panel title="Candidates I Mentor"><div className="flex flex-wrap gap-3">{(candidates.data ?? []).map((item) => <Link className={`rounded-full border px-4 py-2 font-semibold ${item.id === candidate?.id ? "bg-teal-950 text-white" : "bg-white text-teal-900"}`} href={`/view-as/mentor/${section}?candidateId=${item.id}&mentorProfileId=${assignments.data?.find((itemAssignment) => itemAssignment.candidate_id === item.id)?.mentor_profile_id ?? ""}`} key={item.id}>{item.full_name}</Link>)}</div>{!candidates.data?.length && <p>No active mentor assignments are available.</p>}</Panel>}{role === "mentor" && section !== "home" ? <Panel title={sectionTitles[section] ?? "Mentor Workspace"}><p>{section === "candidates" ? `Review ${name}'s current role, target role, competencies, and mentoring status.` : section === "mentoring" ? `Open the preparation worksheet for ${name} and continue the assigned mentoring track.` : section === "development" ? `Review ${name}'s development plan and evidence against ${title}.` : section === "projects" ? "Choose the departmental or cross-departmental project tool for this mentoring track." : section === "resources" ? "Open the preparation and project resources used in the mentoring track." : "Review the current mentoring notifications and next actions."}</p><div className="mt-5 flex flex-wrap gap-3">{sectionLinks.map(([label, href]) => <Link className="rounded-full bg-teal-950 px-4 py-2 font-semibold text-white" href={withMentorView(href)} key={label}>{label}</Link>)}</div></Panel> : <><Panel title={role === "candidate" ? "Your development path" : "Your mentoring path"}><p>{role === "candidate" ? `${title} · ${competencies.data?.length ?? 0} competencies · ${assignment ? "Mentor assigned" : "Mentor not assigned"}` : `${name} · ${title} · ${assignment ? "Active assignment" : "Assignment needs setup"}`}</p><Link className="mt-4 inline-block rounded-full bg-teal-950 px-4 py-2 font-semibold text-white" href={withMentorView(liveLink)}>Open live workspace</Link></Panel><div className="order-colored-grid grid gap-5 md:grid-cols-2 lg:grid-cols-4">{cards.map(([cardTitle, description, href], index) => <Link href={withMentorView(href)} className="block h-full" key={cardTitle}><Panel className={`workspace-card h-full ${["accent-card-gold", "accent-card-green", "accent-card-coral", "accent-card-blue"][index % 4]}`} title={cardTitle}><p>{description}</p><span className="mt-5 inline-block font-semibold text-teal-900 underline">Open tool</span></Panel></Link>)}</div>{role === "candidate" && <Panel title="Role competencies"><div className="space-y-6">{(roleTracks.length > 0 ? roleTracks : roleResult.data ? [{ ...roleResult.data, competencies: competencies.data ?? [] }] : []).map((track, trackIndex) => <section className={`rounded-2xl border p-5 ${["border-amber-200 bg-amber-50", "border-emerald-200 bg-emerald-50", "border-rose-200 bg-rose-50", "border-blue-200 bg-blue-50"][trackIndex % 4]}`} key={track.id}><h2 className="text-xl font-semibold text-teal-950">{track.title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{track.competencies.slice(0, 8).map((item) => <div className="rounded-xl border border-white/70 bg-white/70 p-4" key={item.id}><p className="font-semibold text-teal-950">{item.name}</p><p className="mt-1 text-sm text-slate-600">Target score: {item.target_score ?? "Not set"}</p></div>)}</div>{!track.competencies.length && <p className="mt-4 text-sm text-slate-600">No competencies have been configured for this role yet.</p>}</section>)}</div>{!roleTracks.length && !roleResult.data && <p>No role competencies have been configured yet.</p>}</Panel>}</>}</div></main>;
}
