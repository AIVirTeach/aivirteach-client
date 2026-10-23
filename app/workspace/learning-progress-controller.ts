import { ApiError, type ApiCreatedLearningSnapshot, type ApiLearningProgress, type LearningSnapshotCommand } from "../lib/api";

type Transport = {
  learningProgress(courseId: string): Promise<ApiLearningProgress>;
  setReadingPosition(courseId: string, lessonId: string, state: ApiLearningProgress): Promise<ApiLearningProgress>;
  setLessonProgress(courseId: string, lessonId: string, state: ApiLearningProgress, completed: boolean): Promise<ApiLearningProgress>;
  createLearningSnapshot(courseId: string, command: LearningSnapshotCommand): Promise<ApiCreatedLearningSnapshot>;
};
export type LearningProgressState = { snapshot: ApiLearningProgress | null; busy: boolean; error: string; snapshotBusy: boolean; snapshotError: string; pendingSnapshot: LearningSnapshotCommand | null; savedSnapshot: ApiCreatedLearningSnapshot | null };
export const emptyProgress: LearningProgressState = { snapshot: null, busy: false, error: "", snapshotBusy: false, snapshotError: "", pendingSnapshot: null, savedSnapshot: null };

// One owner per mounted course: serializes commands and drops responses after disposal.
export function createLearningProgressController(courseId: string, courseVersion: number, transport: Transport, publish: (state: LearningProgressState) => void) {
  let state = emptyProgress;
  let disposed = false;
  let queuedVisit: { lessonId: string; courseVersionId: string; generation: number } | null = null;
  let queuedReload = false;
  let pendingSnapshot: LearningSnapshotCommand | null = null;
  let snapshotBusy = false;
  let snapshotError = "";
  let savedSnapshot: ApiCreatedLearningSnapshot | null = null;
  function update(next: Pick<LearningProgressState, "snapshot" | "busy" | "error">) {
    if (disposed) return;
    if (next.snapshot && next.snapshot.courseVersion !== courseVersion) {
      next = { snapshot: null, busy: false, error: "课程已更新，请刷新页面后继续 / Course updated. Reload the page to continue." };
    }
    if (next.snapshot && pendingSnapshot && (pendingSnapshot.generation !== next.snapshot.generation || pendingSnapshot.courseVersionId !== next.snapshot.courseVersionId)) {
      pendingSnapshot = null;
      snapshotError = "学习轮次已变化。旧快照不会重试到新轮次，请到历史记录中查看 / Learning round changed. The old save will not be retried in this round; check history.";
    }
    if (next.snapshot && savedSnapshot && (savedSnapshot.sourceGeneration !== next.snapshot.generation || savedSnapshot.courseVersionId !== next.snapshot.courseVersionId)) savedSnapshot = null;
    if (!next.snapshot) savedSnapshot = null;
    state = { ...next, snapshotBusy, snapshotError, pendingSnapshot, savedSnapshot };
    publish(state);
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
      try { snapshot = await transport.learningProgress(courseId); } catch {}
      update({ snapshot, busy: false, error: "保存未确认，请刷新进度后重试；课程更新时请刷新页面 / Save not confirmed. Refresh progress and retry; reload the page if the course changed." });
    }
    await drainQueuedWork();
    return succeeded;
  }
  async function saveSnapshot(): Promise<ApiCreatedLearningSnapshot | null> {
    if (disposed || snapshotBusy || state.busy || (Boolean(state.error) && !pendingSnapshot) || (!state.snapshot?.active && !pendingSnapshot)) return null;
    const current = state.snapshot;
    if (!pendingSnapshot) {
      if (!current) return null;
      pendingSnapshot = { requestId: crypto.randomUUID(), generation: current.generation, revision: current.revision, courseVersionId: current.courseVersionId };
    }
    const owner = { generation: pendingSnapshot.generation, courseVersionId: pendingSnapshot.courseVersionId };
    snapshotBusy = true; snapshotError = "";
    update({ ...state, busy: true });
    try {
      const result = await transport.createLearningSnapshot(courseId, pendingSnapshot);
      if (disposed) return null;
      pendingSnapshot = null; savedSnapshot = result; snapshotBusy = false;
      state = { ...state, busy: false };
      update(state);
      await drainQueuedWork();
      if (disposed || state.snapshot?.generation !== owner.generation || state.snapshot?.courseVersionId !== owner.courseVersionId) return null;
      return result;
    } catch (caught) {
      if (disposed) return null;
      snapshotBusy = false;
      const conflict = caught instanceof ApiError && caught.status === 409;
      if (conflict) pendingSnapshot = null;
      snapshotError = conflict
        ? "学习进度已更新，请刷新后发起新的保存 / Progress changed. Refresh before starting a new save."
        : "保存结果未确认。可安全重试同一条快照 / Save outcome is unconfirmed. Retry this same snapshot safely.";
      if (conflict) {
        try {
          const fresh = await transport.learningProgress(courseId);
          if (!disposed) state = { ...state, snapshot: fresh, busy: false };
        } catch {}
      }
      state = { ...state, busy: false };
      update(state);
      await drainQueuedWork();
      return null;
    }
  }
  return { reload, visit: (id: string) => write(id), setCompleted: (id: string, completed: boolean) => write(id, completed), saveSnapshot, dispose() { disposed = true; queuedVisit = null; queuedReload = false; } };
}
