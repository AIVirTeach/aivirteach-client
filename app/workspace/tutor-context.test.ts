import { describe, expect, it } from "vitest";
import type { ApiCourseDetail, ApiLearningProgress, ApiLesson } from "../lib/api";
import { createTutorRequestOwner, hasTutorVersionMismatch, loadedTutorContext, tutorContextKey } from "./tutor-context";

const course: ApiCourseDetail = {
  id: "course-1", title: "Course", category: "Technology", description: "Course description",
  level: "Beginner", durationMinutes: 30, lessonCount: 1, published: true,
  slug: "course", version: 3, shortTitle: "Course", language: "en", tags: [], outcomes: [], requirements: [],
  modules: [{ id: "module-1", position: 1, title: "Module", description: "Module description", estimatedMinutes: 30, lessons: [] }],
};
const progress: ApiLearningProgress = {
  enrollmentId: "enrollment-1", courseId: "course-1", generation: 7, revision: 2,
  courseVersionId: "version-3", courseVersion: 3, active: true,
  completedLessonIds: [], totalLessons: 1, currentLessonId: "lesson-1", nextLessonId: null,
  progressPercent: 0, status: "in_progress", achievements: [],
};
const lesson: ApiLesson = {
  courseId: "course-1", courseVersionId: "version-3", courseVersion: 3,
  module: { id: "module-1", title: "Module", position: 1 },
  lesson: { id: "lesson-1", position: 1, title: "Lesson", estimatedMinutes: 30, objectives: [], activity: { type: "practice", prompt: "Do this", completionType: "self_reported" } },
  blocks: [], assessment: null,
  navigation: { previousLessonId: null, nextLessonId: null, index: 0, total: 1 },
};

describe("lesson-scoped tutor context", () => {
  it("uses identifiers from the displayed lesson and matching progress generation", () => {
    expect(loadedTutorContext(course, "lesson-1", lesson, progress)).toEqual({
      courseVersionId: "version-3", lessonId: "lesson-1", generation: 7,
    });
    expect(tutorContextKey("enrollment-1", loadedTutorContext(course, "lesson-1", lesson, progress))).toBe(
      '["enrollment-1",7,"version-3","lesson-1"]',
    );
  });

  it.each([
    ["selection", { ...lesson, lesson: { ...lesson.lesson, id: "lesson-2" } }, progress],
    ["course version number", { ...lesson, courseVersion: 2 }, progress],
    ["course version id", { ...lesson, courseVersionId: "version-2" }, progress],
    ["progress version", lesson, { ...progress, courseVersion: 2 }],
    ["course identity", { ...lesson, courseId: "other-course" }, progress],
  ])("does not issue context when the %s differs", (_case, selectedLesson, state) => {
    expect(loadedTutorContext(course, "lesson-1", selectedLesson, state as ApiLearningProgress)).toBeNull();
  });

  it("flags only a displayed lesson whose published version disagrees with active progress", () => {
    expect(hasTutorVersionMismatch(course, "lesson-1", { ...lesson, courseVersionId: "version-2" }, progress)).toBe(true);
    expect(hasTutorVersionMismatch(course, "lesson-1", { ...lesson, courseVersion: 2 }, null)).toBe(true);
    expect(hasTutorVersionMismatch(course, "lesson-2", lesson, progress)).toBe(false);
    expect(hasTutorVersionMismatch(course, "lesson-1", lesson, { ...progress, active: false })).toBe(false);
  });

  it("aborts old context requests and ignores their late results after navigation", async () => {
    const owner = createTutorRequestOwner();
    owner.setContext("lesson-1");
    const request = owner.begin();
    expect(request).not.toBeNull();
    let resolve!: (value: string) => void;
    const response = new Promise<string>((done) => { resolve = done; });
    const replies: string[] = [];
    const appendIfCurrent = (value: string) => { if (request?.isCurrent()) replies.push(value); };
    owner.setContext("lesson-2");
    resolve("stale tutor reply");

    expect(request?.signal.aborted).toBe(true);
    expect(request?.isCurrent()).toBe(false);
    expect(owner.isBusy()).toBe(false);
    appendIfCurrent(await response);
    expect(replies).toEqual([]);
  });

  it("allows one active request per context", () => {
    const owner = createTutorRequestOwner();
    owner.setContext("lesson-1");
    const first = owner.begin();
    expect(owner.begin()).toBeNull();
    first?.finish();
    expect(owner.begin()).not.toBeNull();
  });

  it("aborts a tutor request when the progress generation changes", () => {
    const owner = createTutorRequestOwner();
    const context = { courseVersionId: "version-3", lessonId: "lesson-1", generation: 7 };
    owner.setContext(tutorContextKey("enrollment-1", context));
    const request = owner.begin();
    owner.setContext(tutorContextKey("enrollment-1", { ...context, generation: 8 }));
    expect(request?.signal.aborted).toBe(true);
    expect(request?.isCurrent()).toBe(false);
  });
});
