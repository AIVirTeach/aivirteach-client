import { describe, expect, it } from "vitest";
import type { ApiLearningProgress } from "./api";
import { restartCommandForCourse } from "./restart-command";

const current: ApiLearningProgress = { enrollmentId: "e", courseId: "c", generation: 2, revision: 7, courseVersionId: "version-3", courseVersion: 3, active: true, completedLessonIds: ["lesson-a"], totalLessons: 4, currentLessonId: "lesson-b", nextLessonId: "lesson-c", progressPercent: 25, status: "in_progress", achievements: [] };

describe("restart command ownership", () => {
  it("creates one command from confirmed progress and reuses it after uncertain failures or dialog reopen", () => {
    const commands = new Map();
    let uuidCount = 0;
    const newId = () => `request-${++uuidCount}`;
    const first = restartCommandForCourse(commands, "c", current, newId);
    const retry = restartCommandForCourse(commands, "c", { ...current, generation: 9, revision: 99 }, newId);
    expect(retry).toBe(first);
    expect(first).toEqual({ requestId: "request-1", generation: 2, revision: 7, courseVersionId: "version-3" });
    expect(uuidCount).toBe(1);
  });

  it("allows a catalog restart command for an inactive but enrolled course", () => {
    expect(restartCommandForCourse(new Map(), "c", { ...current, active: false }, () => "id"))
      .toEqual({ requestId: "id", generation: 2, revision: 7, courseVersionId: "version-3" });
  });
});
