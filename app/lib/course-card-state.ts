import type { EnrollmentStatus } from "./api";

export type CourseCardAction = "start" | "continue" | "restart";

export type CourseCardState = {
  status: EnrollmentStatus;
  isCurrent: boolean;
  actions: CourseCardAction[];
};

const actionsByStatus: Record<EnrollmentStatus, CourseCardAction[]> = {
  not_started: ["start"],
  in_progress: ["restart", "continue"],
  completed: ["restart"],
};

// Buttons follow the server's progress status; "current" (the active
// enrollment) is only a highlight layered on top. The status comes off the
// wire, so anything unrecognised falls back instead of crashing the catalog.
// A current course with no status means the server predates `status`; keep
// its Continue/Restart buttons rather than dropping to Start.
export function courseCardState(status: EnrollmentStatus | undefined, isCurrent: boolean): CourseCardState {
  const known = typeof status === "string" && Object.hasOwn(actionsByStatus, status);
  const resolved: EnrollmentStatus = known ? status : isCurrent && status == null ? "in_progress" : "not_started";
  return { status: resolved, isCurrent, actions: actionsByStatus[resolved] };
}
