// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCourseDetail, ApiLearningProgress, ApiLesson } from "../lib/api";

const api = vi.hoisted(() => ({ learningProgress: vi.fn(), setReadingPosition: vi.fn(), setLessonProgress: vi.fn(), lesson: vi.fn() }));
vi.mock("../lib/api", () => ({ api }));

import { useCourseLearningSession } from "./use-course-learning-session";
import { CourseLearningPath } from "./CourseLearningPath";

const lessonSummary = { id: "a", position: 1, title: "First lesson", estimatedMinutes: 5, objectives: [], activity: { type: "READ", prompt: "Read this lesson", completionType: "SELF" } };
const course: ApiCourseDetail = { id: "c", slug: "c", title: "Course", shortTitle: "Course", category: "test", description: "", level: "Beginner", durationMinutes: 5, lessonCount: 1, published: true, version: 1, language: "en", tags: [], outcomes: [], requirements: [], modules: [{ id: "m", position: 1, title: "Module", description: "", estimatedMinutes: 5, lessons: [lessonSummary] }] };
const initial: ApiLearningProgress = { enrollmentId: "e", courseId: "c", generation: 0, revision: 0, courseVersionId: "v1", courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 1, currentLessonId: null, nextLessonId: "a", progressPercent: 0, status: "in_progress", achievements: [] };
const lesson: ApiLesson = { courseVersionId: "v1", courseVersion: 1, courseId: "c", module: { id: "m", title: "Module", position: 1 }, lesson: lessonSummary, blocks: [{ id: "p", type: "paragraph", props: { text: "Lesson content remains visible." } }], assessment: null, navigation: { previousLessonId: null, nextLessonId: null, index: 0, total: 1 } };

function Workspace() {
  const session = useCourseLearningSession(course);
  return <><output>{session.selectedId}</output><CourseLearningPath course={course} session={session} copyToVm={() => true} /></>;
}

describe("progress control with live lesson selection", () => {
  let host: HTMLDivElement;
  let root: Root;
  const button = () => host.querySelector<HTMLButtonElement>("button[data-completion-state]")!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    vi.resetAllMocks();
    api.learningProgress.mockResolvedValue(initial);
    api.setReadingPosition.mockResolvedValue({ ...initial, currentLessonId: "a", revision: 1 });
    api.setLessonProgress.mockResolvedValue({ ...initial, completedLessonIds: ["a"], revision: 2 });
    api.lesson.mockResolvedValue(lesson);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
  it("retains selection and exposes same-target retry when completion and confirmation both fail", async () => {
    await act(async () => root.render(<Workspace />));
    api.setLessonProgress.mockRejectedValueOnce(new Error("write unconfirmed"));
    api.learningProgress.mockRejectedValueOnce(new Error("offline"));
    await act(async () => button().click());
    expect(host.querySelector("output")?.textContent).toBe("a");
    expect(host.textContent).toContain("Lesson content remains visible.");
    expect(button().dataset.completionState).toBe("failed");
    expect(button().disabled).toBe(false);
    api.learningProgress.mockResolvedValueOnce({ ...initial, revision: 6 });
    await act(async () => button().click());
    expect(api.setLessonProgress.mock.calls.map(call => call[3])).toEqual([true, true]);
    expect(api.setLessonProgress.mock.lastCall?.[2].revision).toBe(6);
    expect(button().dataset.completionState).toBe("saved");
  });
  it("allows the single sync retry before a lesson can be selected or loaded", async () => {
    api.learningProgress.mockRejectedValueOnce(new Error("offline"));
    await act(async () => root.render(<Workspace />));
    expect(host.querySelector("output")?.textContent).toBe("");
    expect(api.lesson).not.toHaveBeenCalled();
    expect(button().textContent).toContain("Sync failed");
    expect(button().disabled).toBe(false);
    await act(async () => button().click());
    expect(host.querySelector("output")?.textContent).toBe("a");
    expect(host.textContent).toContain("Lesson content remains visible.");
    expect(button().disabled).toBe(false);
  });
  it("retains lesson selection through a failed focus refresh and recovers through the same button", async () => {
    await act(async () => root.render(<Workspace />));
    api.learningProgress.mockRejectedValueOnce(new Error("offline"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(host.querySelector("output")?.textContent).toBe("a");
    expect(host.textContent).toContain("Lesson content remains visible.");
    expect(button().textContent).toContain("Sync failed");
    expect(button().disabled).toBe(false);
    await act(async () => button().click());
    expect(button().textContent).toContain("Mark lesson complete");
    expect(api.setLessonProgress).not.toHaveBeenCalled();
  });
});
