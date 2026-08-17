import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { buildCandidateProgressReportDocumentBuffer } from "@/lib/candidate-progress-report-document";
import {
  isAdminAppRole,
  isCandidateSelfAccess,
  mentorHasCandidateAccess,
} from "@/lib/mentor-access";
import { isMissingLeadershipDevelopmentRecordTableError } from "@/lib/leadership-development-record";

const payloadSchema = z
  .object({
    period: z.enum(["year-to-date", "selected-year", "program-start"]),
    year: z.number().int().min(2000).max(2100).optional(),
  })
  .superRefine((payload, context) => {
    if (payload.period === "selected-year" && !payload.year) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a year for this report.",
        path: ["year"],
      });
    }
  });

function isInYear(value: string | null, year: number) {
  return Boolean(value && new Date(value).getFullYear() === year);
}

function formatScore(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(1)} / 5`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "candidate-progress-report"
  );
}

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  try {
    const { candidateId } = await context.params;
    if (!z.string().uuid().safeParse(candidateId).success) {
      throw new ApiRouteError("Candidate not found.", 404);
    }

    const payload = payloadSchema.parse(await request.json());
    const { account, admin, profile } = await requireApiWorkspaceProfile();
    const currentYear = new Date().getFullYear();
    const reportingYear = payload.period === "year-to-date" ? currentYear : payload.year;
    const reportingPeriodLabel =
      payload.period === "year-to-date"
        ? `${currentYear} Year to Date`
        : payload.period === "selected-year"
          ? String(payload.year)
          : "Since Program Start";
    const narrativePeriod =
      payload.period === "year-to-date"
        ? `the ${currentYear} calendar year to date`
        : payload.period === "selected-year"
          ? String(payload.year)
          : "the full program period";

    const [
      candidateResult,
      mentorAssignmentsResult,
      considerationsResult,
      panelsResult,
      mentorReportsResult,
      developmentRecordsResult,
      matchesResult,
      decisionsResult,
    ] = await Promise.all([
      admin
        .from("candidates")
        .select("id, full_name")
        .eq("organization_id", profile.organization_id)
        .eq("id", candidateId)
        .maybeSingle(),
      admin
        .from("mentor_role_assignments")
        .select("candidate_id, role_id, mentor_profile_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
      admin
        .from("candidate_role_considerations")
        .select("role_id, status")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
      admin
        .from("interview_panels")
        .select("id, role_id, panel_name, date_completed, created_at")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
      admin
        .from("mentor_reports")
        .select("created_at")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
      admin
        .from("development_records")
        .select("role_id, status, experience_title, project_summary, date_assigned, updated_at, mentor_review_date")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId)
        .is("archived_at", null),
      admin
        .from("candidate_role_matches")
        .select("role_id, match_status, created_at")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
      admin
        .from("hiring_decisions")
        .select("role_id, decision, created_at")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId),
    ]);

    for (const result of [
      candidateResult,
      mentorAssignmentsResult,
      considerationsResult,
      panelsResult,
      mentorReportsResult,
      matchesResult,
      decisionsResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data) {
      throw new ApiRouteError("Candidate not found.", 404);
    }

    const mentorHasAccess = mentorHasCandidateAccess({
      profileId: profile.id,
      candidateId,
      mentorAssignments: mentorAssignmentsResult.data ?? [],
    });
    if (
      !isAdminAppRole(profile.role) &&
      !isCandidateSelfAccess(account, candidateId) &&
      !mentorHasAccess
    ) {
      throw new ApiRouteError(
        "You do not have access to download this candidate's progress report.",
        403,
      );
    }

    const developmentRecords = developmentRecordsResult.error
      ? isMissingLeadershipDevelopmentRecordTableError(developmentRecordsResult.error)
        ? []
        : (() => {
            throw new ApiRouteError(developmentRecordsResult.error.message, 500);
          })()
      : developmentRecordsResult.data ?? [];
    const roleIds = Array.from(
      new Set([
        ...(considerationsResult.data ?? []).map((item) => item.role_id),
        ...(panelsResult.data ?? []).map((item) => item.role_id),
        ...developmentRecords.map((item) => item.role_id),
      ]),
    );
    const rolesResult = roleIds.length
      ? await admin
          .from("roles")
          .select("id, title")
          .eq("organization_id", profile.organization_id)
          .in("id", roleIds)
      : { data: [], error: null };
    if (rolesResult.error) {
      throw new ApiRouteError(rolesResult.error.message, 500);
    }
    const roleMap = new Map((rolesResult.data ?? []).map((role) => [role.id, role.title]));

    const panelIds = (panelsResult.data ?? []).map((panel) => panel.id);
    const scoresResult = panelIds.length
      ? await admin.from("interview_scores").select("panel_id, score_numeric").in("panel_id", panelIds)
      : { data: [], error: null };
    if (scoresResult.error) {
      throw new ApiRouteError(scoresResult.error.message, 500);
    }
    const scoresByPanel = new Map<string, number[]>();
    for (const score of scoresResult.data ?? []) {
      const scores = scoresByPanel.get(score.panel_id) ?? [];
      scores.push(score.score_numeric);
      scoresByPanel.set(score.panel_id, scores);
    }

    const interviews = (panelsResult.data ?? []).map((panel) => {
      const scores = scoresByPanel.get(panel.id) ?? [];
      return {
        occurredAt: panel.date_completed ?? panel.created_at,
        averageScore:
          scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null,
      };
    });
    const filteredByPeriod = <T extends { occurredAt: string }>(items: T[]) =>
      payload.period === "program-start"
        ? items
        : items.filter((item) => isInYear(item.occurredAt, reportingYear!));
    const periodInterviews = filteredByPeriod(interviews);
    const periodDevelopmentRecords = filteredByPeriod(
      developmentRecords.map((record) => ({
        roleTitle: roleMap.get(record.role_id) ?? "Unknown role",
        title: record.experience_title,
        summary: record.project_summary,
        status: record.status,
        occurredAt: record.updated_at ?? record.date_assigned,
        mentorReviewed: Boolean(record.mentor_review_date),
      })),
    );
    const periodMentorReportCount = (mentorReportsResult.data ?? []).filter(
      (report) => payload.period === "program-start" || isInYear(report.created_at, reportingYear!),
    ).length;
    const periodDecisionEvents = (decisionsResult.data ?? []).filter(
      (decision) => payload.period === "program-start" || isInYear(decision.created_at, reportingYear!),
    );
    const scoredInterviews = periodInterviews
      .filter((item) => item.averageScore !== null)
      .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());
    const latestScore = scoredInterviews.at(-1)?.averageScore ?? null;
    const earliestScore = scoredInterviews[0]?.averageScore ?? null;
    const scoreChange =
      earliestScore !== null && latestScore !== null && scoredInterviews.length > 1
        ? latestScore - earliestScore
        : null;
    const completedDevelopmentRecords = periodDevelopmentRecords.filter(
      (record) => record.status === "completed",
    ).length;
    const activeRoleTitles = (considerationsResult.data ?? [])
      .filter((consideration) => consideration.status === "active")
      .map((consideration) => roleMap.get(consideration.role_id) ?? "Unknown role");
    const roleContext = activeRoleTitles.length > 0 ? activeRoleTitles.join(activeRoleTitles.length === 2 ? " and " : ", ") : undefined;
    const activity: string[] = [];
    if (periodInterviews.length > 0) activity.push(`${periodInterviews.length} interview round${periodInterviews.length === 1 ? " was" : "s were"} recorded`);
    if (periodDevelopmentRecords.length > 0) activity.push(`${periodDevelopmentRecords.length} development record${periodDevelopmentRecords.length === 1 ? " was" : "s were"} maintained${completedDevelopmentRecords > 0 ? `, with ${completedDevelopmentRecords} completed` : ""}`);
    if (periodMentorReportCount > 0) activity.push(`${periodMentorReportCount} mentor report${periodMentorReportCount === 1 ? " was" : "s were"} added`);
    if (periodDecisionEvents.length > 0) activity.push(`${periodDecisionEvents.length} formal leadership decision${periodDecisionEvents.length === 1 ? " was" : "s were"} documented`);
    const trend =
      scoreChange === null
        ? periodInterviews.length > 0
          ? "Interview feedback is available, though another scored interview will make the change over time clearer."
          : "No interview feedback has been recorded in this period yet."
        : scoreChange > 0.15
          ? "Interview feedback indicates meaningful improvement from the first recorded assessment."
          : scoreChange < -0.15
            ? "Interview feedback indicates an area for renewed attention compared with the first recorded assessment."
            : "Interview feedback has remained broadly consistent across the recorded assessments.";
    const narrative = `${candidateResult.data.full_name}${roleContext ? ` is currently being considered for ${roleContext}.` : " has no active role consideration recorded."} During ${narrativePeriod}, ${activity.length > 0 ? `${activity.join("; ")}.` : "no mentoring, development, interview, or decision activity was recorded."} ${trend}`;

    const activityEvents = [
      ...(panelsResult.data ?? []).map((panel) => ({ occurredAt: panel.date_completed ?? panel.created_at, label: "Interview round recorded", detail: panel.panel_name })),
      ...developmentRecords.map((record) => ({ occurredAt: record.updated_at ?? record.date_assigned, label: "Development record updated", detail: record.experience_title ?? "Development record" })),
      ...(mentorReportsResult.data ?? []).map((report) => ({ occurredAt: report.created_at, label: "Mentor report added", detail: "Mentor feedback was recorded." })),
      ...(matchesResult.data ?? []).map((match) => ({ occurredAt: match.created_at, label: "Role-match assessment recorded", detail: `${roleMap.get(match.role_id) ?? "Role"}: ${match.match_status.replaceAll("_", " ")}` })),
      ...(decisionsResult.data ?? []).map((decision) => ({ occurredAt: decision.created_at, label: "Leadership decision recorded", detail: `${roleMap.get(decision.role_id) ?? "Role"}: ${decision.decision.replaceAll("_", " ")}` })),
    ];
    const periodEvents = filteredByPeriod(activityEvents)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 6);

    const buffer = await buildCandidateProgressReportDocumentBuffer({
      candidateName: candidateResult.data.full_name,
      periodLabel: reportingPeriodLabel,
      narrative,
      scorecard: [
        { measure: "Interview rounds", value: periodInterviews.length },
        { measure: "Latest interview average", value: formatScore(latestScore) },
        { measure: "Change in interview average", value: scoreChange === null ? "More data needed" : `${scoreChange >= 0 ? "+" : ""}${scoreChange.toFixed(1)}` },
        { measure: "Development records", value: periodDevelopmentRecords.length },
        { measure: "Completed development records", value: completedDevelopmentRecords },
        { measure: "Mentor reports", value: periodMentorReportCount },
      ],
      developmentRecords: periodDevelopmentRecords
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
      events: periodEvents,
    });
    const fileName = `${slugify(candidateResult.data.full_name)}-${reportingPeriodLabel.toLowerCase().replaceAll(" ", "-")}-progress-report.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to generate the candidate progress report Word document.");
  }
}
