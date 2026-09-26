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
  const name = candidate?.full_name || "No candidate selected";
  const title = roleResult.data?.title || "Target role not assigned";
  const liveLink = candidate && roleResult.data
    ? role === "candidate"
      ? `/candidates/${candidate.id}?roleId=${roleResult.data.id}`
      : `/mentoring?candidateId=${candidate.id}&roleId=${roleResult.data.id}`
    : role === "candidate" ? "/candidates" : "/mentoring";
  const preparationHref = assignment
    ? `/mentoring?section=preparation-worksheet&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}&mentorProfileId=${assignment.mentor_profile_id ?? ""}`
    : `/mentoring?candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`;
  const cards = role === "candidate"
    ? [
        ["My Role Profile", `Your target role is ${title}. Review readiness, role considerations, assessments, strengths, and the competencies that define success.`, `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}&section=role-fit`],
        ["Development Plan", "Work through mentoring assignments, evidence, and next actions connected to your role.", `/candidates/${candidate?.id ?? ""}/development?roleId=${roleResult.data?.id ?? ""}`],
        ["Mentoring Track", assignment ? "Open your assigned preparation worksheet and complete the mentoring track." : "No mentor assignment is attached yet.", preparationHref],
      ]
    : [
        ["Assigned Candidate", candidate ? `${name} · ${candidate.current_title || "Current role not recorded"}` : "No candidate-role assignment is available.", `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}`],
        ["Mentoring Track", assignment ? `Guide ${name} toward ${title} through the assigned development track.` : "Assign a candidate and role to begin mentoring.", `/mentoring?candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
        ["Role Competencies", `${competencies.data?.length ?? 0} role competencies are available to shape the mentoring conversation.`, `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}`],
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
    ["My Candidates", `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}`],
    ["Preparation Worksheet", preparationHref],
    ["Development Plan", `/candidates/${candidate?.id ?? ""}/development?roleId=${roleResult.data?.id ?? ""}`],
    ["Departmental Project", `/mentoring?section=departmental-project&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
    ["Mentor Resources", `/mentoring?section=resources&candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
  ] : [];
  const withMentorView = (href: string) => role === "mentor"
    ? `${href}${href.includes("?") ? "&" : "?"}viewAs=mentor&candidateId=${encodeURIComponent(candidate?.id ?? "")}&mentorProfileId=${encodeURIComponent(assignment?.mentor_profile_id ?? "")}`
    : href;
  return <main className="app-page"><div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:px-10"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">{role === "candidate" ? "Candidate Workspace" : "Mentor Workspace"}</p><h1 className="mt-2 text-3xl font-semibold text-teal-950">{role === "candidate" ? `Welcome, ${name.split(" ")[0]}` : sectionTitles[section] ?? "Mentoring Dashboard"}</h1><p className="mt-2 text-slate-600">Live role-based workspace connected to your organization’s configured roles, competencies, and mentoring records.</p></header>{role === "mentor" && <Panel title="Candidates I Mentor"><div className="flex flex-wrap gap-3">{(candidates.data ?? []).map((item) => <Link className={`rounded-full border px-4 py-2 font-semibold ${item.id === candidate?.id ? "bg-teal-950 text-white" : "bg-white text-teal-900"}`} href={`/view-as/mentor/${section}?candidateId=${item.id}&mentorProfileId=${assignments.data?.find((itemAssignment) => itemAssignment.candidate_id === item.id)?.mentor_profile_id ?? ""}`} key={item.id}>{item.full_name}</Link>)}</div>{!candidates.data?.length && <p>No active mentor assignments are available.</p>}</Panel>}{role === "mentor" && section !== "home" ? <Panel title={sectionTitles[section] ?? "Mentor Workspace"}><p>{section === "candidates" ? `Review ${name}'s current role, target role, competencies, and mentoring status.` : section === "mentoring" ? `Open the preparation worksheet for ${name} and continue the assigned mentoring track.` : section === "development" ? `Review ${name}'s development plan and evidence against ${title}.` : section === "projects" ? "Choose the departmental or cross-departmental project tool for this mentoring track." : section === "resources" ? "Open the preparation and project resources used in the mentoring track." : "Review the current mentoring notifications and next actions."}</p><div className="mt-5 flex flex-wrap gap-3">{sectionLinks.map(([label, href]) => <Link className="rounded-full bg-teal-950 px-4 py-2 font-semibold text-white" href={withMentorView(href)} key={label}>{label}</Link>)}</div></Panel> : <><Panel title={role === "candidate" ? "Your development path" : "Your mentoring path"}><p>{role === "candidate" ? `${title} · ${competencies.data?.length ?? 0} competencies · ${assignment ? "Mentor assigned" : "Mentor not assigned"}` : `${name} · ${title} · ${assignment ? "Active assignment" : "Assignment needs setup"}`}</p><Link className="mt-4 inline-block rounded-full bg-teal-950 px-4 py-2 font-semibold text-white" href={withMentorView(liveLink)}>Open live workspace</Link></Panel><div className="grid gap-5 md:grid-cols-3">{cards.map(([cardTitle, description, href], index) => <Link href={withMentorView(href)} className="block" key={cardTitle}><Panel className={["accent-card-gold", "accent-card-green", "accent-card-coral"][index]} title={cardTitle}><p>{description}</p><span className="mt-5 inline-block font-semibold text-teal-900 underline">Open tool</span></Panel></Link>)}</div>{role === "candidate" && <Panel title="Role competencies"><div className="grid gap-3 sm:grid-cols-2">{(competencies.data ?? []).slice(0, 8).map((item) => <div className="rounded-xl border border-slate-200 bg-white/70 p-4" key={item.id}><p className="font-semibold text-teal-950">{item.name}</p><p className="mt-1 text-sm text-slate-600">Target score: {item.target_score ?? "Not set"}</p></div>)}</div>{!competencies.data?.length && <p>No role competencies have been configured yet.</p>}</Panel>}</>}</div></main>;
}
