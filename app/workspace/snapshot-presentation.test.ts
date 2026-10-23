import { describe, expect, it } from "vitest";
import type { ApiLearningSnapshot } from "../lib/api";
import { completedSnapshotLessonIds, snapshotReadingTitle } from "./snapshot-presentation";

describe("historical snapshot presentation", () => {
  it("counts only completed lesson IDs present in the snapshot's pinned syllabus", () => {
    const state: ApiLearningSnapshot["state"] = {
      schemaVersion: 1,
      readingLessonId: "old-id",
      lessons: {
        marked: { completedAt: "2026-10-01T00:00:00Z", firstCompletedAt: "2026-10-01T00:00:00Z" },
        unmarked: { completedAt: null, firstCompletedAt: null },
        removed: { completedAt: "2026-10-02T00:00:00Z", firstCompletedAt: "2026-10-02T00:00:00Z" },
      },
      completedAt: null,
    };
    const version: NonNullable<ApiLearningSnapshot["courseVersion"]> = { version: 1, modules: [{ title: "Pinned module", lessons: [{ contentId: "marked", title: "Pinned lesson" }, { contentId: "unmarked", title: "Not done" }] }] };
    expect([...completedSnapshotLessonIds(state, version)]).toEqual(["marked"]);
    const detail: ApiLearningSnapshot = { id: "s", enrollmentId: "e", sourceGeneration: 0, sourceRevision: 1, courseVersionId: "v1", courseVersion: version, schemaVersion: 1, state, reason: "MANUAL", createdAt: "2026-10-23T00:00:00Z" };
    expect(snapshotReadingTitle(detail)).toBe("old-id");
  });

  it("does not present legacy state as a complete record", () => {
    const legacy: ApiLearningSnapshot["state"] = { legacy: true, completeStateAvailable: false, completedAt: "2024-01-01T00:00:00Z" };
    expect(completedSnapshotLessonIds(legacy, null).size).toBe(0);
    const detail: ApiLearningSnapshot = { id: "s", enrollmentId: "e", sourceGeneration: 0, sourceRevision: 0, courseVersionId: null, courseVersion: null, schemaVersion: 0, state: legacy, reason: "LEGACY_ACHIEVEMENT", createdAt: "2024-01-01T00:00:00Z" };
    expect(snapshotReadingTitle(detail)).toBeNull();
  });
});
