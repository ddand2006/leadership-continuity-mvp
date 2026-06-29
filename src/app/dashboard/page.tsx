import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MentorDirectoryManager } from "@/components/mentor-directory-manager";
import { WorkspaceSetupForm } from "@/components/workspace-setup-form";
import { createWorkspaceSetupToken } from "@/lib/workspace-setup-token";

type DashboardPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

type CandidateStage =
  | "Needs target role"
  | "Needs strengths upload"
  | "Needs mentor report"
  | "Ready for mentor assignment"
  | "Mentor assigned"
  | "Development plan assigned"
  | "On hold";

type DashboardSnapshot = {
  profile: {
    id: string;
    organization_id: string;
    full_name: string;
    role: string;
    organization_name: string;
  } | null;
  roles: {
    id: string;
    title: string;
    department: string | null;
    status: string;
  }[];
  mentors: {
    id: string;
    full_name: string;
    email: string;
    position_title: string | null;
  }[];
  candidates: {
    id: string;
    full_name: string;
    current_title: string | null;
    role_titles: string[];
    mentor_names: string[];
    status: string;
    stage: CandidateStage;
  }[];
  counts: {
    roles: number;
    candidates: number;
    mentors: number;
  } | null;
};

function getStageClasses(stage: CandidateStage) {
  switch (stage) {
    case "Development plan assigned":
      return "border-teal-200 bg-teal-50 text-teal-900";
    case "Mentor assigned":
    case "Ready for mentor assignment":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "On hold":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function resolveCandidateStage(options: {
  candidateStatus: string;
  hasTargetRole: boolean;
  hasStrengths: boolean;
  hasReport: boolean;
  hasMentor: boolean;
  hasDevelopmentPlan: boolean;
}): CandidateStage {
  if (options.candidateStatus === "on_hold") {
    return "On hold";
  }

  if (!options.hasTargetRole) {
    return "Needs target role";
  }

  if (!options.hasStrengths) {
    return "Needs strengths upload";
  }

  if (!options.hasReport) {
    return "Needs mentor report";
  }

  if (!options.hasMentor) {
    return "Ready for mentor assignment";
  }

  if (!options.hasDevelopmentPlan) {
    return "Mentor assigned";
  }

  return "Development plan assigned";
}

async function getDashboardSnapshot(authUserId: string): Promise<DashboardSnapshot> {
  const admin = createSupabaseAdminClient();
  const profileResult = await admin
    .from("profiles")
    .select("id, organization_id, full_name, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (!profileResult.data) {
    return {
      profile: null,
      roles: [],
      mentors: [],
      candidates: [],
      counts: null,
    };
  }

  const organizationId = profileResult.data.organization_id;
  const [
    organizationResult,
    rolesResult,
    mentorsResult,
    candidatesResult,
    considerationsResult,
    mentorRoleAssignmentsResult,
    reportsResult,
    strengthsResult,
    sourceDocumentsResult,
    assignmentsResult,
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single(),
    admin
      .from("roles")
      .select("id, title, department, status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    admin
      .from("profiles")
      .select("id, full_name, email, position_title")
      .eq("organization_id", organizationId)
      .eq("role", "mentor")
      .order("created_at", { ascending: true }),
    admin
      .from("candidates")
      .select("id, full_name, current_title, target_role_id, mentor_profile_id, status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    admin
      .from("candidate_role_considerations")
      .select("candidate_id, role_id")
      .eq("organization_id", organizationId),
    admin
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id")
      .eq("organization_id", organizationId),
    admin
      .from("mentor_reports")
      .select("candidate_id, role_id")
      .eq("organization_id", organizationId),
    admin
      .from("candidate_strengths")
      .select("candidate_id")
      .eq("organization_id", organizationId),
    admin
      .from("candidate_source_documents")
      .select("candidate_id")
      .eq("organization_id", organizationId),
    admin
      .from("candidate_project_assignments")
      .select("candidate_id")
      .eq("organization_id", organizationId),
  ]);

  for (const result of [
    organizationResult,
    rolesResult,
    mentorsResult,
    candidatesResult,
    considerationsResult,
    mentorRoleAssignmentsResult,
    reportsResult,
    strengthsResult,
    sourceDocumentsResult,
    assignmentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const roles = rolesResult.data ?? [];
  const mentors = mentorsResult.data ?? [];
  const roleMap = new Map(roles.map((role) => [role.id, role.title]));
  const mentorMap = new Map(mentors.map((mentor) => [mentor.id, mentor.full_name]));
  const considerationsByCandidate = new Map<string, string[]>();
  const mentorNamesByCandidate = new Map<string, string[]>();
  const candidateRolePairsWithReports = new Set(
    (reportsResult.data ?? []).map((record) => `${record.candidate_id}:${record.role_id}`),
  );
  const candidateIdsWithStrengths = new Set(
    (strengthsResult.data ?? []).map((record) => record.candidate_id),
  );
  const candidateIdsWithSourceDocuments = new Set(
    (sourceDocumentsResult.data ?? []).map((record) => record.candidate_id),
  );
  const candidateIdsWithAssignments = new Set(
    (assignmentsResult.data ?? []).map((record) => record.candidate_id),
  );

  for (const consideration of considerationsResult.data ?? []) {
    const current = considerationsByCandidate.get(consideration.candidate_id) ?? [];
    current.push(consideration.role_id);
    considerationsByCandidate.set(consideration.candidate_id, current);
  }

  for (const assignment of mentorRoleAssignmentsResult.data ?? []) {
    const current = mentorNamesByCandidate.get(assignment.candidate_id) ?? [];
    const mentorName = mentorMap.get(assignment.mentor_profile_id);

    if (mentorName) {
      current.push(mentorName);
      mentorNamesByCandidate.set(assignment.candidate_id, current);
    }
  }

  const candidates = (candidatesResult.data ?? []).map((candidate) => {
    const hasStrengths =
      candidateIdsWithStrengths.has(candidate.id) ||
      candidateIdsWithSourceDocuments.has(candidate.id);
    const roleIds =
      considerationsByCandidate.get(candidate.id) ??
      (candidate.target_role_id ? [candidate.target_role_id] : []);
    const mentorNames = Array.from(
      new Set(mentorNamesByCandidate.get(candidate.id) ?? []),
    );
    const hasReport = roleIds.some((roleId) =>
      candidateRolePairsWithReports.has(`${candidate.id}:${roleId}`),
    );

    return {
      id: candidate.id,
      full_name: candidate.full_name,
      current_title: candidate.current_title,
      role_titles: roleIds
        .map((roleId) => roleMap.get(roleId))
        .filter((title): title is string => Boolean(title)),
      mentor_names: mentorNames,
      status: candidate.status,
      stage: resolveCandidateStage({
        candidateStatus: candidate.status,
        hasTargetRole: roleIds.length > 0,
        hasStrengths,
        hasReport,
        hasMentor: mentorNames.length > 0,
        hasDevelopmentPlan: candidateIdsWithAssignments.has(candidate.id),
      }),
    };
  });

  return {
    profile: {
      ...profileResult.data,
      organization_name: organizationResult.data?.name ?? "Unknown organization",
    },
    roles,
    mentors,
    candidates,
    counts: {
      roles: roles.length,
      candidates: candidates.length,
      mentors: mentors.length,
    },
  };
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await requireUser();
  const { message } = await searchParams;
  const setupToken = createWorkspaceSetupToken({
    userId: user.id,
    email: user.email ?? "",
  });
  const snapshot = await getDashboardSnapshot(user.id);

  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        {message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
            {message}
          </div>
        ) : null}

        {!snapshot.profile ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
              First-Time Setup
            </p>
            <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
              Create the company workspace first
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Signed in as <span className="font-semibold">{user.email}</span>.
              Create the admin profile and organization before using the company
              dashboard.
            </p>

            <WorkspaceSetupForm
              authEmail={user.email ?? ""}
              authUserId={user.id}
              defaultFullName={user.user_metadata.full_name ?? ""}
              defaultOrganizationName="Cycle of Business Demo Rural Hospital"
              setupToken={setupToken}
            />
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                Company Dashboard
              </p>
              <h1 className="mt-3 font-display text-6xl leading-none text-slate-900 sm:text-7xl">
                {snapshot.profile.organization_name}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                Welcome to the Leadership Continuity System. This is where your
                organization can define critical roles, identify high-potential
                candidates, connect them with mentors, and guide their
                development over time so you can build a stronger next
                generation of leaders. You are signed in as{" "}
                <span className="font-semibold">{user.email}</span>.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Roles
                </p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">
                  {snapshot.counts?.roles ?? 0}
                </p>
              </article>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Candidates
                </p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">
                  {snapshot.counts?.candidates ?? 0}
                </p>
              </article>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Mentors
                </p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">
                  {snapshot.counts?.mentors ?? 0}
                </p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Roles in the System
                    </p>
                    <h2 className="mt-3 font-display text-3xl text-slate-900">
                      Current roles
                    </h2>
                  </div>
                  <Link
                    href="/roles"
                    className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                  >
                    Open Roles
                  </Link>
                </div>

                <div className="mt-6 grid gap-3">
                  {snapshot.roles.length > 0 ? (
                    snapshot.roles.map((role) => (
                      <article
                        key={role.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
                      >
                        <p className="font-semibold text-slate-900">{role.title}</p>
                        <p className="mt-1 text-slate-600">
                          {role.department || "Department not entered"}
                        </p>
                        <p className="mt-1 text-slate-600">Status: {role.status}</p>
                      </article>
                    ))
                  ) : (
                    <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                      No roles are in the system yet.
                    </article>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Candidates in the System
                    </p>
                    <h2 className="mt-3 font-display text-3xl text-slate-900">
                      Candidate progress
                    </h2>
                  </div>
                  <Link
                    href="/candidates"
                    className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                  >
                    Open Candidates
                  </Link>
                </div>

                <div className="mt-6 grid gap-3">
                  {snapshot.candidates.length > 0 ? (
                    snapshot.candidates.map((candidate) => (
                      <article
                        key={candidate.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {candidate.full_name}
                            </p>
                            <p className="mt-1 text-slate-600">
                              {candidate.current_title || "Current title not entered"}
                            </p>
                            <p className="mt-1 text-slate-600">
                              Roles:{" "}
                              {candidate.role_titles.length > 0
                                ? candidate.role_titles.join(", ")
                                : "Not assigned"}
                            </p>
                            <p className="mt-1 text-slate-600">
                              Mentors:{" "}
                              {candidate.mentor_names.length > 0
                                ? candidate.mentor_names.join(", ")
                                : "Not assigned"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-4 py-2 text-xs font-semibold ${getStageClasses(
                              candidate.stage,
                            )}`}
                          >
                            {candidate.stage}
                          </span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                      No candidates are in the system yet.
                    </article>
                  )}
                </div>
              </div>
            </section>

            <MentorDirectoryManager mentors={snapshot.mentors} />
          </>
        )}
      </div>
    </main>
  );
}
