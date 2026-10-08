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

// The one place a status off the wire becomes a trusted EnrollmentStatus.
// Anything unrecognised falls back instead of crashing the catalog. A current
// course with no status means the server predates `status`; treat it as in
// progress so its Continue/Restart buttons survive. Keep raw server values out
// of component state: store what this returns.
export function resolveEnrollmentStatus(status: unknown, isCurrent: boolean): EnrollmentStatus {
  if (typeof status === "string" && Object.hasOwn(actionsByStatus, status)) return status as EnrollmentStatus;
  return isCurrent && status === undefined ? "in_progress" : "not_started";
}

// Buttons follow the server's progress status; "current" (the active
// enrollment) is only a highlight layered on top.
export function courseCardState(status: EnrollmentStatus | undefined, isCurrent: boolean): CourseCardState {
  const resolved = resolveEnrollmentStatus(status, isCurrent);
  const actions = isCurrent && resolved === "not_started" ? ["continue" as const] : actionsByStatus[resolved];
  return { status: resolved, isCurrent, actions };
}

// A course with saved progress resumes in the workspace; a new (or freshly
// restarted) one goes through the welcome intro first.
export function courseEntryPath(status: EnrollmentStatus | undefined): "/workspace" | "/courses/welcome" {
  return status === "in_progress" ? "/workspace" : "/courses/welcome";
}
