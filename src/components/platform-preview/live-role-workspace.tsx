import Link from "next/link";
import { Panel } from "@/components/coaching/ui";
import { requirePlatformPreviewAdministrator } from "@/lib/platform-preview/server";
import { requireWorkspaceProfile } from "@/lib/workspace";

type LiveRole = "candidate" | "mentor";

export async function LiveRoleWorkspace({ role }: { role: LiveRole }) {
  await requirePlatformPreviewAdministrator();
  const { profile, supabase: db } = await requireWorkspaceProfile();
  const organizationId = profile.organization_id;
  const candidates = await db.from("candidates").select("id, full_name, current_title, target_role_id").eq("organization_id", organizationId).order("created_at", { ascending: true });
  const candidate = candidates.data?.[0];
  const assignments = candidate
    ? await db.from("mentor_role_assignments").select("candidate_id, role_id, mentor_profile_id, status").eq("organization_id", organizationId).eq("candidate_id", candidate.id).order("status")
    : { data: [], error: null };
  const assignment = assignments.data?.[0];
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
  const cards = role === "candidate"
    ? [
        ["My Role Profile", `Your target role is ${title}. Review the competencies that define success.`, `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}`],
        ["Development Plan", "Work through mentoring assignments, evidence, and next actions connected to your role.", `/candidates/${candidate?.id ?? ""}/development?roleId=${roleResult.data?.id ?? ""}`],
        ["Mentoring Track", assignment ? "Open your assigned mentor track and complete the preparation worksheets." : "No mentor assignment is attached yet.", `/mentoring?candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
      ]
    : [
        ["Assigned Candidate", candidate ? `${name} · ${candidate.current_title || "Current role not recorded"}` : "No candidate-role assignment is available.", `/candidates/${candidate?.id ?? ""}?roleId=${roleResult.data?.id ?? ""}`],
        ["Mentoring Track", assignment ? `Guide ${name} toward ${title} through the assigned development track.` : "Assign a candidate and role to begin mentoring.", `/mentoring?candidateId=${candidate?.id ?? ""}&roleId=${roleResult.data?.id ?? ""}`],
        ["Role Competencies", `${competencies.data?.length ?? 0} role competencies are available to shape the mentoring conversation.`, `/roles?roleId=${roleResult.data?.id ?? ""}`],
      ];
  return <main className="app-page"><div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 sm:px-10"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">{role === "candidate" ? "Candidate Workspace" : "Mentor Workspace"}</p><h1 className="mt-2 text-3xl font-semibold text-teal-950">{role === "candidate" ? `Welcome, ${name.split(" ")[0]}` : "Mentoring Dashboard"}</h1><p className="mt-2 text-slate-600">Live role-based workspace connected to your organization’s configured roles, competencies, and mentoring records.</p></header><Panel title={role === "candidate" ? "Your development path" : "Your mentoring path"}><p>{role === "candidate" ? `${title} · ${competencies.data?.length ?? 0} competencies · ${assignment ? "Mentor assigned" : "Mentor not assigned"}` : `${name} · ${title} · ${assignment ? "Active assignment" : "Assignment needs setup"}`}</p><Link className="mt-4 inline-block rounded-full bg-teal-950 px-4 py-2 font-semibold text-white" href={liveLink}>Open live workspace</Link></Panel><div className="grid gap-5 md:grid-cols-3">{cards.map(([cardTitle, description, href], index) => <div className={["accent-card-gold", "accent-card-green", "accent-card-coral"][index]} key={cardTitle}><Panel title={cardTitle}><p>{description}</p><Link className="mt-5 inline-block font-semibold text-teal-900 underline" href={href}>Open tool</Link></Panel></div>)}</div>{role === "candidate" && <Panel title="Role competencies"><div className="grid gap-3 sm:grid-cols-2">{(competencies.data ?? []).slice(0, 8).map((item) => <div className="rounded-xl border border-slate-200 bg-white/70 p-4" key={item.id}><p className="font-semibold text-teal-950">{item.name}</p><p className="mt-1 text-sm text-slate-600">Target score: {item.target_score ?? "Not set"}</p></div>)}</div>{!competencies.data?.length && <p>No role competencies have been configured yet.</p>}</Panel>}</div></main>;
}
