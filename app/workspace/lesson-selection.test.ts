import { describe, expect, it } from "vitest";
import { latchLessonSelection, selectedLessonIdForSession } from "./lesson-selection";

describe("lesson selection belongs to a course generation", () => {
  it("keeps tab A on its initial lesson when tab B changes the shared reading pointer", () => {
    const sessionKey = "course-1:3:version-3:7";
    const tabASelection = latchLessonSelection(null, sessionKey, "lesson-1");

    const refreshedTabASelection = latchLessonSelection(tabASelection, sessionKey, "lesson-3");

    expect(selectedLessonIdForSession(refreshedTabASelection, sessionKey, "lesson-3")).toBe("lesson-1");
  });

  it("keeps a manually selected lesson until the course generation changes", () => {
    const selection = { sessionKey: "course-1:3:version-3:7", lessonId: "lesson-3" };
    expect(latchLessonSelection(selection, "course-1:3:version-3:7", "lesson-1")).toBe(selection);
    expect(latchLessonSelection(selection, "", "")).toBe(selection);
    expect(latchLessonSelection(selection, "course-1:3:version-3:8", "lesson-1")).toEqual({
      sessionKey: "course-1:3:version-3:8",
      lessonId: "lesson-1",
    });
  });
});
