import type { ApiLearningProgress } from "../lib/api";

type Transport = {
  learningProgress(courseId: string): Promise<ApiLearningProgress>;
  setReadingPosition(courseId: string, lessonId: string, state: ApiLearningProgress): Promise<ApiLearningProgress>;
  setLessonProgress(courseId: string, lessonId: string, state: ApiLearningProgress, completed: boolean): Promise<ApiLearningProgress>;
};
export type LearningProgressState = { snapshot: ApiLearningProgress | null; busy: boolean; error: string };
export const emptyProgress: LearningProgressState = { snapshot: null, busy: false, error: "" };

// One owner per mounted course: serializes commands and drops responses after disposal.
export function createLearningProgressController(courseId: string, courseVersion: number, transport: Transport, publish: (state: LearningProgressState) => void) {
  let state = emptyProgress;
  let disposed = false;
  let queuedVisit: { lessonId: string; courseVersionId: string; generation: number } | null = null;
  let queuedReload = false;
  function update(next: LearningProgressState) {
    if (disposed) return;
    if (next.snapshot && next.snapshot.courseVersion !== courseVersion) {
      next = { snapshot: null, busy: false, error: "课程已更新，请刷新页面后继续 / Course updated. Reload the page to continue." };
    }
    state = next;
    publish(next);
  }
  async function reloadNow() {
    if (disposed) return;
    update({ ...state, busy: true, error: "" });
    try {
      const snapshot = await transport.learningProgress(courseId);
      update({ snapshot, busy: false, error: "" });
    } catch {
      update({ snapshot: null, busy: false, error: "无法同步学习进度，请重试 / Could not sync progress. Retry." });
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
      await write(visit.lessonId);
    }
  }
  async function reload() {
    if (disposed) return;
    if (state.busy) { queuedReload = true; return; }
    await reloadNow();
    await drainQueuedWork();
  }
  async function write(lessonId: string, completed?: boolean): Promise<boolean> {
    const current = state.snapshot;
    if (disposed) return false;
    if (state.busy) {
      if (completed === undefined && current) queuedVisit = { lessonId, courseVersionId: current.courseVersionId, generation: current.generation };
      return false;
    }
    if (!current?.active) return false;
    update({ ...state, busy: true, error: "" });
    let succeeded = false;
    try {
      const snapshot = completed === undefined
        ? await transport.setReadingPosition(courseId, lessonId, current)
        : await transport.setLessonProgress(courseId, lessonId, current, completed);
      if (disposed) return false;
      update({ snapshot, busy: false, error: "" });
      succeeded = true;
    } catch {
      if (disposed) return false;
      let snapshot: ApiLearningProgress | null = completed === undefined ? current : null;
      try { snapshot = await transport.learningProgress(courseId); } catch { /* Explicit reload remains available. */ }
      update({ snapshot, busy: false, error: "保存未确认，请刷新进度后重试；课程更新时请刷新页面 / Save not confirmed. Refresh progress and retry; reload the page if the course changed." });
    }
    await drainQueuedWork();
    return succeeded;
  }
  return { reload, visit: (id: string) => write(id), setCompleted: (id: string, completed: boolean) => write(id, completed), dispose() { disposed = true; queuedVisit = null; queuedReload = false; } };
}
