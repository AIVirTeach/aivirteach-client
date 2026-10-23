import type { ApiCourseDetail, ApiLesson, ApiLearningProgress } from "../lib/api";

export function initialLessonId(course: ApiCourseDetail, progress: Pick<ApiLearningProgress, "currentLessonId" | "nextLessonId">) {
  const lessons = course.modules.flatMap(module => module.lessons);
  return [progress.currentLessonId, progress.nextLessonId].find(id => lessons.some(lesson => lesson.id === id)) ?? lessons[0]?.id ?? "";
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
