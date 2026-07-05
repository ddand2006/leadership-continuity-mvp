"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FLOWCHART_ACTION_DISABLED_CLASS,
  FLOWCHART_ACTION_ENABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_DISABLED_CLASS,
  FLOWCHART_MOBILE_ACTION_ENABLED_CLASS,
  FLOWCHART_SELECT_INPUT_CLASS,
  FLOWCHART_SELECT_PANEL_CLASS,
  FLOWCHART_START_BUTTON_CLASS,
} from "@/components/flowchart-theme";

type MentorFlowSection =
  | "mentor-assignments"
  | "preparation-worksheet"
  | "leadership-development-record"
  | "departmental-project"
  | "cross-departmental-project";

type MentorFlowAssignment = {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
  candidateName: string;
  currentTitle: string | null;
  roleTitle: string;
  mentorName: string;
  mentorPositionTitle: string | null;
  hasPreparationWorksheet: boolean;
  hasDepartmentalWorksheet: boolean;
  hasCrossDepartmentalWorksheet: boolean;
  hasReport: boolean;
};

type FlowAction = {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

const CREATE_MENTOR_TRACK_VALUE = "__mentor_assignments__";

function getAssignmentKey(assignment: {
  candidateId: string;
  roleId: string;
  mentorProfileId: string;
}) {
  return `${assignment.candidateId}:${assignment.roleId}:${assignment.mentorProfileId}`;
}

export function MentorFlowPanel({
  assignments,
  selectedAssignmentKey,
  canManageAssignments,
  canChooseMentor,
}: {
  assignments: MentorFlowAssignment[];
  selectedAssignmentKey: string | null;
  canManageAssignments: boolean;
  canChooseMentor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get("section");
  const selectedAssignment =
    assignments.find(
      (assignment) => getAssignmentKey(assignment) === selectedAssignmentKey,
    ) ?? null;

  function buildMentoringHref(
    section: MentorFlowSection | "overview",
    assignment?: MentorFlowAssignment | null,
  ) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("section", section);

    if (assignment) {
      nextParams.set("candidateId", assignment.candidateId);
      nextParams.set("roleId", assignment.roleId);
      nextParams.set("mentorProfileId", assignment.mentorProfileId);
    } else {
      nextParams.delete("candidateId");
      nextParams.delete("roleId");
      nextParams.delete("mentorProfileId");
    }

    const nextQuery = nextParams.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  }

  function updateRoute(
    section: MentorFlowSection | "overview",
    assignment?: MentorFlowAssignment | null,
  ) {
    router.push(buildMentoringHref(section, assignment));
  }

  const actions: FlowAction[] = [
    {
      title: "Leadership Development Record",
      description: selectedAssignment
        ? "Open the living development record for this role track to assign the experience, track competencies, and collect feedback."
        : "Choose a candidate-role track first to open the leadership development record.",
      onClick: selectedAssignment
        ? () => updateRoute("leadership-development-record", selectedAssignment)
        : undefined,
      disabled: !selectedAssignment,
    },
    {
      title: "Open Candidate Report",
      description: selectedAssignment
        ? selectedAssignment.hasReport
          ? "Open the candidate workspace and review the mentor report in context."
          : "Open the candidate workspace to generate or review the mentor report."
        : "Choose a candidate-role track first to open the candidate workspace.",
      href: selectedAssignment
        ? `/candidates/${selectedAssignment.candidateId}?section=mentor-report&roleId=${selectedAssignment.roleId}`
        : undefined,
      disabled: !selectedAssignment,
    },
  ];
  const createActionLabel = canChooseMentor ? "Assign mentor" : "Attach candidate";
  const startLabel = canManageAssignments ? (
    <>
      {canChooseMentor ? "ASSIGN" : "ATTACH"}
      <br />
      {canChooseMentor ? "MENTOR" : "CANDIDATE"}
    </>
  ) : (
    <>
      YOUR
      <br />
      TRACK
    </>
  );

  return (
    <section className="theme-panel rounded-[1.75rem] p-8">
      <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
        Mentoring Flow
      </p>
      <h2 className="mt-3 font-display text-3xl text-slate-900">
        Follow one clear mentoring workflow
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
        Move from mentor assignment into the development record, supporting
        worksheets, and the candidate report without losing the candidate-role
        context of the mentoring track.
      </p>

      {assignments.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
          {canManageAssignments ? (
            <>
              No mentoring tracks exist yet. Start with{" "}
              <span className="font-semibold">
                {canChooseMentor ? "Assign Mentor" : "Attach Candidate"}
              </span>{" "}
              to create the first role-based mentoring track.
            </>
          ) : (
            "No mentoring track is assigned to your candidate account yet."
          )}
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <div className="hidden min-w-[980px] grid-cols-[12rem_16rem_1fr] items-center gap-10 lg:grid">
          <div className="flex justify-center">
            <div
              className={`group relative flex h-36 w-36 items-center justify-center ${FLOWCHART_START_BUTTON_CLASS}`}
              style={{ transform: "rotate(45deg)" }}
            >
              <span
                className="px-4 text-center text-lg font-semibold leading-6"
                style={{ transform: "rotate(-45deg)" }}
              >
                {startLabel}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-[-2.5rem] h-[2px] w-10 -translate-y-1/2 bg-slate-900" />
            <div className={FLOWCHART_SELECT_PANEL_CLASS}>
              <p className="text-center text-lg font-semibold">Select Track</p>
              <select
                className={FLOWCHART_SELECT_INPUT_CLASS}
                value={
                  canManageAssignments &&
                  currentSection === "mentor-assignments" &&
                  !selectedAssignment
                    ? CREATE_MENTOR_TRACK_VALUE
                    : (selectedAssignment ? getAssignmentKey(selectedAssignment) : "")
                }
                onChange={(event) => {
                  if (event.currentTarget.value === CREATE_MENTOR_TRACK_VALUE) {
                    updateRoute("mentor-assignments", null);
                    return;
                  }

                  const nextAssignment =
                    assignments.find(
                      (assignment) =>
                        getAssignmentKey(assignment) === event.currentTarget.value,
                    ) ?? null;

                  updateRoute("overview", nextAssignment);
                }}
              >
                <option value="" className="text-slate-900">
                  Select mentoring track
                </option>
                {canManageAssignments ? (
                  <option value={CREATE_MENTOR_TRACK_VALUE} className="text-slate-900">
                    {createActionLabel}
                  </option>
                ) : null}
                {assignments.map((assignment) => (
                  <option
                    key={getAssignmentKey(assignment)}
                    value={getAssignmentKey(assignment)}
                    className="text-slate-900"
                  >
                    {assignment.candidateName} - {assignment.roleTitle}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-center text-xs leading-6 text-white/80">
                {selectedAssignment
                  ? `${selectedAssignment.candidateName} • ${selectedAssignment.roleTitle} • ${selectedAssignment.mentorName}`
                  : "Choose one mentoring track to activate the next steps."}
              </p>
            </div>
            <div className="absolute top-1/2 left-full h-[2px] w-14 -translate-y-1/2 bg-slate-900" />
          </div>

          <div className="relative pl-14">
            <div className="absolute top-12 left-3 bottom-12 w-[2px] bg-slate-900" />
            <div className="flex flex-col gap-6">
              {actions.map((action) => (
                <div key={action.title} className="relative">
                  <div className="absolute top-1/2 left-[-2.75rem] h-[2px] w-11 -translate-y-1/2 bg-slate-900" />
                  {action.href && !action.disabled ? (
                    <Link href={action.href} className={FLOWCHART_ACTION_ENABLED_CLASS}>
                      <p className="text-center text-2xl font-semibold leading-tight">
                        {action.title}
                      </p>
                      <p className="mt-3 text-center text-sm leading-6 text-white/80">
                        {action.description}
                      </p>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={`w-full ${
                        action.disabled
                          ? FLOWCHART_ACTION_DISABLED_CLASS
                          : FLOWCHART_ACTION_ENABLED_CLASS
                      }`}
                    >
                      <p className="text-center text-2xl font-semibold leading-tight">
                        {action.title}
                      </p>
                      <p className="mt-3 text-center text-sm leading-6">
                        {action.description}
                      </p>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:hidden">
          <div className={FLOWCHART_START_BUTTON_CLASS}>
            <p className="text-sm font-semibold tracking-[0.14em] uppercase">
              Start
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {canManageAssignments
                ? (canChooseMentor ? "Assign Mentor" : "Attach Candidate")
                : "Your Mentoring Track"}
            </p>
          </div>

          <div className={FLOWCHART_SELECT_PANEL_CLASS}>
            <p className="text-sm font-semibold tracking-[0.14em] uppercase">
              Select Track
            </p>
            <select
              className={FLOWCHART_SELECT_INPUT_CLASS}
              value={
                canManageAssignments &&
                currentSection === "mentor-assignments" &&
                !selectedAssignment
                  ? CREATE_MENTOR_TRACK_VALUE
                  : (selectedAssignment ? getAssignmentKey(selectedAssignment) : "")
              }
              onChange={(event) => {
                if (event.currentTarget.value === CREATE_MENTOR_TRACK_VALUE) {
                  updateRoute("mentor-assignments", null);
                  return;
                }

                const nextAssignment =
                  assignments.find(
                    (assignment) =>
                      getAssignmentKey(assignment) === event.currentTarget.value,
                  ) ?? null;

                updateRoute("overview", nextAssignment);
              }}
            >
              <option value="" className="text-slate-900">
                Select mentoring track
              </option>
              {canManageAssignments ? (
                <option value={CREATE_MENTOR_TRACK_VALUE} className="text-slate-900">
                  {createActionLabel}
                </option>
              ) : null}
              {assignments.map((assignment) => (
                <option
                  key={getAssignmentKey(assignment)}
                  value={getAssignmentKey(assignment)}
                  className="text-slate-900"
                >
                  {assignment.candidateName} - {assignment.roleTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4">
            {actions.map((action) =>
              action.href && !action.disabled ? (
                <Link
                  key={action.title}
                  href={action.href}
                  className={FLOWCHART_MOBILE_ACTION_ENABLED_CLASS}
                >
                  <p className="text-lg font-semibold text-white">{action.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    {action.description}
                  </p>
                </Link>
              ) : (
                <button
                  key={action.title}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={
                    action.disabled
                      ? FLOWCHART_MOBILE_ACTION_DISABLED_CLASS
                      : FLOWCHART_MOBILE_ACTION_ENABLED_CLASS
                  }
                >
                  <p
                    className={`text-lg font-semibold ${
                      action.disabled ? "text-slate-700" : "text-white"
                    }`}
                  >
                    {action.title}
                  </p>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      action.disabled ? "text-slate-600" : "text-white/80"
                    }`}
                  >
                    {action.description}
                  </p>
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
