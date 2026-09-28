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
// enrollment) is only a highlight layered on top.
export function courseCardState(status: EnrollmentStatus | undefined, isCurrent: boolean): CourseCardState {
  const resolved = status ?? "not_started";
  return { status: resolved, isCurrent, actions: actionsByStatus[resolved] };
}
