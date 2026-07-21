import Link from "next/link";
import { redirect } from "next/navigation";
import { SubscriptionPaywallPanel } from "@/components/subscription-paywall-panel";
import {
  DashboardSetupJourney,
  type DashboardSetupJourneySummary,
} from "@/components/dashboard-setup-journey";
import { requireUser } from "@/lib/auth";
import { computeCandidateAward } from "@/lib/candidate-awards";
import Image from "next/image";
import { canAccessLeadershipHelpPreview } from "@/lib/leadership-help-preview";
import { getLegacyCertificationAsset } from "@/lib/legacy-certifications";
import {
  hasProductAccess,
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
  type OrganizationSubscriptionState,
} from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MentorDirectoryManager } from "@/components/mentor-directory-manager";
import { WorkspaceSetupForm } from "@/components/workspace-setup-form";
import { createWorkspaceSetupToken } from "@/lib/workspace-setup-token";
import { isMissingLeadershipDevelopmentRecordTableError } from "@/lib/leadership-development-record";
import {
  computeOrganizationAward,
  type OrganizationAward,
} from "@/lib/organization-awards";
import { isMissingOrganizationIndustryColumnError } from "@/lib/organization-industry";
import { canonicalizeRoleTitle } from "@/lib/role-title";
import {
  buildCompetencyAssessments,
  computeRoleGoalReadiness,
} from "@/lib/fit-analysis";

type DashboardPageProps = {
  searchParams: Promise<{
    message?: string;
    timeRange?: string;
    department?: string;
    targetRole?: string;
    mentorId?: string;
    readiness?: string;
    recommendations?: string;
  }>;
};

type TimeRange = "30d" | "90d" | "6m" | "12m" | "all";
type ReadinessFilter =
  | "all"
  | "developing"
  | "progressing"
  | "near_role_ready"
  | "role_ready";
type RiskLevel = "High Risk" | "Moderate Risk" | "Low Risk";

type CandidateStage =
  | "Needs target role"
  | "Needs strengths upload"
  | "Needs mentor report"
  | "Ready for mentor assignment"
  | "Mentor assigned"
  | "Development plan assigned"
  | "On hold";

type DashboardFilters = {
  timeRange: TimeRange;
  department: string;
  targetRole: string;
  mentorId: string;
  readiness: ReadinessFilter;
  recommendationsOpen: boolean;
};

type DashboardProfile = {
  id: string;
  organization_id: string;
  full_name: string;
  role: string;
  organization_name: string;
  organization_industry: string | null;
};

type DashboardRole = {
  id: string;
  title: string;
  department: string | null;
  status: string;
};

type DashboardMentor = {
  id: string;
  full_name: string;
  email: string;
  position_title: string | null;
};

type DashboardCandidate = {
  id: string;
  full_name: string;
  current_title: string | null;
  created_at: string;
  role_ids: string[];
  role_titles: string[];
  mentor_profile_ids: string[];
  mentor_names: string[];
  status: string;
  stage: CandidateStage;
};

type MentorAssignment = {
  candidate_id: string;
  role_id: string;
  mentor_profile_id: string;
  status: string | null;
  start_date: string | null;
  created_at: string;
};

type DevelopmentRecordRow = {
  id: string;
  candidate_id: string;
  role_id: string;
  mentor_id: string;
  target_role: string;
  date_assigned: string;
  status: string;
  growth_areas: string[] | null;
  experience_title: string;
  readiness_signal: string | null;
  mentor_review_date: string | null;
  average_feedback_score: number | null;
  updated_at: string;
};

type DevelopmentCompetencyRow = {
  development_record_id: string;
  competency_name: string;
  baseline_score: number;
  target_score: number;
  current_score: number | null;
};

type DevelopmentFeedbackRow = {
  development_record_id: string;
};

type DashboardRoleCompetencyRow = {
  role_id: string;
  id: string;
  name: string;
  target_score: number;
  weight: number;
};

type DashboardInterviewPanelRow = {
  id: string;
  candidate_id: string;
  role_id: string;
};

type DashboardInterviewScoreRow = {
  panel_id: string;
  competency_id: string;
  score_numeric: number;
  evidence_notes: string | null;
  concern_notes: string | null;
};

type DashboardStrengthAssessmentRow = {
  candidate_id: string;
  role_id: string;
  competency_id: string;
  strength_score: number;
  supporting_strengths: string[] | null;
  rationale: string | null;
};

type SuccessorSummary = {
  candidateId: string;
  name: string;
  roleId: string;
  roleTitle: string;
  mentorId: string | null;
};

type RoleRiskRow = {
  roleId: string;
  roleTitle: string;
  department: string | null;
  candidateCount: number;
  highestReadinessPercent: number | null;
  lastDevelopmentActivity: string | null;
  riskLevel: RiskLevel;
  candidateLinks: SuccessorSummary[];
};

type MentorEffectivenessRow = {
  mentorId: string;
  mentorName: string;
  activeCandidates: number;
  completedReviews: number;
  averageCandidateImprovement: number | null;
  overdueReviews: number;
  averageReviewerScore: number | null;
};

type ExperienceImpactRow = {
  experienceType: string;
  assignedCount: number;
  averageCompetencyImprovement: number | null;
  averageReviewerScore: number | null;
  mostImprovedCompetency: string | null;
};

type CompetencyGrowthRow = {
  competencyName: string;
  averageBaselineScore: number | null;
  averageCurrentScore: number | null;
  averageImprovement: number | null;
  candidateCount: number;
};

type DashboardRecommendation = {
  title: string;
  body: string;
  href?: string;
};

type DashboardReportLine = {
  title: string;
  body: string;
};

type DashboardIntelligence = {
  filters: DashboardFilters;
  filterOptions: {
    departments: string[];
    roles: { id: string; title: string }[];
    mentors: { id: string; name: string }[];
  };
  visibilityNote: string | null;
  developmentStorageReady: boolean;
  emptyStateMessage: string | null;
  continuityScore: {
    score: number;
    label: string;
    roleCoverageScore: number;
    candidateReadinessScore: number;
    developmentProgressScore: number;
    mentorEngagementScore: number;
    reviewCompletionScore: number;
  };
  organizationAward: OrganizationAward;
  criticalRolesCovered: {
    covered: number;
    total: number;
    percentage: number;
    uncoveredRoles: { id: string; title: string }[];
  };
  readySuccessors: {
    near: SuccessorSummary[];
    ready: SuccessorSummary[];
  };
  highRiskRoles: number;
  averageTimeToReadiness: {
    overallMonths: number | null;
    nearMonths: number | null;
    roleReadyMonths: number | null;
    byRole: { roleId: string; roleTitle: string; months: number }[];
    byDepartment: { department: string; months: number }[];
  };
  riskByRole: RoleRiskRow[];
  candidateMovement: {
    improved: number;
    noChange: number;
    declined: number;
    completedProgram: number;
    removedFromPipeline: number;
  };
  mentorEffectiveness: MentorEffectivenessRow[];
  experienceImpact: ExperienceImpactRow[];
  competencyGrowth: CompetencyGrowthRow[];
  recommendations: DashboardRecommendation[];
  successionRisks: DashboardRecommendation[];
  learnedInsights: string[];
  liveReport: DashboardReportLine[];
};

type DashboardSnapshot = {
  profile: DashboardProfile | null;
  subscription: OrganizationSubscriptionState | null;
  roles: DashboardRole[];
  mentors: DashboardMentor[];
  candidates: DashboardCandidate[];
  counts: {
    roles: number;
    candidates: number;
    mentors: number;
  } | null;
  setupJourney: DashboardSetupJourneySummary | null;
  intelligence: DashboardIntelligence | null;
};

type DashboardTrack = {
  key: string;
  candidateId: string;
  candidateName: string;
  candidateCreatedAt: string;
  currentTitle: string | null;
  candidateStatus: string;
  roleId: string;
  roleTitle: string;
  department: string | null;
  mentorIds: string[];
  mentorNames: string[];
  assignmentActivityDates: string[];
  records: DevelopmentRecordRow[];
  roleGoalReadinessPercent: number | null;
};

function getSetupDefaultFullName(user: Awaited<ReturnType<typeof requireUser>>) {
  const metadataName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  if (metadataName) {
    return metadataName;
  }

  const emailPrefix = user.email?.split("@")[0]?.trim() ?? "";

  if (!emailPrefix) {
    return "";
  }

  return emailPrefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All Time" },
];

const READINESS_OPTIONS: Array<{ value: ReadinessFilter; label: string }> = [
  { value: "all", label: "All readiness levels" },
  { value: "developing", label: "Developing" },
  { value: "progressing", label: "Progressing" },
  { value: "near_role_ready", label: "Near Role-Ready" },
  { value: "role_ready", label: "Role-Ready" },
];

function parseTimeRange(value?: string): TimeRange {
  switch (value) {
    case "30d":
    case "90d":
    case "6m":
    case "12m":
    case "all":
      return value;
    default:
      return "90d";
  }
}

function parseReadinessFilter(value?: string): ReadinessFilter {
  switch (value) {
    case "developing":
    case "progressing":
    case "near_role_ready":
    case "role_ready":
      return value;
    default:
      return "all";
  }
}

function parseDashboardFilters(params: {
  timeRange?: string;
  department?: string;
  targetRole?: string;
  mentorId?: string;
  readiness?: string;
  recommendations?: string;
}): DashboardFilters {
  return {
    timeRange: parseTimeRange(params.timeRange),
    department: typeof params.department === "string" ? params.department : "",
    targetRole: typeof params.targetRole === "string" ? params.targetRole : "",
    mentorId: typeof params.mentorId === "string" ? params.mentorId : "",
    readiness: parseReadinessFilter(params.readiness),
    recommendationsOpen: params.recommendations === "open",
  };
}

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

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToTenth(value: number | null) {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(1));
}

function roundToHundredth(value: number | null) {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(2));
}

function clampPercent(value: number | null) {
  if (value === null) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(value.toFixed(0))));
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatScore(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toFixed(1);
}

function formatReadinessPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getTimeRangeStart(range: TimeRange) {
  if (range === "all") {
    return null;
  }

  const now = new Date();
  const next = new Date(now);

  if (range === "30d") {
    next.setDate(now.getDate() - 30);
  } else if (range === "90d") {
    next.setDate(now.getDate() - 90);
  } else if (range === "6m") {
    next.setMonth(now.getMonth() - 6);
  } else if (range === "12m") {
    next.setMonth(now.getMonth() - 12);
  }

  return next;
}

function isOnOrAfter(value: string | null, threshold: Date | null) {
  if (!threshold) {
    return true;
  }

  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= threshold;
}

function isWithinLastDays(value: string | null, days: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold;
}

function getContinuityLabel(score: number) {
  if (score >= 85) {
    return "Strong";
  }

  if (score >= 70) {
    return "Stable";
  }

  if (score >= 50) {
    return "Moderate Risk";
  }

  return "High Risk";
}

function getReadinessScore(signal: string | null) {
  switch (signal) {
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

function getRecordNumericReadiness(record: DevelopmentRecordRow | null | undefined) {
  if (!record) {
    return null;
  }

  if (typeof record.average_feedback_score === "number") {
    return record.average_feedback_score;
  }

  return getReadinessScore(record.readiness_signal);
}

function getRoleGoalReadinessStatus(readinessPercent: number | null) {
  if (readinessPercent === null) {
    return null;
  }

  if (readinessPercent >= 100) {
    return "role_ready" as const;
  }

  if (readinessPercent >= 90) {
    return "near_role_ready" as const;
  }

  return null;
}

function getTrackReadinessStatus(track: Pick<DashboardTrack, "records" | "roleGoalReadinessPercent">) {
  const latestRecord = track.records[0] ?? null;

  return (
    getRoleGoalReadinessStatus(track.roleGoalReadinessPercent) ??
    ((latestRecord?.readiness_signal ?? null) === "near_role_ready" ||
    (latestRecord?.readiness_signal ?? null) === "role_ready"
      ? (latestRecord?.readiness_signal as "near_role_ready" | "role_ready")
      : null)
  );
}

function inferExperienceType(title: string) {
  const normalized = title.trim().toLowerCase();

  if (normalized.includes("cross")) {
    return "Cross-Department Project";
  }

  if (normalized.includes("department")) {
    return "Department Project";
  }

  if (normalized.includes("shadow")) {
    return "Executive Shadowing";
  }

  if (normalized.includes("board")) {
    return "Board Presentation";
  }

  if (normalized.includes("finance") || normalized.includes("financial")) {
    return "Financial Rotation";
  }

  if (normalized.includes("committee")) {
    return "Committee Leadership";
  }

  if (normalized.includes("conflict")) {
    return "Conflict Resolution Assignment";
  }

  if (normalized.includes("quality")) {
    return "Quality Improvement Project";
  }

  return "Other";
}

function calculateMonthsBetween(startValue: string | null, endValue: string | null) {
  if (!startValue || !endValue) {
    return null;
  }

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  return Number(((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)).toFixed(1));
}

function buildDashboardHref(filters: DashboardFilters, overrides: Partial<DashboardFilters>) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  params.set("timeRange", next.timeRange);

  if (next.department) {
    params.set("department", next.department);
  }

  if (next.targetRole) {
    params.set("targetRole", next.targetRole);
  }

  if (next.mentorId) {
    params.set("mentorId", next.mentorId);
  }

  if (next.readiness !== "all") {
    params.set("readiness", next.readiness);
  }

  if (next.recommendationsOpen) {
    params.set("recommendations", "open");
  }

  return `/dashboard?${params.toString()}`;
}

function getRoleHref(roleId: string) {
  return `/roles?roleId=${roleId}`;
}

function getCandidateHref(candidateId: string) {
  return `/candidates/${candidateId}`;
}

function buildDashboardSetupJourney(options: {
  organizationName: string;
  roleCount: number;
  candidateCount: number;
  mentorCount: number;
  mentorAssignmentCount: number;
  developmentRecordCount: number;
}) : DashboardSetupJourneySummary {
  const steps = [
    {
      id: "organization",
      label: "Confirm Company Settings",
      description:
        "Review the organization name, industry, and product access before the rest of the program is built.",
      statusLabel: options.organizationName,
      complete: true,
      href: "/administration?section=organization-controls",
      actionLabel: "Open Company Settings",
    },
    {
      id: "roles",
      label: "Add Priority Roles",
      description:
        "Define the roles you want to protect first so candidates and mentors have a clear destination.",
      statusLabel:
        options.roleCount === 0
          ? "No roles added yet"
          : `${options.roleCount} role${options.roleCount === 1 ? "" : "s"} on file`,
      complete: options.roleCount > 0,
      href: "/roles?mode=create",
      actionLabel:
        options.roleCount > 0 ? "Manage Roles" : "Create First Role",
    },
    {
      id: "people",
      label: "Add Candidates and Mentors",
      description:
        "Create the people who will move through the succession process and the mentors who will guide them.",
      statusLabel:
        options.candidateCount > 0 || options.mentorCount > 0
          ? `${options.candidateCount} candidate${options.candidateCount === 1 ? "" : "s"} • ${options.mentorCount} mentor${options.mentorCount === 1 ? "" : "s"}`
          : "No people added yet",
      complete: options.candidateCount > 0 && options.mentorCount > 0,
      href: "/administration?section=user-access",
      actionLabel:
        options.candidateCount > 0 || options.mentorCount > 0
          ? "Manage People"
          : "Add People",
    },
    {
      id: "assignments",
      label: "Connect Candidate-Role Mentor Tracks",
      description:
        "Tie each candidate to a role and mentor so the mentoring workspace knows exactly who is working toward what.",
      statusLabel:
        options.mentorAssignmentCount === 0
          ? "No mentoring tracks assigned yet"
          : `${options.mentorAssignmentCount} live mentor track${options.mentorAssignmentCount === 1 ? "" : "s"}`,
      complete: options.mentorAssignmentCount > 0,
      href: "/administration?section=assign-mentors",
      actionLabel:
        options.mentorAssignmentCount > 0
          ? "Manage Mentor Tracks"
          : "Assign First Mentor Track",
    },
    {
      id: "mentoring",
      label: "Start the First Development Record",
      description:
        "Launch the mentoring work by saving the first leadership development record for one candidate-role track.",
      statusLabel:
        options.developmentRecordCount === 0
          ? "No development records started yet"
          : `${options.developmentRecordCount} development record${options.developmentRecordCount === 1 ? "" : "s"} active`,
      complete: options.developmentRecordCount > 0,
      href: "/mentoring?section=leadership-development-record",
      actionLabel:
        options.developmentRecordCount > 0
          ? "Open Mentoring Records"
          : "Start First Record",
    },
  ];

  const completedSteps = steps.filter((step) => step.complete).length;
  const primaryStep = steps.find((step) => !step.complete) ?? null;

  return {
    completedSteps,
    totalSteps: steps.length,
    isComplete: primaryStep === null,
    primaryActionHref: primaryStep?.href ?? "/mentoring?section=leadership-development-record",
    primaryActionLabel: primaryStep?.actionLabel ?? "Open Mentoring Workspace",
    primaryActionTitle: primaryStep?.label ?? "Mentoring program is live",
    primaryActionDescription:
      primaryStep?.description ??
      "Your core onboarding path is complete. Continue refining roles, adding successors, and launching new development records from the mentoring workspace.",
    counts: {
      roles: options.roleCount,
      candidates: options.candidateCount,
      mentors: options.mentorCount,
      mentorAssignments: options.mentorAssignmentCount,
      developmentRecords: options.developmentRecordCount,
    },
    steps,
  };
}

function buildDashboardIntelligence(options: {
  profile: DashboardProfile;
  roles: DashboardRole[];
  mentors: DashboardMentor[];
  candidates: DashboardCandidate[];
  mentorAssignments: MentorAssignment[];
  developmentRecords: DevelopmentRecordRow[];
  developmentCompetencies: DevelopmentCompetencyRow[];
  developmentFeedback: DevelopmentFeedbackRow[];
  roleCompetencies: DashboardRoleCompetencyRow[];
  interviewPanels: DashboardInterviewPanelRow[];
  interviewScores: DashboardInterviewScoreRow[];
  strengthAssessments: DashboardStrengthAssessmentRow[];
  filters: DashboardFilters;
  developmentStorageReady: boolean;
}) : DashboardIntelligence {
  const departmentOptions = Array.from(
    new Set(
      options.roles
        .map((role) => role.department?.trim())
        .filter((department): department is string => Boolean(department)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const mentorOptions = options.mentors
    .map((mentor) => ({ id: mentor.id, name: mentor.full_name }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const roleOptions = options.roles
    .map((role) => ({ id: role.id, title: role.title }))
    .sort((left, right) => left.title.localeCompare(right.title));

  const competenciesByRecordId = new Map<string, DevelopmentCompetencyRow[]>();
  const feedbackCountByRecordId = new Map<string, number>();

  for (const competency of options.developmentCompetencies) {
    const current = competenciesByRecordId.get(competency.development_record_id) ?? [];
    current.push(competency);
    competenciesByRecordId.set(competency.development_record_id, current);
  }

  for (const feedback of options.developmentFeedback) {
    feedbackCountByRecordId.set(
      feedback.development_record_id,
      (feedbackCountByRecordId.get(feedback.development_record_id) ?? 0) + 1,
    );
  }

  const roleById = new Map(options.roles.map((role) => [role.id, role]));
  const mentorById = new Map(options.mentors.map((mentor) => [mentor.id, mentor]));
  const roleCompetenciesByRoleId = new Map<string, DashboardRoleCompetencyRow[]>();
  const trackKeyByPanelId = new Map<string, string>();
  const interviewScoresByTrackKey = new Map<string, DashboardInterviewScoreRow[]>();
  const strengthAssessmentsByTrackKey = new Map<string, DashboardStrengthAssessmentRow[]>();
  const assignmentsByTrackKey = new Map<
    string,
    {
      mentorIds: Set<string>;
      mentorNames: Set<string>;
      activityDates: Set<string>;
    }
  >();
  const recordsByTrackKey = new Map<string, DevelopmentRecordRow[]>();

  for (const competency of options.roleCompetencies) {
    const current = roleCompetenciesByRoleId.get(competency.role_id) ?? [];
    current.push(competency);
    roleCompetenciesByRoleId.set(competency.role_id, current);
  }

  for (const panel of options.interviewPanels) {
    trackKeyByPanelId.set(panel.id, `${panel.candidate_id}:${panel.role_id}`);
  }

  for (const score of options.interviewScores) {
    const trackKey = trackKeyByPanelId.get(score.panel_id);

    if (!trackKey) {
      continue;
    }

    const current = interviewScoresByTrackKey.get(trackKey) ?? [];
    current.push(score);
    interviewScoresByTrackKey.set(trackKey, current);
  }

  for (const assessment of options.strengthAssessments) {
    const trackKey = `${assessment.candidate_id}:${assessment.role_id}`;
    const current = strengthAssessmentsByTrackKey.get(trackKey) ?? [];
    current.push(assessment);
    strengthAssessmentsByTrackKey.set(trackKey, current);
  }

  for (const assignment of options.mentorAssignments) {
    const key = `${assignment.candidate_id}:${assignment.role_id}`;
    const current =
      assignmentsByTrackKey.get(key) ??
      ({
        mentorIds: new Set<string>(),
        mentorNames: new Set<string>(),
        activityDates: new Set<string>(),
      });

    if (assignment.mentor_profile_id) {
      current.mentorIds.add(assignment.mentor_profile_id);
      const mentorName = mentorById.get(assignment.mentor_profile_id)?.full_name;

      if (mentorName) {
        current.mentorNames.add(mentorName);
      }
    }

    const assignmentActivityDate = assignment.start_date ?? assignment.created_at;

    if (assignmentActivityDate) {
      current.activityDates.add(assignmentActivityDate);
    }

    assignmentsByTrackKey.set(key, current);
  }

  for (const record of options.developmentRecords) {
    const key = `${record.candidate_id}:${record.role_id}`;
    const current = recordsByTrackKey.get(key) ?? [];
    current.push(record);
    recordsByTrackKey.set(key, current);
  }

  const tracks: DashboardTrack[] = [];

  for (const candidate of options.candidates) {
    for (const roleId of candidate.role_ids) {
      const role = roleById.get(roleId);

      if (!role) {
        continue;
      }

      const key = `${candidate.id}:${roleId}`;
      const assignmentData = assignmentsByTrackKey.get(key);
      const records = (recordsByTrackKey.get(key) ?? []).slice().sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at),
      );
      const competencies = roleCompetenciesByRoleId.get(roleId) ?? [];
      const interviewScores = interviewScoresByTrackKey.get(key) ?? [];
      const strengthAssessments = strengthAssessmentsByTrackKey.get(key) ?? [];
      const roleGoalReadinessPercent =
        competencies.length > 0
          ? computeRoleGoalReadiness(
              buildCompetencyAssessments(
                competencies.map((competency) => ({
                  id: competency.id,
                  name: competency.name,
                  target_score: competency.target_score,
                  weight: competency.weight,
                })),
                interviewScores.map((score) => ({
                  competency_id: score.competency_id,
                  score_numeric: score.score_numeric,
                  evidence_notes: score.evidence_notes,
                  concern_notes: score.concern_notes,
                })),
                strengthAssessments.map((assessment) => ({
                  competency_id: assessment.competency_id,
                  strength_score: Number(assessment.strength_score),
                  supporting_strengths: assessment.supporting_strengths,
                  rationale: assessment.rationale,
                })),
              ),
            ).readinessPercent
          : null;

      tracks.push({
        key,
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        candidateCreatedAt: candidate.created_at,
        currentTitle: candidate.current_title,
        candidateStatus: candidate.status,
        roleId,
        roleTitle: role.title,
        department: role.department,
        mentorIds: assignmentData ? Array.from(assignmentData.mentorIds) : [],
        mentorNames: assignmentData ? Array.from(assignmentData.mentorNames) : [],
        assignmentActivityDates: assignmentData
          ? Array.from(assignmentData.activityDates)
          : [],
        records,
        roleGoalReadinessPercent,
      });
    }
  }

  const timeRangeStart = getTimeRangeStart(options.filters.timeRange);

  const visibleTracks = tracks.filter((track) => {
    if (options.filters.department && track.department !== options.filters.department) {
      return false;
    }

    if (options.filters.targetRole && track.roleId !== options.filters.targetRole) {
      return false;
    }

    if (
      options.filters.mentorId &&
      !track.mentorIds.includes(options.filters.mentorId) &&
      !track.records.some((record) => record.mentor_id === options.filters.mentorId)
    ) {
      return false;
    }

    if (options.filters.readiness !== "all") {
      const latestRecord = track.records[0] ?? null;

      if ((latestRecord?.readiness_signal ?? null) !== options.filters.readiness) {
        return false;
      }
    }

    return true;
  });

  const visibleRoleIds = new Set(visibleTracks.map((track) => track.roleId));
  const visibleRoles = options.roles.filter((role) => {
    if (options.filters.department && role.department !== options.filters.department) {
      return false;
    }

    if (options.filters.targetRole && role.id !== options.filters.targetRole) {
      return false;
    }

    if (options.filters.mentorId) {
      return visibleRoleIds.has(role.id);
    }

    return true;
  });

  const activeTracks = visibleTracks.filter((track) => track.candidateStatus !== "on_hold");
  const visibleRecords = visibleTracks.flatMap((track) => track.records);
  const visibleRecordsInRange = visibleRecords.filter((record) =>
    isOnOrAfter(record.updated_at, timeRangeStart),
  );
  const visibleRecordIdsInRange = new Set(visibleRecordsInRange.map((record) => record.id));
  const visibleCompetenciesInRange = options.developmentCompetencies.filter((competency) =>
    visibleRecordIdsInRange.has(competency.development_record_id),
  );

  const roleCoverageScore = clampPercent(
    visibleRoles.length > 0
      ? (activeTracks.length > 0
          ? (new Set(activeTracks.map((track) => track.roleId)).size / visibleRoles.length) * 100
          : 0)
      : 0,
  );

  const readinessScores = visibleTracks
    .map((track) => getRecordNumericReadiness(track.records[0] ?? null))
    .filter((score): score is number => score !== null);
  const candidateReadinessScore = clampPercent(
    readinessScores.length > 0 ? ((average(readinessScores) ?? 0) / 5) * 100 : 0,
  );

  const competencyImprovements = visibleCompetenciesInRange
    .map((competency) => {
      if (competency.current_score === null) {
        return null;
      }

      return competency.current_score - competency.baseline_score;
    })
    .filter((value): value is number => value !== null);
  const developmentProgressScore = clampPercent(
    competencyImprovements.length > 0
      ? Math.min(((average(competencyImprovements) ?? 0) / 2) * 100, 100)
      : 0,
  );

  const activeTrackKeys = new Set(activeTracks.map((track) => track.key));
  const tracksWithRecentMentorReview = new Set(
    activeTracks
      .filter((track) => isWithinLastDays(track.records[0]?.mentor_review_date ?? null, 60))
      .map((track) => track.key),
  );
  const mentorEngagementScore = clampPercent(
    activeTrackKeys.size > 0
      ? (tracksWithRecentMentorReview.size / activeTrackKeys.size) * 100
      : 0,
  );

  const recordsWithFeedback = visibleRecordsInRange.filter(
    (record) => (feedbackCountByRecordId.get(record.id) ?? 0) > 0,
  );
  const reviewCompletionScore = clampPercent(
    visibleRecordsInRange.length > 0
      ? (recordsWithFeedback.length / visibleRecordsInRange.length) * 100
      : 0,
  );

  const continuityScore = clampPercent(
    average([
      roleCoverageScore,
      candidateReadinessScore,
      developmentProgressScore,
      mentorEngagementScore,
      reviewCompletionScore,
    ]),
  );

  const organizationAward = computeOrganizationAward({
    roles: visibleRoles.map((role) => ({
      id: role.id,
      title: role.title,
    })),
    roleBench: visibleRoles.map((role) => {
      const roleTracks = activeTracks.filter((track) => track.roleId === role.id);
      const coveredSuccessorCount = roleTracks.filter((track) => {
        const candidateAward = computeCandidateAward({
          readinessPercent: track.roleGoalReadinessPercent,
          hasMentorAssigned:
            track.mentorIds.length > 0 ||
            track.records.some((record) => Boolean(record.mentor_id)),
          hasDevelopmentRecord: track.records.length > 0,
          hasCompletedMentorReview: track.records.some((record) =>
            Boolean(record.mentor_review_date),
          ),
        });

        return (
          candidateAward.tier === "silver" ||
          candidateAward.tier === "gold" ||
          candidateAward.tier === "platinum"
        );
      }).length;
      const goldReadySuccessorCount = roleTracks.filter((track) => {
        const candidateAward = computeCandidateAward({
          readinessPercent: track.roleGoalReadinessPercent,
          hasMentorAssigned:
            track.mentorIds.length > 0 ||
            track.records.some((record) => Boolean(record.mentor_id)),
          hasDevelopmentRecord: track.records.length > 0,
          hasCompletedMentorReview: track.records.some((record) =>
            Boolean(record.mentor_review_date),
          ),
        });

        return (
          candidateAward.tier === "gold" || candidateAward.tier === "platinum"
        );
      }).length;

      return {
        roleId: role.id,
        successorCount: roleTracks.length,
        coveredSuccessorCount,
        goldReadySuccessorCount,
      };
    }),
  });

  const readySuccessors = {
    near: [] as SuccessorSummary[],
    ready: [] as SuccessorSummary[],
  };

  for (const track of visibleTracks) {
    const latestRecord = track.records[0] ?? null;
    const mentorId = track.mentorIds[0] ?? latestRecord?.mentor_id ?? null;
    const readinessStatus = getTrackReadinessStatus(track);
    const successor = {
      candidateId: track.candidateId,
      name: track.candidateName,
      roleId: track.roleId,
      roleTitle: track.roleTitle,
      mentorId,
    };

    if (readinessStatus === "near_role_ready") {
      readySuccessors.near.push(successor);
    }

    if (readinessStatus === "role_ready") {
      readySuccessors.ready.push(successor);
    }
  }

  const riskByRole = visibleRoles.map((role) => {
    const roleTracks = visibleTracks.filter((track) => track.roleId === role.id);
    const highestReadinessPercent =
      roleTracks.length > 0
        ? roleTracks.reduce<number | null>(
            (currentHighest, track) =>
              track.roleGoalReadinessPercent === null
                ? currentHighest
                : currentHighest === null
                  ? track.roleGoalReadinessPercent
                  : Math.max(currentHighest, track.roleGoalReadinessPercent),
            null,
          )
        : null;
    const lastDevelopmentActivity = roleTracks
      .flatMap((track) => [
        track.candidateCreatedAt,
        ...track.assignmentActivityDates,
        ...track.records.map((record) => record.updated_at),
      ])
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
    const readinessStatuses = roleTracks.map((track) => getTrackReadinessStatus(track));
    const roleReadyCount = readinessStatuses.filter(
      (status) => status === "role_ready",
    ).length;
    const nearReadyCount = readinessStatuses.filter(
      (status) => status === "near_role_ready",
    ).length;
    const readinessDepthScore = roleReadyCount * 2 + nearReadyCount;

    let riskLevel: RiskLevel = "Moderate Risk";

    if (roleTracks.length === 0) {
      riskLevel = "High Risk";
    } else if (roleReadyCount >= 1 || readinessDepthScore >= 2) {
      riskLevel = "Low Risk";
    } else if (nearReadyCount >= 1 || (highestReadinessPercent ?? 0) >= 75) {
      riskLevel = "Moderate Risk";
    } else {
      riskLevel = "High Risk";
    }

    return {
      roleId: role.id,
      roleTitle: role.title,
      department: role.department,
      candidateCount: roleTracks.length,
      highestReadinessPercent: roundToTenth(highestReadinessPercent),
      lastDevelopmentActivity,
      riskLevel,
      candidateLinks: roleTracks.map((track) => ({
        candidateId: track.candidateId,
        name: track.candidateName,
        roleId: track.roleId,
        roleTitle: track.roleTitle,
        mentorId: track.mentorIds[0] ?? track.records[0]?.mentor_id ?? null,
      })),
    } satisfies RoleRiskRow;
  });

  const highRiskRoles = riskByRole.filter((row) => row.riskLevel === "High Risk");
  const coveredRoleIds = new Set(activeTracks.map((track) => track.roleId));
  const uncoveredRoles = visibleRoles
    .filter((role) => !coveredRoleIds.has(role.id))
    .map((role) => ({ id: role.id, title: role.title }));

  const candidateMovement = {
    improved: 0,
    noChange: 0,
    declined: 0,
    completedProgram: 0,
    removedFromPipeline: 0,
  };

  for (const track of visibleTracks) {
    const inRangeRecords = track.records
      .filter((record) => isOnOrAfter(record.updated_at, timeRangeStart))
      .slice()
      .sort((left, right) => left.updated_at.localeCompare(right.updated_at));

    if (inRangeRecords.length === 0) {
      continue;
    }

    const latestRecord = inRangeRecords[inRangeRecords.length - 1] ?? null;
    const previousRecord =
      track.records
        .filter((record) => record.updated_at < inRangeRecords[0].updated_at)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ??
      inRangeRecords[0] ??
      null;

    if (track.candidateStatus === "on_hold") {
      candidateMovement.removedFromPipeline += 1;
      continue;
    }

    if (latestRecord?.readiness_signal === "role_ready") {
      candidateMovement.completedProgram += 1;
      continue;
    }

    const previousScore = getRecordNumericReadiness(previousRecord);
    const latestScore = getRecordNumericReadiness(latestRecord);

    if (previousScore === null || latestScore === null) {
      candidateMovement.noChange += 1;
      continue;
    }

    if (latestScore > previousScore) {
      candidateMovement.improved += 1;
    } else if (latestScore < previousScore) {
      candidateMovement.declined += 1;
    } else {
      candidateMovement.noChange += 1;
    }
  }

  const nearMilestones: Array<{ roleId: string; roleTitle: string; department: string | null; months: number }> = [];
  const readyMilestones: Array<{ roleId: string; roleTitle: string; department: string | null; months: number }> = [];

  for (const track of visibleTracks) {
    const sortedRecords = track.records.slice().sort((left, right) =>
      left.updated_at.localeCompare(right.updated_at),
    );
    const startDate = sortedRecords[0]?.date_assigned ?? sortedRecords[0]?.updated_at ?? null;
    const latestRecord = sortedRecords[sortedRecords.length - 1] ?? null;
    const derivedReadinessStatus = getRoleGoalReadinessStatus(
      track.roleGoalReadinessPercent,
    );
    const firstNearRecord =
      sortedRecords.find((record) =>
        record.readiness_signal === "near_role_ready" || record.readiness_signal === "role_ready",
      ) ?? null;
    const firstReadyRecord =
      sortedRecords.find((record) => record.readiness_signal === "role_ready") ?? null;
    const firstNearDate =
      firstNearRecord?.updated_at ??
      (derivedReadinessStatus === "near_role_ready" ||
      derivedReadinessStatus === "role_ready"
        ? latestRecord?.updated_at ?? null
        : null);
    const firstReadyDate =
      firstReadyRecord?.updated_at ??
      (derivedReadinessStatus === "role_ready"
        ? latestRecord?.updated_at ?? null
        : null);

    if (firstNearDate && isOnOrAfter(firstNearDate, timeRangeStart)) {
      const months = calculateMonthsBetween(startDate, firstNearDate);

      if (months !== null) {
        nearMilestones.push({
          roleId: track.roleId,
          roleTitle: track.roleTitle,
          department: track.department,
          months,
        });
      }
    }

    if (firstReadyDate && isOnOrAfter(firstReadyDate, timeRangeStart)) {
      const months = calculateMonthsBetween(startDate, firstReadyDate);

      if (months !== null) {
        readyMilestones.push({
          roleId: track.roleId,
          roleTitle: track.roleTitle,
          department: track.department,
          months,
        });
      }
    }
  }

  const combinedMilestones = [...nearMilestones, ...readyMilestones];
  const monthsByRole = new Map<string, number[]>();
  const monthsByDepartment = new Map<string, number[]>();

  for (const milestone of combinedMilestones) {
    const roleKey = `${milestone.roleId}:${milestone.roleTitle}`;
    const roleValues = monthsByRole.get(roleKey) ?? [];
    roleValues.push(milestone.months);
    monthsByRole.set(roleKey, roleValues);

    if (milestone.department) {
      const departmentValues = monthsByDepartment.get(milestone.department) ?? [];
      departmentValues.push(milestone.months);
      monthsByDepartment.set(milestone.department, departmentValues);
    }
  }

  const averageTimeToReadiness = {
    overallMonths: roundToTenth(average(combinedMilestones.map((item) => item.months))),
    nearMonths: roundToTenth(average(nearMilestones.map((item) => item.months))),
    roleReadyMonths: roundToTenth(average(readyMilestones.map((item) => item.months))),
    byRole: Array.from(monthsByRole.entries())
      .map(([key, values]) => {
        const [roleId, roleTitle] = key.split(":");
        return {
          roleId,
          roleTitle,
          months: Number((average(values) ?? 0).toFixed(1)),
        };
      })
      .sort((left, right) => right.months - left.months)
      .slice(0, 5),
    byDepartment: Array.from(monthsByDepartment.entries())
      .map(([department, values]) => ({
        department,
        months: Number((average(values) ?? 0).toFixed(1)),
      }))
      .sort((left, right) => right.months - left.months)
      .slice(0, 5),
  };

  const mentorEffectiveness = mentorOptions
    .filter((mentor) => !options.filters.mentorId || mentor.id === options.filters.mentorId)
    .map((mentor) => {
      const mentorTracks = visibleTracks.filter((track) => track.mentorIds.includes(mentor.id));
      const mentorRecords = visibleRecordsInRange.filter((record) => record.mentor_id === mentor.id);
      const mentorImprovements = mentorRecords
        .flatMap((record) => competenciesByRecordId.get(record.id) ?? [])
        .map((competency) =>
          competency.current_score === null
            ? null
            : competency.current_score - competency.baseline_score,
        )
        .filter((value): value is number => value !== null);
      const mentorScores = mentorRecords
        .map((record) => record.average_feedback_score)
        .filter((value): value is number => value !== null);
      const overdueReviews = mentorTracks.filter((track) => {
        const latestRecord = track.records[0] ?? null;

        if (!latestRecord) {
          return false;
        }

        return (
          !latestRecord.mentor_review_date &&
          ["assigned", "in_progress", "ready_for_review"].includes(latestRecord.status) &&
          !isWithinLastDays(latestRecord.updated_at, 30)
        );
      }).length;

      return {
        mentorId: mentor.id,
        mentorName: mentor.name,
        activeCandidates: new Set(mentorTracks.map((track) => track.candidateId)).size,
        completedReviews: mentorRecords.filter((record) => Boolean(record.mentor_review_date)).length,
        averageCandidateImprovement: roundToHundredth(average(mentorImprovements)),
        overdueReviews,
        averageReviewerScore: roundToHundredth(average(mentorScores)),
      } satisfies MentorEffectivenessRow;
    })
    .filter((row): row is MentorEffectivenessRow => Boolean(row?.mentorId && row?.mentorName) && (row.activeCandidates > 0 || row.completedReviews > 0))
    .sort((left, right) => right.activeCandidates - left.activeCandidates);

  const experienceImpactMap = new Map<
    string,
    {
      count: number;
      improvements: number[];
      reviewerScores: number[];
      competencyImprovements: Map<string, number[]>;
    }
  >();

  for (const record of visibleRecordsInRange) {
    const experienceType = inferExperienceType(record.experience_title);
        const current: {
        count: number;
        improvements: number[];
        reviewerScores: number[];
        competencyImprovements: Map<string, number[]>;
      } =
        experienceImpactMap.get(experienceType) ??
        {
          count: 0,
          improvements: [],
          reviewerScores: [],
          competencyImprovements: new Map<string, number[]>(),
        };

    current.count += 1;

    if (record.average_feedback_score !== null) {
      current.reviewerScores.push(record.average_feedback_score);
    }

    for (const competency of competenciesByRecordId.get(record.id) ?? []) {
      if (competency.current_score === null) {
        continue;
      }

      const improvement = competency.current_score - competency.baseline_score;
      current.improvements.push(improvement);
      const competencyValues =
        current.competencyImprovements.get(competency.competency_name) ?? [];
      competencyValues.push(improvement);
      current.competencyImprovements.set(competency.competency_name, competencyValues);
    }

    experienceImpactMap.set(experienceType, current);
  }

  const experienceImpact = Array.from(experienceImpactMap.entries())
    .map(([experienceType, values]) => {
      const mostImprovedCompetency = Array.from(values.competencyImprovements.entries())
        .map(([competencyName, improvements]) => ({
          competencyName,
          averageImprovement: average(improvements) ?? 0,
        }))
        .sort((left, right) => right.averageImprovement - left.averageImprovement)[0];

      return {
        experienceType,
        assignedCount: values.count,
        averageCompetencyImprovement: roundToHundredth(average(values.improvements)),
        averageReviewerScore: roundToHundredth(average(values.reviewerScores)),
        mostImprovedCompetency: mostImprovedCompetency?.competencyName ?? null,
      } satisfies ExperienceImpactRow;
    })
    .sort((left, right) => right.assignedCount - left.assignedCount);

  const competencyGrowthMap = new Map<
    string,
    {
      baselineScores: number[];
      currentScores: number[];
      improvements: number[];
      candidateIds: Set<string>;
    }
  >();

  for (const competency of visibleCompetenciesInRange) {
    if (!competency.competency_name.trim()) {
      continue;
    }

    const parentRecord = visibleRecords.find(
      (record) => record.id === competency.development_record_id,
    );
    const current =
      competencyGrowthMap.get(competency.competency_name) ??
      ({
        baselineScores: [],
        currentScores: [],
        improvements: [],
        candidateIds: new Set<string>(),
      });
    current.baselineScores.push(competency.baseline_score);

    if (competency.current_score !== null) {
      current.currentScores.push(competency.current_score);
      current.improvements.push(competency.current_score - competency.baseline_score);
    }

    if (parentRecord) {
      current.candidateIds.add(parentRecord.candidate_id);
    }

    competencyGrowthMap.set(competency.competency_name, current);
  }

  const competencyGrowth = Array.from(competencyGrowthMap.entries())
    .map(([competencyName, values]) => ({
      competencyName,
      averageBaselineScore: roundToHundredth(average(values.baselineScores)),
      averageCurrentScore: roundToHundredth(average(values.currentScores)),
      averageImprovement: roundToHundredth(average(values.improvements)),
      candidateCount: values.candidateIds.size,
    }))
    .sort((left, right) => (right.averageImprovement ?? -99) - (left.averageImprovement ?? -99));

  const recommendations: DashboardRecommendation[] = [];
  const successionRisks: DashboardRecommendation[] = [];
  const learnedInsights: string[] = [];
  const liveReport: DashboardReportLine[] = [];

  if (highRiskRoles.length > 0) {
    liveReport.push({
      title: "Immediate risk watch",
      body:
        highRiskRoles.length === 1
          ? `${highRiskRoles[0]?.roleTitle ?? "One role"} currently needs immediate succession attention.`
          : `${highRiskRoles.length} roles currently need immediate succession attention, led by ${highRiskRoles
              .slice(0, 2)
              .map((role) => role.roleTitle)
              .join(", ")}.`,
    });

    for (const role of highRiskRoles.slice(0, 3)) {
      successionRisks.push({
        title: `${role.roleTitle} pipeline is high risk`,
        body:
          role.candidateCount === 0
            ? "There is no active successor currently attached to this role."
            : "This role needs more readiness progress or recent development activity.",
        href: getRoleHref(role.roleId),
      });
      recommendations.push({
        title: `Protect the ${role.roleTitle} pipeline`,
        body:
          role.candidateCount === 0
            ? "Add at least one candidate and begin a leadership development record for this role."
            : "Review candidate readiness and assign a new development experience for this role track.",
        href: getRoleHref(role.roleId),
      });
    }
  }

  if (uncoveredRoles.length > 0) {
    liveReport.push({
      title: "Coverage gap",
      body: `Critical roles still lacking active coverage: ${uncoveredRoles
        .slice(0, 3)
        .map((role) => role.title)
        .join(", ")}${uncoveredRoles.length > 3 ? ", and more." : "."}`,
    });

    recommendations.push({
      title: "Close uncovered critical-role gaps",
      body: `Uncovered roles: ${uncoveredRoles.slice(0, 3).map((role) => role.title).join(", ")}.`,
      href: "/roles",
    });
  }

  const stalledCompetency = competencyGrowth
    .slice()
    .sort((left, right) => (left.averageImprovement ?? 99) - (right.averageImprovement ?? 99))
    .find((row) => (row.averageImprovement ?? 0) <= 0.25 && row.candidateCount >= 2);

  if (stalledCompetency) {
    liveReport.push({
      title: "Development bottleneck",
      body: `${stalledCompetency.competencyName} is the slowest-moving competency across ${stalledCompetency.candidateCount} candidates in the current view.`,
    });

    successionRisks.push({
      title: `${stalledCompetency.competencyName} is stalling`,
      body: `${stalledCompetency.candidateCount} candidates are developing this competency with limited recent improvement.`,
      href: "/mentoring",
    });
    recommendations.push({
      title: `Reinforce ${stalledCompetency.competencyName}`,
      body: "Assign broader stretch experiences or cross-functional projects to move this competency forward.",
      href: "/mentoring",
    });
  }

  const overdueReviewCount = mentorEffectiveness.reduce(
    (sum, mentor) => sum + mentor.overdueReviews,
    0,
  );

  if (overdueReviewCount > 0) {
    liveReport.push({
      title: "Mentor follow-through",
      body: `${overdueReviewCount} role tracks still need a timely mentor review to keep readiness decisions current.`,
    });

    successionRisks.push({
      title: "Mentor reviews are overdue",
      body: `${overdueReviewCount} role tracks need a timely mentor review to keep development moving.`,
      href: "/mentoring",
    });
    recommendations.push({
      title: "Complete overdue mentor reviews",
      body: "Finish mentor reviews before assigning the next experience so readiness signals stay current.",
      href: "/mentoring",
    });
  }

  if (readySuccessors.near.length > 0) {
    liveReport.push({
      title: "Bench strength signal",
      body:
        readySuccessors.ready.length > 0
          ? `${readySuccessors.ready.length} successors are already role-ready and ${readySuccessors.near.length} more are near-ready.`
          : `${readySuccessors.near.length} successors are near-ready for executive review in the current filtered view.`,
    });

    recommendations.push({
      title: "Schedule executive review for near-ready successors",
      body: `${readySuccessors.near.length} candidates are approaching role-readiness and should be discussed in leadership review.`,
      href: readySuccessors.near[0]
        ? getCandidateHref(readySuccessors.near[0].candidateId)
        : "/candidates",
    });
  }

  const strongestExperience = experienceImpact
    .slice()
    .sort(
      (left, right) =>
        (right.averageCompetencyImprovement ?? -99) -
        (left.averageCompetencyImprovement ?? -99),
    )[0];

  if (strongestExperience?.averageCompetencyImprovement != null) {
    liveReport.push({
      title: "Best-performing experience",
      body: `${strongestExperience.experienceType} is currently driving the strongest measured development improvement at ${strongestExperience.averageCompetencyImprovement.toFixed(2)} points on average.`,
    });

    learnedInsights.push(
      `${strongestExperience.experienceType} is producing the strongest current growth at ${strongestExperience.averageCompetencyImprovement.toFixed(2)} points on average.`,
    );
  }

  if (stalledCompetency) {
    learnedInsights.push(
      `${stalledCompetency.competencyName} is the slowest-moving competency in the current filtered view.`,
    );
  }

  const slowestRole = averageTimeToReadiness.byRole[0];

  if (slowestRole) {
    learnedInsights.push(
      `${slowestRole.roleTitle} currently has the longest average climb to readiness at ${slowestRole.months.toFixed(1)} months.`,
    );
  }

  const strongestMentor = mentorEffectiveness
    .slice()
    .sort(
      (left, right) =>
        (right.averageCandidateImprovement ?? -99) -
        (left.averageCandidateImprovement ?? -99),
    )[0];

  if (strongestMentor?.averageCandidateImprovement != null) {
    learnedInsights.push(
      `${strongestMentor.mentorName} is currently supporting the strongest measured candidate improvement at ${strongestMentor.averageCandidateImprovement.toFixed(2)} points.`,
    );
  }

  const emptyStateMessage =
    visibleTracks.length === 0 ||
    (visibleRecords.length === 0 && visibleCompetenciesInRange.length === 0)
      ? "Leadership Continuity Intelligence will become more useful as candidates move through development records, mentor reviews, and scored feedback. Begin by adding critical roles, assigning candidates, and completing the first development records."
      : null;

  const visibilityNote =
    options.profile.role === "mentor"
      ? "Mentor view is limited to your assigned candidates and role tracks."
      : null;

  return {
    filters: options.filters,
    filterOptions: {
      departments: departmentOptions,
      roles: roleOptions,
      mentors: mentorOptions,
    },
    visibilityNote,
    developmentStorageReady: options.developmentStorageReady,
    emptyStateMessage,
    continuityScore: {
      score: continuityScore,
      label: getContinuityLabel(continuityScore),
      roleCoverageScore,
      candidateReadinessScore,
      developmentProgressScore,
      mentorEngagementScore,
      reviewCompletionScore,
    },
    organizationAward,
    criticalRolesCovered: {
      covered: coveredRoleIds.size,
      total: visibleRoles.length,
      percentage: visibleRoles.length > 0 ? Math.round((coveredRoleIds.size / visibleRoles.length) * 100) : 0,
      uncoveredRoles,
    },
    readySuccessors,
    highRiskRoles: highRiskRoles.length,
    averageTimeToReadiness,
    riskByRole,
    candidateMovement,
    mentorEffectiveness,
    experienceImpact,
    competencyGrowth,
    recommendations: recommendations.slice(0, 5),
    successionRisks: successionRisks.slice(0, 5),
    learnedInsights: learnedInsights.slice(0, 5),
    liveReport: liveReport.slice(0, 5),
  };
}

async function getDashboardSnapshot(
  authUserId: string,
  filters: DashboardFilters,
): Promise<DashboardSnapshot> {
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
      subscription: null,
      roles: [],
      mentors: [],
      candidates: [],
      counts: null,
      setupJourney: null,
      intelligence: null,
    };
  }

  const organizationId = profileResult.data.organization_id;
  const organizationResultPromise = (async () => {
    const organizationResult = await admin
      .from("organizations")
      .select("name, industry")
      .eq("id", organizationId)
      .single();

    if (isMissingOrganizationIndustryColumnError(organizationResult.error)) {
      const fallbackResult = await admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();

      if (fallbackResult.error) {
        return fallbackResult;
      }

      return {
        data: {
          ...fallbackResult.data,
          industry: null,
        },
        error: null,
      };
    }

    return organizationResult;
  })();

  const [organizationResult, subscription] = await Promise.all([
    organizationResultPromise,
    loadOrganizationSubscription(
      admin as unknown as OrganizationSubscriptionClient,
      organizationId,
    ),
  ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  const profile: DashboardProfile = {
    ...profileResult.data,
    organization_name: organizationResult.data?.name ?? "Unknown organization",
    organization_industry: organizationResult.data?.industry ?? null,
  };

  if (!hasProductAccess(subscription, "leadership_continuity")) {
    return {
      profile,
      subscription,
      roles: [],
      mentors: [],
      candidates: [],
      counts: null,
      setupJourney: null,
      intelligence: null,
    };
  }

  const [
    rolesResult,
    mentorsResult,
    candidatesResult,
    considerationsResult,
    mentorRoleAssignmentsResult,
    reportsResult,
    strengthsResult,
    sourceDocumentsResult,
    assignmentsResult,
    developmentRecordsResult,
  ] = await Promise.all([
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
      .select("id, full_name, current_title, target_role_id, mentor_profile_id, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    admin
      .from("candidate_role_considerations")
      .select("candidate_id, role_id")
      .eq("organization_id", organizationId),
    admin
      .from("mentor_role_assignments")
      .select("candidate_id, role_id, mentor_profile_id, status, start_date, created_at")
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
    admin
      .from("development_records")
      .select(
        "id, candidate_id, role_id, mentor_id, target_role, date_assigned, status, growth_areas, experience_title, readiness_signal, mentor_review_date, average_feedback_score, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
  ]);

  for (const result of [
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

  let developmentStorageReady = true;
  let developmentRecords = (developmentRecordsResult.data ?? []) as DevelopmentRecordRow[];

  if (developmentRecordsResult.error) {
    if (isMissingLeadershipDevelopmentRecordTableError(developmentRecordsResult.error)) {
      developmentStorageReady = false;
      developmentRecords = [];
    } else {
      throw new Error(developmentRecordsResult.error.message);
    }
  }

  const isMentorView = profileResult.data.role === "mentor";
  const rawRoles = ((rolesResult.data ?? []) as DashboardRole[]).map((role) => ({
    ...role,
    title: canonicalizeRoleTitle(role.title),
  }));
  const rawMentors = (mentorsResult.data ?? []) as DashboardMentor[];
  const rawCandidates = candidatesResult.data ?? [];
  const rawConsiderations = considerationsResult.data ?? [];
  const rawMentorAssignments = (mentorRoleAssignmentsResult.data ?? []) as MentorAssignment[];
  const rawReports = reportsResult.data ?? [];
  const rawStrengths = strengthsResult.data ?? [];
  const rawSourceDocuments = sourceDocumentsResult.data ?? [];
  const rawAssignments = assignmentsResult.data ?? [];

  const mentorScopedAssignments = isMentorView
    ? rawMentorAssignments.filter(
        (assignment) => assignment.mentor_profile_id === profileResult.data?.id,
      )
    : rawMentorAssignments;
  const mentorVisibleTrackKeys = new Set(
    mentorScopedAssignments.map((assignment) => `${assignment.candidate_id}:${assignment.role_id}`),
  );
  const mentorVisibleCandidateIds = new Set(
    mentorScopedAssignments.map((assignment) => assignment.candidate_id),
  );
  const mentorVisibleRoleIds = new Set(
    mentorScopedAssignments.map((assignment) => assignment.role_id),
  );

  const roles = isMentorView
    ? rawRoles.filter((role) => mentorVisibleRoleIds.has(role.id))
    : rawRoles;
  const mentors = isMentorView
    ? rawMentors.filter((mentor) => mentor.id === profileResult.data?.id)
    : rawMentors;
  const candidatesSource = isMentorView
    ? rawCandidates.filter((candidate) => mentorVisibleCandidateIds.has(candidate.id))
    : rawCandidates;
  const considerationsSource = isMentorView
    ? rawConsiderations.filter((consideration) =>
        mentorVisibleTrackKeys.has(`${consideration.candidate_id}:${consideration.role_id}`),
      )
    : rawConsiderations;
  const mentorAssignments = isMentorView ? mentorScopedAssignments : rawMentorAssignments;
  const reportsSource = isMentorView
    ? rawReports.filter((report) =>
        mentorVisibleTrackKeys.has(`${report.candidate_id}:${report.role_id}`),
      )
    : rawReports;
  const visibleCandidateIdSet = new Set(candidatesSource.map((candidate) => candidate.id));
  const strengthsSource = rawStrengths.filter((record) => visibleCandidateIdSet.has(record.candidate_id));
  const sourceDocumentsSource = rawSourceDocuments.filter((record) =>
    visibleCandidateIdSet.has(record.candidate_id),
  );
  const projectAssignmentsSource = rawAssignments.filter((record) =>
    visibleCandidateIdSet.has(record.candidate_id),
  );
  const visibleRoleIds = roles.map((role) => role.id);
  const visibleCandidateIds = candidatesSource.map((candidate) => candidate.id);
  developmentRecords = isMentorView
    ? developmentRecords.filter((record) => record.mentor_id === profileResult.data?.id)
    : developmentRecords;

  let developmentCompetencies: DevelopmentCompetencyRow[] = [];
  let developmentFeedback: DevelopmentFeedbackRow[] = [];
  let roleCompetencies: DashboardRoleCompetencyRow[] = [];
  let interviewPanels: DashboardInterviewPanelRow[] = [];
  let interviewScores: DashboardInterviewScoreRow[] = [];
  let strengthAssessments: DashboardStrengthAssessmentRow[] = [];

  if (visibleRoleIds.length > 0 && visibleCandidateIds.length > 0) {
    const [roleCompetenciesResult, interviewPanelsResult, strengthAssessmentsResult] =
      await Promise.all([
        admin
          .from("role_competencies")
          .select("role_id, id, name, target_score, weight")
          .eq("organization_id", organizationId)
          .in("role_id", visibleRoleIds),
        admin
          .from("interview_panels")
          .select("id, candidate_id, role_id")
          .eq("organization_id", organizationId)
          .in("candidate_id", visibleCandidateIds)
          .in("role_id", visibleRoleIds),
        admin
          .from("candidate_role_strength_assessments")
          .select(
            "candidate_id, role_id, competency_id, strength_score, supporting_strengths, rationale",
          )
          .eq("organization_id", organizationId)
          .in("candidate_id", visibleCandidateIds)
          .in("role_id", visibleRoleIds),
      ]);

    for (const result of [
      roleCompetenciesResult,
      interviewPanelsResult,
      strengthAssessmentsResult,
    ]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    roleCompetencies = (roleCompetenciesResult.data ?? []) as DashboardRoleCompetencyRow[];
    interviewPanels = (interviewPanelsResult.data ?? []).filter((panel) =>
      isMentorView
        ? mentorVisibleTrackKeys.has(`${panel.candidate_id}:${panel.role_id}`)
        : true,
    ) as DashboardInterviewPanelRow[];
    strengthAssessments = (strengthAssessmentsResult.data ?? []).filter((assessment) =>
      isMentorView
        ? mentorVisibleTrackKeys.has(`${assessment.candidate_id}:${assessment.role_id}`)
        : true,
    ) as DashboardStrengthAssessmentRow[];

    const panelIds = interviewPanels.map((panel) => panel.id);
    if (panelIds.length > 0) {
      const interviewScoresResult = await admin
        .from("interview_scores")
        .select("panel_id, competency_id, score_numeric, evidence_notes, concern_notes")
        .in("panel_id", panelIds);

      if (interviewScoresResult.error) {
        throw new Error(interviewScoresResult.error.message);
      }

      interviewScores = (interviewScoresResult.data ?? []) as DashboardInterviewScoreRow[];
    }
  }

  if (developmentStorageReady && developmentRecords.length > 0) {
    const recordIds = developmentRecords.map((record) => record.id);
    const [competenciesResult, feedbackResult] = await Promise.all([
      admin
        .from("development_record_competencies")
        .select(
          "development_record_id, competency_name, baseline_score, target_score, current_score",
        )
        .in("development_record_id", recordIds),
      admin
        .from("development_record_feedback")
        .select("development_record_id")
        .in("development_record_id", recordIds),
    ]);

    if (competenciesResult.error) {
      if (isMissingLeadershipDevelopmentRecordTableError(competenciesResult.error)) {
        developmentStorageReady = false;
      } else {
        throw new Error(competenciesResult.error.message);
      }
    } else {
      developmentCompetencies =
        (competenciesResult.data ?? []) as DevelopmentCompetencyRow[];
    }

    if (feedbackResult.error) {
      if (isMissingLeadershipDevelopmentRecordTableError(feedbackResult.error)) {
        developmentStorageReady = false;
      } else {
        throw new Error(feedbackResult.error.message);
      }
    } else {
      developmentFeedback = (feedbackResult.data ?? []) as DevelopmentFeedbackRow[];
    }
  }

  const roleMap = new Map(roles.map((role) => [role.id, role.title]));
  const mentorMap = new Map(mentors.map((mentor) => [mentor.id, mentor.full_name]));
  const considerationsByCandidate = new Map<string, string[]>();
  const mentorIdsByCandidate = new Map<string, string[]>();
  const mentorNamesByCandidate = new Map<string, string[]>();
  const candidateRolePairsWithReports = new Set(
    reportsSource.map((record) => `${record.candidate_id}:${record.role_id}`),
  );
  const candidateIdsWithStrengths = new Set(
    strengthsSource.map((record) => record.candidate_id),
  );
  const candidateIdsWithSourceDocuments = new Set(
    sourceDocumentsSource.map((record) => record.candidate_id),
  );
  const candidateIdsWithAssignments = new Set(
    projectAssignmentsSource.map((record) => record.candidate_id),
  );

  for (const consideration of considerationsSource) {
    const current = considerationsByCandidate.get(consideration.candidate_id) ?? [];
    current.push(consideration.role_id);
    considerationsByCandidate.set(consideration.candidate_id, current);
  }

  for (const assignment of mentorAssignments) {
    const currentIds = mentorIdsByCandidate.get(assignment.candidate_id) ?? [];
    currentIds.push(assignment.mentor_profile_id);
    mentorIdsByCandidate.set(assignment.candidate_id, currentIds);

    const mentorName = mentorMap.get(assignment.mentor_profile_id);

    if (mentorName) {
      const currentNames = mentorNamesByCandidate.get(assignment.candidate_id) ?? [];
      currentNames.push(mentorName);
      mentorNamesByCandidate.set(assignment.candidate_id, currentNames);
    }
  }

  const candidates = candidatesSource.map((candidate) => {
    const hasStrengths =
      candidateIdsWithStrengths.has(candidate.id) ||
      candidateIdsWithSourceDocuments.has(candidate.id);
    const considerationRoleIds = considerationsByCandidate.get(candidate.id) ?? [];
    const fallbackRoleIds =
      candidate.target_role_id && roleMap.has(candidate.target_role_id)
        ? [candidate.target_role_id]
        : [];
    const roleIds = Array.from(new Set([...considerationRoleIds, ...fallbackRoleIds]));
    const mentorIds = Array.from(
      new Set(mentorIdsByCandidate.get(candidate.id) ?? []),
    );
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
      created_at: candidate.created_at,
      role_ids: roleIds,
      role_titles: roleIds
        .map((roleId) => roleMap.get(roleId))
        .filter((title): title is string => Boolean(title)),
      mentor_profile_ids: mentorIds,
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
    } satisfies DashboardCandidate;
  });

  return {
    profile,
    subscription,
    roles,
    mentors,
    candidates,
    counts: {
      roles: roles.length,
      candidates: candidates.length,
      mentors: mentors.length,
    },
    setupJourney: isMentorView
      ? null
      : buildDashboardSetupJourney({
          organizationName: profile.organization_name,
          roleCount: roles.length,
          candidateCount: candidates.length,
          mentorCount: mentors.length,
          mentorAssignmentCount: mentorAssignments.length,
          developmentRecordCount: developmentRecords.length,
        }),
    intelligence: buildDashboardIntelligence({
      profile,
      roles,
      mentors,
      candidates,
      mentorAssignments,
      developmentRecords,
      developmentCompetencies,
      developmentFeedback,
      roleCompetencies,
      interviewPanels,
      interviewScores,
      strengthAssessments,
      filters,
      developmentStorageReady,
    }),
  };
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const filters = parseDashboardFilters(resolvedSearchParams);
  const setupToken = createWorkspaceSetupToken({
    userId: user.id,
    email: user.email ?? "",
  });
  const snapshot = await getDashboardSnapshot(user.id, filters);
  const intelligence = snapshot.intelligence;
  const organizationAwardAsset = intelligence?.organizationAward.tier
    ? getLegacyCertificationAsset(intelligence.organizationAward.tier)
    : null;

  if (snapshot.profile?.role === "candidate") {
    redirect(
      "/candidates?message=Candidate+accounts+can+only+view+their+own+candidate+records",
    );
  }

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
        {resolvedSearchParams.message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
            {resolvedSearchParams.message}
          </div>
        ) : null}

        {!snapshot.profile ? (
          <section className="theme-panel-strong rounded-[2rem] p-5 sm:p-8">
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
              First-Time Setup
            </p>
            <h1 className="mt-3 font-display text-5xl leading-tight text-slate-900">
              Create the organization workspace first
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Signed in as <span className="font-semibold">{user.email}</span>.
              Create the admin profile and organization before using the
              {" "}
              organization
              dashboard.
            </p>

            <WorkspaceSetupForm
              authEmail={user.email ?? ""}
              authUserId={user.id}
              defaultFullName={getSetupDefaultFullName(user)}
              defaultOrganizationName="Leadership Continuity Demo Organization"
              defaultIndustryName="Healthcare"
              setupToken={setupToken}
            />
          </section>
        ) : snapshot.subscription &&
          !hasProductAccess(snapshot.subscription, "leadership_continuity") ? (
          <SubscriptionPaywallPanel
            canOpenLeadershipHelp={canAccessLeadershipHelpPreview({
              email: user.email,
              organizationId: snapshot.profile.organization_id,
              role: snapshot.profile.role,
            })}
            organizationName={snapshot.profile.organization_name}
            subscription={snapshot.subscription}
          />
        ) : (
          <>
            <section className="theme-panel-strong rounded-[2rem] p-5 sm:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
                <div>
                  <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                    Organization Dashboard
                  </p>
                  <h1 className="mt-3 font-display text-4xl leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                    {snapshot.profile.organization_name}
                  </h1>
                  {snapshot.profile.organization_industry ? (
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {snapshot.profile.organization_industry}
                    </p>
                  ) : null}
                  <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                    Welcome to the Leadership Continuity System. This is where your
                    organization can define critical roles, identify high-potential
                    candidates, connect them with mentors, and guide their
                    development over time so you can build a stronger next
                    generation of leaders. You are signed in as{" "}
                    <span className="font-semibold">{user.email}</span>.
                  </p>
                </div>

                {intelligence ? (
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Legacy Certification
                    </p>
                    {intelligence.organizationAward.tier && organizationAwardAsset ? (
                      <div className="mt-3 flex items-center gap-3">
                        <Image
                          src={organizationAwardAsset.src}
                          alt={organizationAwardAsset.alt}
                          width={68}
                          height={68}
                          className="h-[4.25rem] w-[4.25rem] rounded-full object-cover"
                        />
                        <p className="text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                          {organizationAwardAsset.shortLabel}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                        Not Yet
                      </p>
                    )}
                    <p className="mt-2 text-sm font-semibold text-teal-800">
                      {intelligence.organizationAward.protectedRoleCount} protected role
                      {intelligence.organizationAward.protectedRoleCount === 1
                        ? ""
                        : "s"}
                    </p>
                    <div className="mt-3 grid gap-1.5 text-[11px] text-slate-600">
                      <p>
                        Top roles protected{" "}
                        {intelligence.organizationAward.protectedTopPriorityRoleCount}/
                        {intelligence.organizationAward.topPriorityRoleCount}
                      </p>
                      <p>
                        Top roles covered{" "}
                        {intelligence.organizationAward.coveredTopPriorityRoleCount}/
                        {intelligence.organizationAward.topPriorityRoleCount}
                      </p>
                      <p>
                        Two-deep top roles{" "}
                        {intelligence.organizationAward.twoDeepTopPriorityRoleCount}/
                        {intelligence.organizationAward.topPriorityRoleCount}
                      </p>
                    </div>
                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      {intelligence.organizationAward.description}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-slate-400">
                      Top-role ranking currently follows the visible role order in
                      this dashboard view.
                    </p>
                  </article>
                ) : null}
              </div>
            </section>

            {snapshot.setupJourney ? (
              <DashboardSetupJourney summary={snapshot.setupJourney} />
            ) : null}

            {intelligence ? (
              <section className="theme-panel-strong rounded-[2rem] p-5 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
                      Leadership Continuity Intelligence
                    </p>
                    <h2 className="mt-3 font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
                      See whether your bench is getting stronger
                    </h2>
                    <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
                      This section learns from candidate movement, development
                      records, mentor engagement, and competency growth so the
                      leadership team can see where succession risk is rising and
                      where leadership strength is improving.
                    </p>
                  </div>
                  <Link
                    href={buildDashboardHref(intelligence.filters, {
                      recommendationsOpen: !intelligence.filters.recommendationsOpen,
                    })}
                    className="interactive-contrast w-full rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-900 sm:w-auto"
                  >
                    Generate Continuity Recommendations
                  </Link>
                </div>

                {intelligence.visibilityNote ? (
                  <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-7 text-sky-900">
                    {intelligence.visibilityNote}
                  </div>
                ) : null}

                {!intelligence.developmentStorageReady ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                    Leadership development record storage is not active yet. The
                    intelligence dashboard is showing only the data already
                    available in the current workspace.
                  </div>
                ) : null}

                <form className="mt-6 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]" method="get">
                  <label className="block text-sm font-semibold text-slate-700">
                    Time window
                    <select
                      name="timeRange"
                      defaultValue={intelligence.filters.timeRange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-teal-500"
                    >
                      {TIME_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Department
                    <select
                      name="department"
                      defaultValue={intelligence.filters.department}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-teal-500"
                    >
                      <option value="">All departments</option>
                      {intelligence.filterOptions.departments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Target role
                    <select
                      name="targetRole"
                      defaultValue={intelligence.filters.targetRole}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-teal-500"
                    >
                      <option value="">All target roles</option>
                      {intelligence.filterOptions.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Mentor
                    <select
                      name="mentorId"
                      defaultValue={intelligence.filters.mentorId}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-teal-500"
                    >
                      <option value="">All mentors</option>
                      {intelligence.filterOptions.mentors.map((mentor) => (
                        <option key={mentor.id} value={mentor.id}>
                          {mentor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Readiness status
                    <select
                      name="readiness"
                      defaultValue={intelligence.filters.readiness}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-teal-500"
                    >
                      {READINESS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    type="hidden"
                    name="recommendations"
                    value={intelligence.filters.recommendationsOpen ? "open" : ""}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 sm:w-auto 2xl:self-end"
                  >
                    Apply Filters
                  </button>
                  <Link
                    href="/dashboard"
                    className="w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto 2xl:self-end"
                  >
                    Reset
                  </Link>
                </form>

                {intelligence.emptyStateMessage ? (
                  <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-600">
                    {intelligence.emptyStateMessage}
                  </div>
                ) : null}

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Leadership Continuity Score
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                      {intelligence.continuityScore.score}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-teal-800">
                      {intelligence.continuityScore.label}
                    </p>
                    <div className="mt-3 grid gap-1.5 text-[11px] text-slate-600">
                      <p>Coverage {formatPercent(intelligence.continuityScore.roleCoverageScore)}</p>
                      <p>Readiness {formatPercent(intelligence.continuityScore.candidateReadinessScore)}</p>
                      <p>Progress {formatPercent(intelligence.continuityScore.developmentProgressScore)}</p>
                    </div>
                  </article>
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Critical Roles Covered
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                      {intelligence.criticalRolesCovered.covered}/{intelligence.criticalRolesCovered.total}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatPercent(intelligence.criticalRolesCovered.percentage)} covered
                    </p>
                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      {intelligence.criticalRolesCovered.uncoveredRoles.length > 0
                        ? `Uncovered: ${intelligence.criticalRolesCovered.uncoveredRoles
                            .slice(0, 3)
                            .map((role) => role.title)
                            .join(", ")}`
                        : "All visible roles currently have at least one active candidate."}
                    </p>
                  </article>
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Ready Successors
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                      {intelligence.readySuccessors.near.length + intelligence.readySuccessors.ready.length}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {intelligence.readySuccessors.near.length} near-ready • {intelligence.readySuccessors.ready.length} role-ready
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                      {[...intelligence.readySuccessors.ready, ...intelligence.readySuccessors.near]
                        .slice(0, 3)
                        .map((candidate) => (
                          <Link
                            key={`${candidate.candidateId}:${candidate.roleId}`}
                            href={getCandidateHref(candidate.candidateId)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-900"
                          >
                            {candidate.name}
                          </Link>
                        ))}
                    </div>
                  </article>
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      High-Risk Roles
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                      {intelligence.highRiskRoles}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Roles needing immediate continuity attention
                    </p>
                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      {intelligence.riskByRole
                        .filter((role) => role.riskLevel === "High Risk")
                        .slice(0, 2)
                        .map((role) => role.roleTitle)
                        .join(", ") || "No high-risk roles in the current filtered view."}
                    </p>
                  </article>
                  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Average Time to Readiness
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                      {intelligence.averageTimeToReadiness.overallMonths !== null
                        ? `${intelligence.averageTimeToReadiness.overallMonths.toFixed(1)} mo`
                        : "-"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Near-ready {intelligence.averageTimeToReadiness.nearMonths !== null ? `${intelligence.averageTimeToReadiness.nearMonths.toFixed(1)} mo` : "-"} • Role-ready {intelligence.averageTimeToReadiness.roleReadyMonths !== null ? `${intelligence.averageTimeToReadiness.roleReadyMonths.toFixed(1)} mo` : "-"}
                    </p>
                  </article>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                          Leadership Risk by Role
                        </p>
                        <h3 className="mt-2 font-display text-3xl text-slate-900">
                          Succession risk by role pipeline
                        </h3>
                      </div>
                      <Link
                        href="/roles"
                        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                      >
                        Open Roles
                      </Link>
                    </div>
                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                        <thead>
                          <tr className="text-left text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            <th className="pb-3 pr-4">Role</th>
                            <th className="pb-3 pr-4">Candidates</th>
                            <th className="pb-3 pr-4">Highest Readiness</th>
                            <th className="pb-3 pr-4">Last Activity</th>
                            <th className="pb-3">Risk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {intelligence.riskByRole.length > 0 ? (
                            intelligence.riskByRole.map((row) => (
                              <tr key={row.roleId}>
                                <td className="py-4 pr-4 align-top">
                                  <Link
                                    href={getRoleHref(row.roleId)}
                                    className="font-semibold text-slate-900 transition hover:text-teal-900"
                                  >
                                    {row.roleTitle}
                                  </Link>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {row.department || "Department not entered"}
                                  </p>
                                </td>
                                <td className="py-4 pr-4 align-top">
                                  <p className="font-semibold text-slate-900">{row.candidateCount}</p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    {row.candidateLinks.slice(0, 3).map((candidate) => (
                                      <Link
                                        key={`${candidate.candidateId}:${candidate.roleId}`}
                                        href={getCandidateHref(candidate.candidateId)}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-900"
                                      >
                                        {candidate.name}
                                      </Link>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-4 pr-4 align-top font-semibold text-slate-900">
                                  {formatReadinessPercent(row.highestReadinessPercent)}
                                </td>
                                <td className="py-4 pr-4 align-top text-slate-600">
                                  {formatDate(row.lastDevelopmentActivity)}
                                </td>
                                <td className="py-4 align-top">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      row.riskLevel === "Low Risk"
                                        ? "bg-teal-100 text-teal-900"
                                        : row.riskLevel === "Moderate Risk"
                                          ? "bg-amber-100 text-amber-900"
                                          : "bg-rose-100 text-rose-900"
                                    }`}
                                  >
                                    {row.riskLevel}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-sm text-slate-500">
                                No roles match the current filter set.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section id="recommendations" className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Recommended Next Actions
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-slate-900">
                      What the Leadership Continuity System is telling you next
                    </h3>
                    {intelligence.liveReport.length > 0 ? (
                      <div className="mt-5 grid gap-3">
                        {intelligence.liveReport.map((line) => (
                          <article
                            key={line.title}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <p className="font-semibold text-slate-900">{line.title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {line.body}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 text-sm leading-7 text-slate-600">
                        More organization-specific development history is needed before reliable trend recommendations can be generated.
                      </p>
                    )}

                    {intelligence.filters.recommendationsOpen ? (
                      <>
                        {intelligence.recommendations.length > 0 ? (
                          <div className="mt-6 grid gap-3">
                            {intelligence.recommendations.map((recommendation) => (
                              <article
                                key={recommendation.title}
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                              >
                                <p className="font-semibold text-slate-900">
                                  {recommendation.title}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  {recommendation.body}
                                </p>
                                {recommendation.href ? (
                                  <Link
                                    href={recommendation.href}
                                    className="mt-3 inline-flex text-sm font-semibold text-teal-900 transition hover:text-teal-700"
                                  >
                                    Open related workspace
                                  </Link>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        ) : null}

                        {intelligence.successionRisks.length > 0 ? (
                          <div className="mt-6">
                            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                              Top succession risks
                            </p>
                            <div className="mt-3 grid gap-3">
                              {intelligence.successionRisks.map((risk) => (
                                <article
                                  key={risk.title}
                                  className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm"
                                >
                                  <p className="font-semibold text-rose-900">{risk.title}</p>
                                  <p className="mt-2 leading-6 text-rose-900/80">{risk.body}</p>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {intelligence.learnedInsights.length > 0 ? (
                          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                              Learned signals from this organization
                            </p>
                            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                              {intelligence.learnedInsights.map((insight) => (
                                <p key={insight}>{insight}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-6">
                        <p className="text-sm leading-7 text-slate-600">
                          Open the full recommendation set to see detailed action
                          cards, succession risks, and learned organizational
                          signals behind this live summary.
                        </p>
                        <Link
                          href={buildDashboardHref(intelligence.filters, {
                            recommendationsOpen: true,
                          })}
                          className="interactive-contrast mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                        >
                          Open Full Recommendation Set
                        </Link>
                      </div>
                    )}
                  </section>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Candidate Movement
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-slate-900">
                      Movement during the selected period
                    </h3>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        ["Improved", intelligence.candidateMovement.improved],
                        ["No Change", intelligence.candidateMovement.noChange],
                        ["Declined", intelligence.candidateMovement.declined],
                        ["Completed Program", intelligence.candidateMovement.completedProgram],
                        ["Removed from Pipeline", intelligence.candidateMovement.removedFromPipeline],
                      ].map(([label, value]) => (
                        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            {label}
                          </p>
                          <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Competency Growth Trends
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-slate-900">
                      Which competencies are moving
                    </h3>
                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                        <thead>
                          <tr className="text-left text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            <th className="pb-3 pr-4">Competency</th>
                            <th className="pb-3 pr-4">Baseline</th>
                            <th className="pb-3 pr-4">Current</th>
                            <th className="pb-3 pr-4">Improvement</th>
                            <th className="pb-3">Candidates</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {intelligence.competencyGrowth.length > 0 ? (
                            intelligence.competencyGrowth.slice(0, 8).map((row) => (
                              <tr key={row.competencyName}>
                                <td className="py-4 pr-4 font-semibold text-slate-900">
                                  {row.competencyName}
                                </td>
                                <td className="py-4 pr-4">{formatScore(row.averageBaselineScore)}</td>
                                <td className="py-4 pr-4">{formatScore(row.averageCurrentScore)}</td>
                                <td className="py-4 pr-4 font-semibold text-slate-900">
                                  {formatScore(row.averageImprovement)}
                                </td>
                                <td className="py-4">{row.candidateCount}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-sm text-slate-500">
                                Not enough scored competency history is available for the current filter set.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Mentor Effectiveness
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-slate-900">
                      Support and coaching momentum
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Use this as a coaching-support metric, not a punitive score.
                    </p>
                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                        <thead>
                          <tr className="text-left text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            <th className="pb-3 pr-4">Mentor</th>
                            <th className="pb-3 pr-4">Active Candidates</th>
                            <th className="pb-3 pr-4">Completed Reviews</th>
                            <th className="pb-3 pr-4">Avg Improvement</th>
                            <th className="pb-3 pr-4">Overdue</th>
                            <th className="pb-3">Avg Reviewer Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {intelligence.mentorEffectiveness.filter((mentor) => Boolean(mentor?.mentorId && mentor?.mentorName)).length > 0 ? (
                            intelligence.mentorEffectiveness.filter((mentor) => Boolean(mentor?.mentorId && mentor?.mentorName)).map((mentor) => (
                              <tr key={mentor.mentorId}>
                                <td className="py-4 pr-4 font-semibold text-slate-900">
                                  {mentor.mentorName}
                                </td>
                                <td className="py-4 pr-4">{mentor.activeCandidates}</td>
                                <td className="py-4 pr-4">{mentor.completedReviews}</td>
                                <td className="py-4 pr-4">{formatScore(mentor.averageCandidateImprovement)}</td>
                                <td className="py-4 pr-4">{mentor.overdueReviews}</td>
                                <td className="py-4">{formatScore(mentor.averageReviewerScore)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="py-6 text-sm text-slate-500">
                                No mentor activity matches the current filters yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-500 uppercase">
                      Development Experience Impact
                    </p>
                    <h3 className="mt-2 font-display text-3xl text-slate-900">
                      Which experiences are producing growth
                    </h3>
                    <div className="mt-5 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
                        <thead>
                          <tr className="text-left text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            <th className="pb-3 pr-4">Experience Type</th>
                            <th className="pb-3 pr-4">Assigned</th>
                            <th className="pb-3 pr-4">Avg Improvement</th>
                            <th className="pb-3 pr-4">Avg Reviewer Score</th>
                            <th className="pb-3">Most Improved Competency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {intelligence.experienceImpact.length > 0 ? (
                            intelligence.experienceImpact.map((row) => (
                              <tr key={row.experienceType}>
                                <td className="py-4 pr-4 font-semibold text-slate-900">
                                  {row.experienceType}
                                </td>
                                <td className="py-4 pr-4">{row.assignedCount}</td>
                                <td className="py-4 pr-4">{formatScore(row.averageCompetencyImprovement)}</td>
                                <td className="py-4 pr-4">{formatScore(row.averageReviewerScore)}</td>
                                <td className="py-4">{row.mostImprovedCompetency || "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-sm text-slate-500">
                                Development experience impact will appear once completed records begin collecting scored competencies and feedback.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Roles
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                  {snapshot.counts?.roles ?? 0}
                </p>
              </article>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Candidates
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                  {snapshot.counts?.candidates ?? 0}
                </p>
              </article>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Current Mentors
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900 lg:text-[2rem]">
                  {snapshot.counts?.mentors ?? 0}
                </p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                    className="interactive-contrast w-full rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-teal-900 sm:w-auto"
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
                      No roles are in the Leadership Continuity System yet.
                    </article>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                    className="interactive-contrast w-full rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-teal-900 sm:w-auto"
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
                            <Link
                              href={getCandidateHref(candidate.id)}
                              className="font-semibold text-slate-900 transition hover:text-teal-900"
                            >
                              {candidate.full_name}
                            </Link>
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
                      No candidates are in the Leadership Continuity System yet.
                    </article>
                  )}
                </div>
              </div>
            </section>

            {snapshot.profile.role !== "mentor" ? (
              <MentorDirectoryManager mentors={snapshot.mentors} />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
