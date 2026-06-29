import Link from "next/link";
import { redirect } from "next/navigation";
import { CandidateDetailSectionMenu } from "@/components/candidate-detail-section-menu";
import { CandidateInsightExplorer } from "@/components/candidate-insight-explorer";
import { MentorReportMatchExplorer } from "@/components/mentor-report-match-explorer";
import { CandidateStrengthsUploadCard } from "@/components/candidate-strengths-upload-card";
import { GenerateMentorReportButton } from "@/components/generate-mentor-report-button";
import { InterviewScoreEntryPanel } from "@/components/interview-score-entry-panel";
import {
  formatFileSize,
  getCandidateSourceDocumentsBucket,
  getStrengthsUploadDocumentCategory,
} from "@/lib/candidate-source-documents";
import { hasOpenAIEnv } from "@/lib/env";
import {
  buildCompetencyAssessments,
  categorizeStrengths,
  computeOverallReadiness,
  rankMentoringIdeasForCompetency,
  type DevelopmentProjectRecord,
} from "@/lib/fit-analysis";
import { isAdminAppRole } from "@/lib/mentor-access";
import {
  buildRoleMatchesWeakestToStrongest,
  MentorReport,
} from "@/lib/mentor-report";
import { syncCandidateRoleStrengthAssessments } from "@/lib/strengths-role-fit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeAppText } from "@/lib/text-sanitizer";
import { requireWorkspaceProfile } from "@/lib/workspace";

type CandidateDetailPageProps = {
  params: Promise<{
    candidateId: string;
  }>;
  searchParams: Promise<{
    roleId?: string;
    section?: string;
  }>;
};

export default async function CandidateDetailPage({
  params,
  searchParams,
}: CandidateDetailPageProps) {
  const { candidateId } = await params;
  const { roleId: requestedRoleId, section: requestedSection } =
    await searchParams;
  const { profile, supabase } = await requireWorkspaceProfile();
  const canGenerateReport = hasOpenAIEnv();
  const admin = createSupabaseAdminClient();

  const [
    candidateResult,
    considerationsResult,
    mentorAssignmentsResult,
    mentorProfilesResult,
    rolesResult,
    strengthsResult,
    sourceDocumentsResult,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, current_title, target_role_id, status")
      .eq("organization_id", profile.organization_id)
      .eq("id", candidateId)
      .single(),
    supabase
      .from("candidate_role_considerations")
      .select("candidate_id, role_id, is_primary, status")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true }),
    supabase
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id, status, start_date, notes")
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId),
    supabase
      .from("profiles")
      .select("id, full_name, position_title")
      .eq("organization_id", profile.organization_id)
      .eq("role", "mentor"),
    supabase
      .from("roles")
      .select("id, title, description")
      .eq("organization_id", profile.organization_id),
    supabase
      .from("candidate_strengths")
      .select("theme_name, rank, domain")
      .eq("candidate_id", candidateId)
      .order("rank", { ascending: true }),
    supabase
      .from("candidate_source_documents")
      .select(
        "id, document_category, file_name, file_extension, mime_type, file_size_bytes, storage_bucket, storage_path, extracted_text, created_at",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("document_category", getStrengthsUploadDocumentCategory())
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [
    candidateResult,
    considerationsResult,
    mentorAssignmentsResult,
    mentorProfilesResult,
    rolesResult,
    strengthsResult,
    sourceDocumentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const candidate = candidateResult.data;

  if (!candidate) {
    throw new Error("Candidate could not be loaded.");
  }

  const considerations = considerationsResult.data ?? [];
  const mentorAssignments = mentorAssignmentsResult.data ?? [];
  const roleMap = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
  const mentorMap = new Map(
    (mentorProfilesResult.data ?? []).map((mentor) => [mentor.id, mentor]),
  );
  const displayableMentorAssignments = mentorAssignments.filter((assignment) =>
    mentorMap.has(assignment.mentor_profile_id),
  );

  const accessibleRoleIds = isAdminAppRole(profile.role)
    ? considerations.map((item) => item.role_id)
    : displayableMentorAssignments
        .filter((assignment) => assignment.mentor_profile_id === profile.id)
        .map((assignment) => assignment.role_id);

  if (!isAdminAppRole(profile.role) && accessibleRoleIds.length === 0) {
    redirect("/candidates?message=You+do+not+have+access+to+that+candidate");
  }

  const allowedRoleIds = new Set(
    isAdminAppRole(profile.role) ? considerations.map((item) => item.role_id) : accessibleRoleIds,
  );
  const primaryConsideration =
    considerations.find((item) => item.is_primary) ??
    considerations[0] ??
    (candidate.target_role_id
      ? {
          candidate_id: candidate.id,
          role_id: candidate.target_role_id,
          is_primary: true,
          status: "active",
        }
      : null);
  const activeRoleId =
    (requestedRoleId && allowedRoleIds.has(requestedRoleId) ? requestedRoleId : null) ??
    (primaryConsideration && allowedRoleIds.has(primaryConsideration.role_id)
      ? primaryConsideration.role_id
      : null) ??
    allowedRoleIds.values().next().value ??
    null;

  const [
    roleResult,
    competenciesResult,
    panelsResult,
    latestReportResult,
    strengthAssessmentsResult,
    projectsResult,
  ] =
    activeRoleId
      ? await Promise.all([
          supabase
            .from("roles")
            .select("id, title, description")
            .eq("organization_id", profile.organization_id)
            .eq("id", activeRoleId)
            .maybeSingle(),
          supabase
            .from("role_competencies")
            .select("id, name, target_score, weight")
            .eq("organization_id", profile.organization_id)
            .eq("role_id", activeRoleId)
            .order("created_at", { ascending: true }),
          supabase
            .from("interview_panels")
            .select("id, panel_name, date_completed")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId),
          supabase
            .from("mentor_reports")
            .select("id, version, created_at, report_json")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("candidate_role_strength_assessments")
            .select("competency_id, strength_score, supporting_strengths, rationale")
            .eq("organization_id", profile.organization_id)
            .eq("candidate_id", candidate.id)
            .eq("role_id", activeRoleId),
          supabase
            .from("development_projects")
            .select(
              "title, description, difficulty, duration_days, applicable_roles, competencies_developed, strengths_leveraged, expected_outcomes, mentor_questions, evidence_of_success",
            )
            .or(`organization_id.is.null,organization_id.eq.${profile.organization_id}`),
        ])
      : [
          { data: null, error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  for (const result of [
    roleResult,
    competenciesResult,
    panelsResult,
    latestReportResult,
    strengthAssessmentsResult,
    projectsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
  const scoresResult =
    panelIds.length > 0
      ? await supabase
          .from("interview_scores")
          .select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes")
          .in("panel_id", panelIds)
      : { data: [], error: null };

  if (scoresResult.error) {
    throw new Error(scoresResult.error.message);
  }

  let strengthAssessments = (strengthAssessmentsResult.data ?? []).map((assessment) => ({
    competency_id: assessment.competency_id,
    strength_score: Number(assessment.strength_score),
    supporting_strengths: assessment.supporting_strengths as string[],
    rationale: assessment.rationale,
  }));

  if (
    activeRoleId &&
    roleResult.data &&
    (competenciesResult.data ?? []).length > 0 &&
    (strengthsResult.data ?? []).length > 0 &&
    strengthAssessments.length === 0 &&
    hasOpenAIEnv()
  ) {
    try {
      const strengthsLibraryResult = await admin
        .from("strengths_library")
        .select(
          "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
        )
        .order("theme_name", { ascending: true });

      if (strengthsLibraryResult.error) {
        throw strengthsLibraryResult.error;
      }

      strengthAssessments = await syncCandidateRoleStrengthAssessments({
        admin,
        organizationId: profile.organization_id,
        candidateId: candidate.id,
        roleId: activeRoleId,
        candidateName: candidate.full_name,
        roleTitle: roleResult.data.title,
        roleDescription: roleResult.data.description,
        competencies: (competenciesResult.data ?? []).map((competency) => ({
          ...competency,
          behavioral_indicators: [],
          red_flags: [],
        })),
        strengths: strengthsResult.data ?? [],
        strengthsLibrary: (strengthsLibraryResult.data ?? []).map((theme) => ({
          theme_name: theme.theme_name,
          domain: theme.domain,
          leadership_advantages: theme.leadership_advantages,
          possible_blind_spots: theme.possible_blind_spots,
          development_uses: theme.development_uses,
        })),
      });
    } catch (error) {
      console.error("Unable to refresh strengths-based readiness scoring.", error);
    }
  }

  const assessments = buildCompetencyAssessments(
    competenciesResult.data ?? [],
    scoresResult.data ?? [],
    strengthAssessments,
  );
  const existingPanels = (panelsResult.data ?? []).map((panel) => {
    const panelScores = (scoresResult.data ?? []).filter(
      (score) => score.panel_id === panel.id,
    );
    const averageScore =
      panelScores.length > 0
        ? panelScores.reduce((sum, score) => sum + score.score_numeric, 0) /
          panelScores.length
        : null;

    return {
      id: panel.id,
      panelName: panel.panel_name,
      dateCompleted: panel.date_completed,
      averageScore: averageScore !== null ? Number(averageScore.toFixed(2)) : null,
    };
  });
  const readiness = computeOverallReadiness(assessments);
  const roleMatchesWeakestToStrongest =
    buildRoleMatchesWeakestToStrongest(assessments);
  const strengthBuckets = categorizeStrengths(strengthsResult.data ?? []);
  const leverageStrengths = strengthBuckets.primary.map((strength) => strength.theme_name);
  const rankedStrengthThemeNames = (strengthsResult.data ?? []).map(
    (strength) => strength.theme_name,
  );
  const strengthsReferenceResult =
    rankedStrengthThemeNames.length > 0
      ? await supabase
          .from("strengths_library")
          .select(
            "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
          )
          .in("theme_name", rankedStrengthThemeNames)
      : { data: [], error: null };

  if (strengthsReferenceResult.error) {
    throw new Error(strengthsReferenceResult.error.message);
  }

  const developmentProjects = ((projectsResult.data ?? []) as DevelopmentProjectRecord[]).map(
    (project) => ({
      ...project,
      applicable_roles: (project.applicable_roles as string[]) ?? [],
      competencies_developed: (project.competencies_developed as string[]) ?? [],
      strengths_leveraged: (project.strengths_leveraged as string[]) ?? [],
      expected_outcomes: (project.expected_outcomes as string[]) ?? [],
      mentor_questions: (project.mentor_questions as string[]) ?? [],
      evidence_of_success: (project.evidence_of_success as string[]) ?? [],
    }),
  );
  const mentoringIdeasByCompetencyId = new Map(
    assessments.map((assessment) => [
      assessment.competencyId,
      rankMentoringIdeasForCompetency(developmentProjects, {
        roleTitle: roleResult.data?.title ?? "",
        competencyName: assessment.competencyName,
        supportingStrengths: assessment.supportingStrengths,
        leverageStrengths,
        readiness,
      }).slice(0, 4),
    ]),
  );

  const latestReport = (latestReportResult.data?.report_json ??
    null) as MentorReport | null;
  const mentoringIdeasByCompetencyIdObject = Object.fromEntries(
    Array.from(mentoringIdeasByCompetencyId.entries()),
  );

  const sourceDocuments = await Promise.all(
    (sourceDocumentsResult.data ?? []).map(async (document) => {
      const signedUrlResult = await admin.storage
        .from(document.storage_bucket || getCandidateSourceDocumentsBucket())
        .createSignedUrl(document.storage_path, 60 * 60);

      return {
        ...document,
        signedUrl: signedUrlResult.data?.signedUrl ?? null,
      };
    }),
  );
  const activeRoleMentorNames = activeRoleId
    ? Array.from(
        new Set(
          displayableMentorAssignments
            .filter((assignment) => assignment.role_id === activeRoleId)
            .map((assignment) => mentorMap.get(assignment.mentor_profile_id)?.full_name)
            .filter(Boolean),
        ),
      )
    : [];
  const candidateWorkspaceDetailItems = [
    `Current title: ${candidate.current_title}`,
    `Active role: ${roleResult.data?.title ?? "No role selected"}`,
    `Weighted readiness: ${readiness.toFixed(2)} / 5`,
    `Mentors: ${
      activeRoleMentorNames.length > 0
        ? activeRoleMentorNames.join(", ")
        : "Not assigned yet"
    }`,
  ];

  return (
    <main className="flex-1 bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <CandidateDetailSectionMenu
          initialSectionId={requestedSection}
          candidateName={candidate.full_name}
          detailItems={candidateWorkspaceDetailItems}
          sections={[
            {
              id: "role-context",
              label: "Role Context",
              summary:
                "Review the roles this candidate is being considered for and the mentors currently assigned to the active role.",
              content: (
                <section className="grid gap-6">
                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Roles Under Consideration
                    </p>
                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                      {considerations.length > 0 ? (
                        considerations
                          .filter((item) => allowedRoleIds.has(item.role_id))
                          .map((consideration) => {
                            const role = roleMap.get(consideration.role_id);
                            const assignedMentors = Array.from(
                              new Set(
                                displayableMentorAssignments
                                  .filter(
                                    (assignment) =>
                                      assignment.role_id === consideration.role_id,
                                  )
                                  .map(
                                    (assignment) =>
                                      mentorMap.get(assignment.mentor_profile_id)?.full_name,
                                  )
                                  .filter(Boolean),
                              ),
                            );

                            return (
                              <Link
                                key={consideration.role_id}
                                href={`/candidates/${candidate.id}?roleId=${consideration.role_id}`}
                                className={`rounded-3xl border p-5 text-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${
                                  activeRoleId === consideration.role_id
                                    ? "border-teal-300 bg-teal-50"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <p className="font-semibold text-slate-900">
                                  {role?.title ?? "Unknown role"}
                                </p>
                                <p className="mt-2 text-slate-600">
                                  Status: {consideration.status}
                                </p>
                                <p className="mt-2 text-slate-600">
                                  Mentors:{" "}
                                  {assignedMentors.length > 0
                                    ? assignedMentors.join(", ")
                                    : "Not assigned"}
                                </p>
                              </Link>
                            );
                          })
                      ) : (
                        <article className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600 lg:col-span-3">
                          No role considerations are attached to this candidate yet.
                        </article>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Active Mentors for This Role
                    </p>
                    <div className="mt-6 grid gap-3">
                      {activeRoleId &&
                      displayableMentorAssignments.filter(
                        (assignment) => assignment.role_id === activeRoleId,
                      ).length > 0 ? (
                        displayableMentorAssignments
                          .filter((assignment) => assignment.role_id === activeRoleId)
                          .map((assignment) => {
                            const mentor = mentorMap.get(assignment.mentor_profile_id);

                            return (
                              <article
                                key={`${assignment.role_id}-${assignment.mentor_profile_id}`}
                                className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700"
                              >
                                <p className="font-semibold text-slate-900">
                                  {mentor?.full_name}
                                </p>
                                <p className="mt-1 text-slate-600">
                                  {mentor?.position_title ?? "Position not entered"}
                                </p>
                                <p className="mt-1 text-slate-600">
                                  Start date: {assignment.start_date || "Not set"}
                                </p>
                              </article>
                            );
                          })
                      ) : (
                        <p className="text-sm leading-7 text-slate-600">
                          No mentors are assigned to this candidate for the selected
                          role yet.
                        </p>
                      )}
                    </div>
                  </section>
                </section>
              ),
            },
            {
              id: "interview-scores",
              label: "Interview Scores",
              summary:
                "Enter interviewer feedback, save decimal scores, and adjust target scores for each competency.",
              content: (
                <InterviewScoreEntryPanel
                  candidateId={candidate.id}
                  roleId={activeRoleId}
                  roleTitle={roleResult.data?.title ?? null}
                  competencies={(competenciesResult.data ?? []).map((competency) => ({
                    id: competency.id,
                    name: competency.name,
                    targetScore: competency.target_score,
                  }))}
                  existingPanels={existingPanels}
                />
              ),
            },
            {
              id: "role-fit",
              label: "Role Fit",
              summary:
                "Focus on the candidate’s role-fit competencies and all 34 strengths, one insight at a time.",
              content: (
                <CandidateInsightExplorer
                  assessments={assessments.map((assessment) => ({
                    ...assessment,
                    mentoringIdeas:
                      mentoringIdeasByCompetencyId.get(assessment.competencyId) ?? [],
                  }))}
                  strengths={strengthsResult.data ?? []}
                  references={strengthsReferenceResult.data ?? []}
                  canGenerateCandidateIdeas={canGenerateReport && Boolean(activeRoleId)}
                  candidateId={candidate.id}
                  candidateName={candidate.full_name}
                  roleId={activeRoleId ?? undefined}
                />
              ),
            },
            {
              id: "strengths-files",
              label: "Strengths Files",
              summary:
                "Review the archived Gallup documents for this candidate and upload additional strengths files when needed.",
              content: (
                <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Uploaded Source Documents
                    </p>
                    <h2 className="mt-3 font-display text-3xl text-slate-900">
                      Gallup files on record
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      Every Gallup file archived for this candidate appears here.
                      You can open each file in a separate browser tab and keep
                      adding more files over time.
                    </p>

                    {sourceDocuments.length > 0 ? (
                      <div className="mt-6 grid gap-4">
                        {sourceDocuments.map((document) => (
                          <article
                            key={document.id}
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">
                                  {document.file_name}
                                </h3>
                                <p className="mt-2 text-sm text-slate-600">
                                  {document.file_extension.toUpperCase()} •{" "}
                                  {formatFileSize(document.file_size_bytes)} • Uploaded{" "}
                                  {new Date(document.created_at).toLocaleString("en-US", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </div>
                              {document.signedUrl ? (
                                <Link
                                  href={document.signedUrl}
                                  target="_blank"
                                  className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                                >
                                  Open File
                                </Link>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                        No source documents have been archived for this candidate
                        yet.
                      </div>
                    )}
                  </section>

                  <CandidateStrengthsUploadCard
                    candidateId={candidate.id}
                    candidateName={candidate.full_name}
                  />
                </section>
              ),
            },
            {
              id: "mentor-report",
              label: "Mentor Report",
              summary:
                "Review the latest mentor-facing narrative, including strongest matches and development priorities.",
              content: (
                <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                        Mentor Report
                      </p>
                      <h2 className="mt-2 font-display text-4xl text-slate-900">
                        Latest mentor-facing development narrative
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        This report is built from the candidate&apos;s current
                        strengths data and the latest average interview scores saved
                        across the selected role&apos;s competencies.
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 md:items-end">
                      {latestReportResult.data ? (
                        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                          Version {latestReportResult.data.version}
                        </span>
                      ) : null}
                      <GenerateMentorReportButton
                        candidateId={candidate.id}
                        roleId={activeRoleId}
                        disabled={!canGenerateReport}
                        hasExistingReport={Boolean(latestReportResult.data)}
                      />
                    </div>
                  </div>

                  {latestReport ? (
                    <div className="mt-8 grid gap-6">
                      <article className="rounded-3xl bg-slate-50 p-6">
                        <h3 className="text-xl font-semibold text-slate-900">
                          Executive Summary
                        </h3>
                        <p className="mt-4 text-sm leading-7 text-slate-700">
                          {sanitizeAppText(latestReport.executive_summary)}
                        </p>
                      </article>

                      <MentorReportMatchExplorer
                        matches={roleMatchesWeakestToStrongest}
                        developmentPriorities={latestReport.development_priorities}
                        strengthsToLeverage={latestReport.strengths_to_leverage}
                        assessments={assessments}
                        libraryIdeasByCompetencyId={mentoringIdeasByCompetencyIdObject}
                        candidateId={candidate.id}
                        candidateName={candidate.full_name}
                        roleId={activeRoleId}
                        canGenerateCandidateIdeas={
                          canGenerateReport && Boolean(activeRoleId)
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                      No mentor report has been generated yet for this candidate and
                      role combination.
                    </div>
                  )}
                </section>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
