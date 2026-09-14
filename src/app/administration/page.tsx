import Link from "next/link";
import { redirect } from "next/navigation";
import { AdministrationPanel } from "@/components/administration-panel";
import { CompanyMentorRankings, type CompanyMentorRanking } from "@/components/company-mentor-rankings";
import { getCandidateDisplayName } from "@/lib/candidate-display-name";
import { isAdminAppRole } from "@/lib/mentor-access";
import { loadAdministrationUsers } from "@/lib/organization-user-admin";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";
import { computeMentorScorecard } from "@/lib/mentor-scorecard";

type AdministrationPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    section?: string;
  }>;
};

export default async function AdministrationPage({
  searchParams,
}: AdministrationPageProps) {
  const { profile } = await requireWorkspaceProfile();
  const {
    organizationId: requestedOrganizationId,
    section: requestedSection,
  } = await searchParams;

  if (!isAdminAppRole(profile.role)) {
    redirect("/dashboard?message=Administration+is+available+to+organization+admins+only.");
  }

  const admin = createSupabaseAdminClient();
  const isSystemAdmin = profile.role === "system_admin";
  const organizationsResult = isSystemAdmin
    ? await admin
        .from("organizations")
        .select(
          "id, name, industry, subscription_status, billing_contact_email, leadership_continuity_enabled, leadership_continuity_tier, leadership_help_enabled, leadership_help_tier, included_seats, additional_seat_packs, hide_billing_controls, benchmark_contribution_enabled",
        )
        .order("name", { ascending: true })
    : await admin
        .from("organizations")
        .select(
          "id, name, industry, subscription_status, billing_contact_email, leadership_continuity_enabled, leadership_continuity_tier, leadership_help_enabled, leadership_help_tier, included_seats, additional_seat_packs, hide_billing_controls, benchmark_contribution_enabled",
        )
        .eq("id", profile.organization_id)
        .order("name", { ascending: true });

  if (organizationsResult.error) {
    throw new Error(organizationsResult.error.message);
  }

  const organizations = organizationsResult.data ?? [];
  const selectedOrganization =
    (requestedOrganizationId &&
      organizations.find((organization) => organization.id === requestedOrganizationId)) ||
    organizations.find((organization) => organization.id === profile.organization_id) ||
    organizations[0] ||
    null;

  if (!selectedOrganization) {
    throw new Error("No organization could be loaded for administration.");
  }

  const [users, candidatesResult, rolesResult, mentorsResult, mentorAssignmentsResult, mentorReportsResult, developmentRecordsResult] = await Promise.all([
    loadAdministrationUsers({
      admin,
      organizationId: selectedOrganization.id,
    }),
    admin
      .from("candidates")
      .select("id, full_name")
      .eq("organization_id", selectedOrganization.id)
      .order("full_name", { ascending: true }),
    admin
      .from("roles")
      .select("id, title")
      .eq("organization_id", selectedOrganization.id)
      .order("title", { ascending: true }),
    admin
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", selectedOrganization.id)
      .order("full_name", { ascending: true }),
    admin
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id, status")
      .eq("organization_id", selectedOrganization.id),
    admin
      .from("mentor_reports")
      .select("candidate_id, role_id, created_at")
      .eq("organization_id", selectedOrganization.id)
      .order("created_at", { ascending: false }),
    admin
      .from("development_records")
      .select("candidate_id, role_id, mentor_id, mentor_review_date, updated_at")
      .eq("organization_id", selectedOrganization.id)
      .order("updated_at", { ascending: false }),
  ]);

  for (const result of [candidatesResult, rolesResult, mentorsResult, mentorAssignmentsResult, mentorReportsResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const summary = {
    activeCandidates: users.filter(
      (user) => user.status === "active" && user.is_candidate,
    ).length,
    activeMentors: users.filter(
      (user) => user.status === "active" && user.is_mentor,
    ).length,
    suspendedUsers: users.filter((user) => user.status === "suspended").length,
    pendingInvitations: users.filter((user) => user.status === "invited").length,
  };
  const activeMentorProfileIds = new Set<string>(
    users
      .filter(
        (user) =>
          user.is_mentor &&
          user.status === "active" &&
          user.profile_id !== null,
      )
      .map((user) => user.profile_id)
      .filter((id): id is string => Boolean(id)),
  );

  const mentorDirectory = mentorsResult.data ?? [];
  const rankingIds = new Set(activeMentorProfileIds);
  for (const assignment of mentorAssignmentsResult.data ?? []) {
    if (typeof assignment.mentor_profile_id === "string" && assignment.status !== "completed" && assignment.status !== "cancelled") {
      rankingIds.add(assignment.mentor_profile_id);
    }
  }
  const latestReportByTrack = new Map<string, string>();
  for (const report of mentorReportsResult.data ?? []) {
    const key = `${report.candidate_id}:${report.role_id}`;
    if (!latestReportByTrack.has(key)) latestReportByTrack.set(key, report.created_at);
  }
  const latestRecordByTrack = new Map<string, { mentor_review_date: string | null }>();
  for (const record of developmentRecordsResult.data ?? []) {
    const key = `${record.candidate_id}:${record.role_id}:${record.mentor_id}`;
    if (!latestRecordByTrack.has(key)) latestRecordByTrack.set(key, record);
  }
  const mentorRankings: CompanyMentorRanking[] = Array.from(rankingIds).map((mentorId) => {
    const tracks = (mentorAssignmentsResult.data ?? []).filter(
      (assignment) => assignment.mentor_profile_id === mentorId && assignment.status !== "completed" && assignment.status !== "cancelled",
    );
    const scorecard = computeMentorScorecard(
      tracks.map((assignment) => {
        const record = latestRecordByTrack.get(`${assignment.candidate_id}:${assignment.role_id}:${mentorId}`);
        return {
          hasDevelopmentRecord: Boolean(record),
          latestReportAt: latestReportByTrack.get(`${assignment.candidate_id}:${assignment.role_id}`) ?? null,
          latestReviewAt: record?.mentor_review_date ?? null,
        };
      }),
    );
    const mentor = mentorDirectory.find((entry) => entry.id === mentorId);
    return { mentorId, mentorName: mentor?.full_name ?? "Mentor name not entered", positionTitle: mentor?.position_title ?? null, score: scorecard.score, tier: scorecard.tier, activeTrackCount: scorecard.activeTrackCount };
  }).sort((left, right) => right.score - left.score || left.mentorName.localeCompare(right.mentorName));

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <section className="theme-panel-strong rounded-[2rem] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                Administration
              </p>
              <h1 className="mt-3 font-display text-5xl leading-tight text-slate-950">
                Administration
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Manage companies, product access, candidates, mentors, and
                administrative access from one protected control surface while
                preserving historical leadership development data for reporting.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm leading-7 text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              {isSystemAdmin
                ? "System Admin can create companies, switch company context, and manage product access across the full platform."
                : "CEO Admin and Manager Admin currently share the same permissions inside their organization."}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { id: "user-access", label: "Add Users" },
              { id: "assign-mentors", label: "Assign Mentors" },
              { id: "organization-controls", label: "Organization Controls" },
            ].map((tab) => {
              const isActive = (requestedSection ?? "user-access") === tab.id;
              const href = `/administration?organizationId=${encodeURIComponent(selectedOrganization.id)}&section=${encodeURIComponent(tab.id)}`;

              return (
                <Link
                  key={tab.id}
                  href={href}
                  prefetch={true}
                  className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-900"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </section>

        <AdministrationPanel
          initialTab={
            requestedSection === "assign-mentors"
              ? "assign-mentors"
              : requestedSection === "organization-controls"
                ? "organization-controls"
                : requestedSection === "user-access"
                ? "user-access"
                : "user-access"
          }
          mentorAssignmentOptions={{
            candidates: (candidatesResult.data ?? []).map((candidate) => ({
              id: candidate.id,
              full_name: getCandidateDisplayName(candidate.full_name),
            })),
            roles: (rolesResult.data ?? []).map((role) => ({
              id: role.id,
              title: canonicalizeRoleTitle(role.title),
            })),
            mentors: (mentorsResult.data ?? [])
              .filter((mentor) => activeMentorProfileIds.has(mentor.id))
              .map((mentor) => ({
                id: mentor.id,
                full_name: mentor.full_name,
                position_title: mentor.position_title,
              })),
          }}
          users={users}
          summary={summary}
          organizations={organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            industry: organization.industry ?? null,
            subscription_status: organization.subscription_status,
            billing_contact_email: organization.billing_contact_email ?? null,
            leadership_continuity_enabled:
              organization.leadership_continuity_enabled,
            leadership_continuity_tier:
              organization.leadership_continuity_tier,
            leadership_help_enabled: organization.leadership_help_enabled,
            leadership_help_tier: organization.leadership_help_tier,
            benchmark_contribution_enabled:
              organization.benchmark_contribution_enabled ?? false,
            included_seats: organization.included_seats,
            additional_seat_packs: organization.additional_seat_packs,
            hide_billing_controls: organization.hide_billing_controls,
          }))}
          selectedOrganizationId={selectedOrganization.id}
          canEditOrganizationAccess={isAdminAppRole(profile.role)}
          canCreateOrganizations={isSystemAdmin}
        />
        {requestedSection === "assign-mentors" ? (
          <CompanyMentorRankings mentors={mentorRankings} isCompanyView={true} />
        ) : null}
      </div>
    </main>
  );
}
