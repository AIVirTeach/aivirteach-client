import type { ApiLearningProgress } from "../lib/api";

type Transport = {
  learningProgress(courseId: string): Promise<ApiLearningProgress>;
  setReadingPosition(courseId: string, lessonId: string, state: ApiLearningProgress): Promise<ApiLearningProgress>;
  setLessonProgress(courseId: string, lessonId: string, state: ApiLearningProgress, completed: boolean): Promise<ApiLearningProgress>;
};
export type CompletionCommand = {
  lessonId: string;
  completed: boolean;
  courseVersionId: string;
  generation: number;
};
export type CompletionState =
  | { status: "idle" }
  | { status: "saving"; command: CompletionCommand }
  | { status: "saved"; command: CompletionCommand }
  | { status: "failed"; command: CompletionCommand };
export type LearningProgressState = {
  snapshot: ApiLearningProgress | null;
  busy: boolean;
  error: string;
  completion: CompletionState;
};
export const emptyProgress: LearningProgressState = { snapshot: null, busy: false, error: "", completion: { status: "idle" } };

const sameScope = (command: CompletionCommand, snapshot: ApiLearningProgress) => command.courseVersionId === snapshot.courseVersionId && command.generation === snapshot.generation;
const targetConfirmed = (command: CompletionCommand, snapshot: ApiLearningProgress) => sameScope(command, snapshot) && snapshot.completedLessonIds.includes(command.lessonId) === command.completed;

export function createLearningProgressController(courseId: string, courseVersion: number, transport: Transport, publish: (state: LearningProgressState) => void) {
  let state = emptyProgress;
  let disposed = false;
  let queuedVisit: { lessonId: string; courseVersionId: string; generation: number } | null = null;
  let queuedReload = false;

  function update(next: LearningProgressState) {
    if (disposed) return;
    if (next.snapshot && next.snapshot.courseVersion !== courseVersion) {
      next = { ...emptyProgress, error: "课程已更新，请刷新页面后继续 / Course updated. Reload the page to continue." };
    }
    if (next.snapshot && next.completion.status !== "idle") {
      const command = next.completion.command;
      if (!sameScope(command, next.snapshot) || (next.completion.status === "saved" && !targetConfirmed(command, next.snapshot))) {
        next = { ...next, completion: { status: "idle" } };
      }
    }
    if (!next.snapshot && next.completion.status === "saved") next = { ...next, completion: { status: "idle" } };
    state = next;
    publish(state);
  }
  async function reloadNow() {
    if (disposed) return;
    update({ ...state, busy: true, error: "" });
    try {
      const snapshot = await transport.learningProgress(courseId);
      const completion = state.completion.status === "failed" && targetConfirmed(state.completion.command, snapshot)
        ? { status: "saved" as const, command: state.completion.command }
        : state.completion;
      update({ ...state, snapshot, completion, busy: false, error: "" });
    } catch {
      update({ ...state, busy: false, error: "无法同步学习进度，请重试 / Could not sync progress. Retry." });
    }
  }
  async function drainQueuedWork() {
    if (disposed || state.busy) return;
    if (queuedReload) {
      queuedReload = false;
      await reloadNow();
    }
    const visit = queuedVisit;
    queuedVisit = null;
    const snapshot = state.snapshot;
    if (visit && snapshot?.active && visit.courseVersionId === snapshot.courseVersionId && visit.generation === snapshot.generation) {
      await writeReading(visit.lessonId);
    }
  }
  async function reload() {
    if (disposed) return;
    if (state.busy) { queuedReload = true; return; }
    await reloadNow();
    await drainQueuedWork();
  }
  async function writeReading(lessonId: string): Promise<boolean> {
    const current = state.snapshot;
    if (disposed) return false;
    if (state.busy) {
      if (current) queuedVisit = { lessonId, courseVersionId: current.courseVersionId, generation: current.generation };
      return false;
    }
    if (!current?.active) return false;
    update({ ...state, busy: true, error: "" });
    let succeeded = false;
    try {
      const snapshot = await transport.setReadingPosition(courseId, lessonId, current);
      if (disposed) return false;
      update({ ...state, snapshot, busy: false, error: "" });
      succeeded = true;
    } catch {
      if (disposed) return false;
      let snapshot = current;
      try { snapshot = await transport.learningProgress(courseId); } catch {}
      update({ ...state, snapshot, busy: false, error: "阅读位置未确认，请刷新进度后重试 / Reading position not confirmed. Refresh progress and retry." });
    }
    await drainQueuedWork();
    return succeeded;
  }
  function finishCompletion(command: CompletionCommand, snapshot: ApiLearningProgress | null) {
    update({ ...state, snapshot: snapshot ?? state.snapshot, busy: false, error: "", completion: snapshot && targetConfirmed(command, snapshot) ? { status: "saved", command } : { status: "failed", command } });
    return !disposed && state.completion.status === "saved";
  }
  async function sendCompletion(command: CompletionCommand, current: ApiLearningProgress): Promise<boolean> {
    let snapshot: ApiLearningProgress | null = null;
    try {
      snapshot = await transport.setLessonProgress(courseId, command.lessonId, current, command.completed);
    } catch {
      if (disposed) return false;
      try { snapshot = await transport.learningProgress(courseId); } catch {}
    }
    if (disposed) return false;
    const succeeded = finishCompletion(command, snapshot);
    await drainQueuedWork();
    return succeeded;
  }
  async function setCompleted(lessonId: string, completed: boolean): Promise<boolean> {
    const current = state.snapshot;
    if (disposed || state.busy || !current?.active) return false;
    const command = { lessonId, completed, courseVersionId: current.courseVersionId, generation: current.generation };
    update({ ...state, busy: true, error: "", completion: { status: "saving", command } });
    return sendCompletion(command, current);
  }
  async function retryCompletion(): Promise<boolean> {
    if (disposed || state.busy || state.completion.status !== "failed") return false;
    const command = state.completion.command;
    update({ ...state, busy: true, error: "", completion: { status: "saving", command } });
    let current: ApiLearningProgress;
    try {
      current = await transport.learningProgress(courseId);
    } catch {
      if (disposed) return false;
      finishCompletion(command, null);
      await drainQueuedWork();
      return false;
    }
    if (disposed) return false;
    if (!current.active || current.courseVersion !== courseVersion || !sameScope(command, current)) {
      update({ ...state, snapshot: current, busy: false, completion: { status: "idle" } });
      await drainQueuedWork();
      return false;
    }
    if (targetConfirmed(command, current)) {
      finishCompletion(command, current);
      await drainQueuedWork();
      return true;
    }
    return sendCompletion(command, current);
  }
  return { reload, visit: writeReading, setCompleted, retryCompletion, dispose() { disposed = true; queuedVisit = null; queuedReload = false; } };
}
