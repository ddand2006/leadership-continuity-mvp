import Link from "next/link";
import type { MentorReport } from "@/lib/mentor-report";
import type { LeadershipDevelopmentRecordRecord } from "@/lib/leadership-development-record";
import { sanitizeAppText, sanitizeAppTextList } from "@/lib/text-sanitizer";

type MentoringReadinessReviewAssignment = {
  assignmentKey: string;
  candidateId: string;
  roleId: string;
  mentorProfileId: string | null;
  candidateName: string;
  currentTitle: string | null;
  roleTitle: string;
  mentorName: string;
  mentorPositionTitle: string | null;
  startDate: string | null;
  latestMentorReport: {
    id: string;
    version: number;
    createdAt: string;
    report: MentorReport;
  } | null;
  latestDevelopmentRecord: {
    id: string;
    status: LeadershipDevelopmentRecordRecord["status"];
    experienceTitle: string;
    dateAssigned: string;
    readinessSignal: LeadershipDevelopmentRecordRecord["readinessSignal"];
    averageFeedbackScore: number | null;
    mentorReviewDate: string;
    updatedAt: string;
    growthAreas: LeadershipDevelopmentRecordRecord["growthAreas"];
    assignmentReason: string;
    mentorImprovementObserved: string;
    mentorDevelopmentNeeded: string;
    nextRecommendedExperience: string;
  } | null;
};

type TrafficLightStatus = "green" | "yellow" | "red";

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet recorded";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatScore(value: number | null) {
  return value === null ? "Not yet scored" : `${value.toFixed(1)} / 5`;
}

function getReadinessScore(
  readinessSignal: LeadershipDevelopmentRecordRecord["readinessSignal"],
  averageFeedbackScore: number | null,
) {
  if (typeof averageFeedbackScore === "number") {
    return averageFeedbackScore;
  }

  switch (readinessSignal) {
    case "developing":
      return 2;
    case "progressing":
      return 3;
    case "near_role_ready":
      return 4;
    case "role_ready":
      return 5;
    default:
      return null;
  }
}

function getReadinessLabel(
  readinessSignal: LeadershipDevelopmentRecordRecord["readinessSignal"],
) {
  switch (readinessSignal) {
    case "developing":
      return "Developing";
    case "progressing":
      return "Progressing";
    case "near_role_ready":
      return "Near Role Ready";
    case "role_ready":
      return "Role Ready";
    default:
      return "No signal yet";
  }
}

function getReadinessTone(
  readinessSignal: LeadershipDevelopmentRecordRecord["readinessSignal"],
) {
  switch (readinessSignal) {
    case "role_ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "near_role_ready":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "progressing":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "developing":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getStatusLabel(status: LeadershipDevelopmentRecordRecord["status"] | null) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "ready_for_review":
      return "Ready for Review";
    case "completed":
      return "Completed";
    default:
      return "Not started";
  }
}

function getDateTrafficLightStatus(value: string | null): TrafficLightStatus {
  if (!value) {
    return "red";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "red";
  }

  const daysSince = Math.max(0, (Date.now() - timestamp) / 86_400_000);

  if (daysSince <= 30) {
    return "green";
  }

  return daysSince <= 60 ? "yellow" : "red";
}

function getCombinedTrafficLightStatus(
  statuses: TrafficLightStatus[],
): TrafficLightStatus {
  if (statuses.includes("red")) {
    return "red";
  }

  return statuses.includes("yellow") ? "yellow" : "green";
}

function getOverallStatusLabel(status: TrafficLightStatus) {
  return {
    green: "Overall status: On Track",
    yellow: "Overall status: Needs Attention",
    red: "Overall status: Overdue",
  }[status];
}

function getTimingStatusLabel(status: TrafficLightStatus) {
  return {
    green: "Current",
    yellow: "Due Soon",
    red: "Overdue",
  }[status];
}

function StatusIndicator({
  status,
  label,
}: {
  status: TrafficLightStatus;
  label: string;
}) {
  const tone = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
  }[status];

  return (
    <span
      aria-label={label}
      title={label}
      className="absolute bottom-5 left-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-600"
    >
      <span className={`h-3.5 w-3.5 rounded-full ring-4 ring-white ${tone}`} />
      {label}
    </span>
  );
}

function buildReadinessReviewHref(assignment: MentoringReadinessReviewAssignment) {
  const params = new URLSearchParams({
    section: "readiness-review",
    candidateId: assignment.candidateId,
    roleId: assignment.roleId,
  });

  if (assignment.mentorProfileId) {
    params.set("mentorProfileId", assignment.mentorProfileId);
  }

  return `/mentoring?${params.toString()}`;
}

function buildLeadershipRecordHref(assignment: MentoringReadinessReviewAssignment) {
  const params = new URLSearchParams({
    section: "leadership-development-record",
    candidateId: assignment.candidateId,
    roleId: assignment.roleId,
  });

  if (assignment.mentorProfileId) {
    params.set("mentorProfileId", assignment.mentorProfileId);
  }

  if (assignment.latestDevelopmentRecord?.id) {
    params.set("recordId", assignment.latestDevelopmentRecord.id);
  }

  return `/mentoring?${params.toString()}`;
}

function buildCandidateMentorReportHref(assignment: MentoringReadinessReviewAssignment) {
  const params = new URLSearchParams({
    roleId: assignment.roleId,
    section: "mentor-report",
  });

  return `/candidates/${assignment.candidateId}?${params.toString()}`;
}

export function MentoringReadinessReview({
  assignments,
  selectedAssignmentKey,
}: {
  assignments: MentoringReadinessReviewAssignment[];
  selectedAssignmentKey: string | null;
}) {
  if (assignments.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        No mentoring role tracks are available yet for readiness review.
      </section>
    );
  }

  const selectedAssignment =
    assignments.find((assignment) => assignment.assignmentKey === selectedAssignmentKey) ??
    assignments[0];
  const selectedRecord = selectedAssignment.latestDevelopmentRecord;
  const selectedReport = selectedAssignment.latestMentorReport;
  const readinessScore = getReadinessScore(
    selectedRecord?.readinessSignal ?? "",
    selectedRecord?.averageFeedbackScore ?? null,
  );
  const developmentStatus: TrafficLightStatus = selectedRecord ? "green" : "red";
  const mentorReportStatus = getDateTrafficLightStatus(
    selectedReport?.createdAt ?? null,
  );
  const mentorReviewStatus = getDateTrafficLightStatus(
    selectedRecord?.mentorReviewDate ?? null,
  );
  const currentReadinessStatus = getCombinedTrafficLightStatus([
    developmentStatus,
    mentorReportStatus,
    mentorReviewStatus,
  ]);
  const currentReadinessLabel = getOverallStatusLabel(currentReadinessStatus);
  const developmentLabel =
    developmentStatus === "green"
      ? "Development Active"
      : "Development Not Started";
  const mentorReportLabel = getTimingStatusLabel(mentorReportStatus);
  const mentorReviewLabel = getTimingStatusLabel(mentorReviewStatus);
  const tracksWithReports = assignments.filter(
    (assignment) => assignment.latestMentorReport !== null,
  ).length;
  const nearOrReadyTracks = assignments.filter((assignment) => {
    const signal = assignment.latestDevelopmentRecord?.readinessSignal ?? "";
    return signal === "near_role_ready" || signal === "role_ready";
  }).length;
  const tracksNeedingReviews = assignments.filter(
    (assignment) => assignment.latestDevelopmentRecord === null,
  ).length;

  return (
    <section className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Active mentees
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">
            {new Set(assignments.map((assignment) => assignment.candidateId)).size}
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Role tracks with reports
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{tracksWithReports}</p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Near or role ready
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{nearOrReadyTracks}</p>
        </article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Needs first review
          </p>
          <p className="mt-3 text-4xl font-semibold text-slate-900">{tracksNeedingReviews}</p>
        </article>
      </section>

      <section className="grid gap-6">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Mentor scorecard
          </p>
          <h2 className="mt-3 font-display text-3xl text-slate-900">
            Choose a mentee
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Choose a mentee to update every section on this page for that
            candidate-role track.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {assignments.map((assignment) => {
              const isSelected = assignment.assignmentKey === selectedAssignment.assignmentKey;

              return (
                <Link
                  key={assignment.assignmentKey}
                  href={buildReadinessReviewHref(assignment)}
                  aria-current={isSelected ? "page" : undefined}
                  className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                    isSelected
                      ? "interactive-contrast border-teal-900 bg-teal-900 text-white shadow-[0_18px_40px_rgba(15,118,110,0.18)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {assignment.candidateName}
                </Link>
              );
            })}
          </div>
        </article>

        <div className="grid gap-6">
          <article className="rounded-[1.75rem] border border-teal-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                  Selected role track
                </p>
                <h2 className="mt-3 font-display text-4xl text-slate-900">
                  {selectedAssignment.candidateName}
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {selectedAssignment.roleTitle} with {selectedAssignment.mentorName}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={buildCandidateMentorReportHref(selectedAssignment)}
                  className="interactive-contrast rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                >
                  Open Candidate Mentor Report
                </Link>
                <Link
                  href={buildLeadershipRecordHref(selectedAssignment)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Open Leadership Development Record
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="relative rounded-3xl bg-slate-50 p-5 pb-12">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current readiness
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {getReadinessLabel(selectedRecord?.readinessSignal ?? "")}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {formatScore(readinessScore)}
                </p>
                <StatusIndicator
                  status={currentReadinessStatus}
                  label={currentReadinessLabel}
                />
              </article>
              <article className="relative rounded-3xl bg-slate-50 p-5 pb-12">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Development status
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {getStatusLabel(selectedRecord?.status ?? null)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Record assigned {formatDate(selectedRecord?.dateAssigned ?? null)}
                </p>
                <StatusIndicator
                  status={developmentStatus}
                  label={developmentLabel}
                />
              </article>
              <article className="relative rounded-3xl bg-slate-50 p-5 pb-12">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Latest mentor report
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {selectedReport ? `Version ${selectedReport.version}` : "Not generated"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedReport
                    ? `Generated ${formatDate(selectedReport.createdAt)}`
                    : "Generate from the candidate workspace"}
                </p>
                <StatusIndicator
                  status={mentorReportStatus}
                  label={mentorReportLabel}
                />
              </article>
              <article className="relative rounded-3xl bg-slate-50 p-5 pb-12">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Last mentor review
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {formatDate(selectedRecord?.mentorReviewDate ?? null)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedRecord?.nextRecommendedExperience.trim()
                    ? "Next experience already noted"
                    : "Next experience not recorded yet"}
                </p>
                <StatusIndicator
                  status={mentorReviewStatus}
                  label={mentorReviewLabel}
                />
              </article>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Mentor narrative
            </p>
            <h3 className="mt-3 font-display text-3xl text-slate-900">
              Latest mentor-facing development narrative
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              This view brings the newest candidate-side mentor report into the
              mentoring workspace so a mentor can review readiness without leaving
              the role track.
            </p>

            {selectedReport ? (
              <div className="mt-8 grid gap-6">
                <article className="rounded-3xl bg-slate-50 p-6">
                  <h4 className="text-xl font-semibold text-slate-900">
                    Executive Summary
                  </h4>
                  <p className="mt-4 text-sm leading-7 text-slate-700">
                    {sanitizeAppText(selectedReport.report.executive_summary)}
                  </p>
                </article>

                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Development Priorities
                    </h4>
                    <div className="mt-4 grid gap-3">
                      {selectedReport.report.development_priorities.length > 0 ? (
                        selectedReport.report.development_priorities
                          .slice(0, 4)
                          .map((priority) => (
                            <div
                              key={priority.competency}
                              className="rounded-2xl bg-slate-50 p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                {sanitizeAppText(priority.competency)}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-600">
                                {sanitizeAppText(priority.why_it_matters)}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-slate-600">
                          No development priorities were saved in the latest report.
                        </p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Strengths to Leverage
                    </h4>
                    <div className="mt-4 grid gap-3">
                      {selectedReport.report.strengths_to_leverage.length > 0 ? (
                        selectedReport.report.strengths_to_leverage
                          .slice(0, 4)
                          .map((item) => (
                            <div
                              key={`${item.competency}-${item.strength}`}
                              className="rounded-2xl bg-slate-50 p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                {sanitizeAppText(item.competency)} via{" "}
                                {sanitizeAppText(item.strength)}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-600">
                                {sanitizeAppText(item.application)}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-slate-600">
                          No strengths guidance was saved in the latest report.
                        </p>
                      )}
                    </div>
                  </article>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Recommended Projects
                    </h4>
                    <div className="mt-4 grid gap-3">
                      {selectedReport.report.recommended_projects.length > 0 ? (
                        selectedReport.report.recommended_projects
                          .slice(0, 3)
                          .map((project) => (
                            <div
                              key={project.title}
                              className="rounded-2xl bg-slate-50 p-4"
                            >
                              <p className="font-semibold text-slate-900">
                                {sanitizeAppText(project.title)}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-600">
                                {sanitizeAppText(project.why_it_fits)}
                              </p>
                              {project.success_signals.length > 0 ? (
                                <p className="mt-3 text-xs leading-6 text-slate-500">
                                  Success signals:{" "}
                                  {sanitizeAppTextList(project.success_signals).join(
                                    " | ",
                                  )}
                                </p>
                              ) : null}
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-slate-600">
                          No recommended projects were saved in the latest report.
                        </p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Evidence to Watch
                    </h4>
                    {selectedReport.report.evidence_to_watch.length > 0 ? (
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600">
                        {selectedReport.report.evidence_to_watch
                          .slice(0, 6)
                          .map((item) => (
                            <li key={item} className="flex items-start gap-3">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-700" />
                              <span>{sanitizeAppText(item)}</span>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-slate-600">
                        No evidence watch items were saved in the latest report.
                      </p>
                    )}
                  </article>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                No mentor report has been generated yet for this candidate and
                role. Open the candidate workspace to create the first narrative.
              </div>
            )}
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Development record snapshot
            </p>
            <h3 className="mt-3 font-display text-3xl text-slate-900">
              Latest mentor-side readiness record
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              This summary comes from the newest saved leadership development
              record for the selected mentor track.
            </p>

            {selectedRecord ? (
              <div className="mt-8 grid gap-6">
                <article className="rounded-3xl bg-slate-50 p-6">
                  <h4 className="text-xl font-semibold text-slate-900">
                    {sanitizeAppText(selectedRecord.experienceTitle)}
                  </h4>
                  {selectedRecord.assignmentReason.trim().length > 0 ? (
                    <p className="mt-4 text-sm leading-7 text-slate-700">
                      {sanitizeAppText(selectedRecord.assignmentReason)}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      No assignment reason has been saved for this record yet.
                    </p>
                  )}
                </article>

                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Growth Areas
                    </h4>
                    {selectedRecord.growthAreas.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedRecord.growthAreas.map((growthArea) => (
                          <span
                            key={growthArea}
                            className="rounded-full bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800"
                          >
                            {growthArea}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-600">
                        No growth areas have been tagged yet.
                      </p>
                    )}
                  </article>

                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Next Recommended Experience
                    </h4>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {selectedRecord.nextRecommendedExperience.trim().length > 0
                        ? sanitizeAppText(selectedRecord.nextRecommendedExperience)
                        : "No next recommended experience has been saved yet."}
                    </p>
                  </article>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Improvement Observed
                    </h4>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {selectedRecord.mentorImprovementObserved.trim().length > 0
                        ? sanitizeAppText(selectedRecord.mentorImprovementObserved)
                        : "No mentor observations have been saved yet."}
                    </p>
                  </article>

                  <article className="rounded-3xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      Development Still Needed
                    </h4>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {selectedRecord.mentorDevelopmentNeeded.trim().length > 0
                        ? sanitizeAppText(selectedRecord.mentorDevelopmentNeeded)
                        : "No remaining development needs have been saved yet."}
                    </p>
                  </article>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                This mentor track does not have a saved leadership development
                record yet. Open the leadership development record to create the
                first readiness entry for this candidate-role track.
              </div>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
