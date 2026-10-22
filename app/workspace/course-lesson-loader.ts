import type { ApiCourseDetail, ApiLesson } from "../lib/api";

export function initialLessonId(course: ApiCourseDetail, storedId: string | null, progressPercent: number) {
  const lessons = course.modules.flatMap((module) => module.lessons);
  if (lessons.some((lesson) => lesson.id === storedId)) return storedId!;
  const index = Math.max(0, Math.min(Math.floor(progressPercent / 100 * lessons.length), lessons.length - 1));
  return lessons[index]?.id ?? "";
}

export type LessonLoadState =
  | { status: "loading"; id: string }
  | { status: "ready"; id: string; lesson: ApiLesson }
  | { status: "error"; id: string; message: string };

// Each selection owns a generation; late responses cannot replace the current lesson.
export function createLessonLoader(fetchLesson: (id: string) => Promise<ApiLesson>, publish: (state: LessonLoadState) => void) {
  let generation = 0;
  return {
    async load(id: string) {
      const request = ++generation;
      publish({ status: "loading", id });
      try {
        const lesson = await fetchLesson(id);
        if (request === generation) publish({ status: "ready", id, lesson });
      } catch (error) {
        if (request === generation) publish({ status: "error", id, message: error instanceof Error ? error.message : "Could not load this lesson." });
      }
    },
    dispose() { generation++; },
  };
}
