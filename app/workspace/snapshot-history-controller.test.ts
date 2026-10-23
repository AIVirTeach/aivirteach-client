import { describe, expect, it, vi } from "vitest";
import type { ApiLearningSnapshot, ApiLearningSnapshotPage, ApiLearningSnapshotSummary } from "../lib/api";
import { createSnapshotHistoryController } from "./snapshot-history-controller";

const summary = (id: string): ApiLearningSnapshotSummary => ({ id, enrollmentId: "e", sourceGeneration: 0, sourceRevision: 1, courseVersionId: "v1", courseVersion: { version: 1, modules: [{ title: "Pinned", lessons: [{ contentId: "lesson-a", title: "Old title" }] }] }, schemaVersion: 1, reason: "MANUAL", createdAt: "2026-10-23T00:00:00Z", completeStateAvailable: true, completedLessonCount: 1, totalLessons: 1, progressPercent: 100 });
const page = (items: ApiLearningSnapshotSummary[], nextCursor: string | null): ApiLearningSnapshotPage => ({ items, nextCursor });
const detail: ApiLearningSnapshot = { ...summary("snap-1"), state: { schemaVersion: 1, readingLessonId: "lesson-a", lessons: { "lesson-a": { completedAt: "2026-10-01T00:00:00Z", firstCompletedAt: "2026-10-01T00:00:00Z" } }, completedAt: null } };

describe("snapshot history controller", () => {
  it("loads cursor pages and retains backend-pinned titles and counts", async () => {
    const transport = { learningSnapshots: vi.fn().mockResolvedValueOnce(page([summary("snap-1")], "snap-1")).mockResolvedValueOnce(page([summary("snap-2")], null)), learningSnapshot: vi.fn().mockResolvedValue(detail) };
    const publish = vi.fn();
    const controller = createSnapshotHistoryController("course", transport, publish);
    await controller.load();
    await controller.loadNext();
    expect(transport.learningSnapshots.mock.calls).toEqual([["course", undefined], ["course", "snap-1"]]);
    expect(controller.getState().page?.items.map((item) => item.id)).toEqual(["snap-1", "snap-2"]);
    expect(controller.getState().page?.items[0].courseVersion?.modules[0].lessons[0].title).toBe("Old title");
    expect(controller.getState().page?.items[0].completedLessonCount).toBe(1);
  });

  it("ignores late list and detail responses after disposal or leaving the detail view", async () => {
    const publish = vi.fn();
    let resolveList!: (value: ApiLearningSnapshotPage) => void;
    let resolveDetail!: (value: ApiLearningSnapshot) => void;
    const transport = {
      learningSnapshots: vi.fn(() => new Promise<ApiLearningSnapshotPage>((resolve) => { resolveList = resolve; })),
      learningSnapshot: vi.fn(() => new Promise<ApiLearningSnapshot>((resolve) => { resolveDetail = resolve; })),
    };
    const controller = createSnapshotHistoryController("course", transport, publish);
    const loading = controller.load();
    controller.dispose();
    resolveList(page([summary("late")], null));
    await loading;
    expect(publish).toHaveBeenCalledTimes(1);

    const live = createSnapshotHistoryController("course", { ...transport, learningSnapshots: vi.fn().mockResolvedValue(page([summary("snap-1")], null)) }, publish);
    await live.load();
    const opening = live.open(summary("snap-1"));
    live.back();
    resolveDetail(detail);
    await opening;
    expect(live.getState().detail).toBeNull();
    expect(live.getState().selected).toBeNull();
  });

  it("ignores a late pagination response when a refresh supersedes it", async () => {
    let resolveNext!: (value: ApiLearningSnapshotPage) => void;
    const transport = {
      learningSnapshots: vi.fn()
        .mockResolvedValueOnce(page([summary("first")], "first"))
        .mockImplementationOnce(() => new Promise<ApiLearningSnapshotPage>((resolve) => { resolveNext = resolve; }))
        .mockResolvedValueOnce(page([summary("fresh")], null)),
      learningSnapshot: vi.fn(),
    };
    const controller = createSnapshotHistoryController("course", transport, vi.fn());
    await controller.load();
    const next = controller.loadNext();
    await controller.refresh();
    resolveNext(page([summary("stale-page")], null));
    await next;
    expect(controller.getState().page?.items.map((item) => item.id)).toEqual(["fresh"]);
  });
});
