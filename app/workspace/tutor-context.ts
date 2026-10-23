import type { ApiCourseDetail, ApiLearningProgress, ApiLesson, ApiTutorContext } from "../lib/api";

export function hasTutorVersionMismatch(course: ApiCourseDetail | null, selectedId: string | null, lesson: ApiLesson | null, progress: ApiLearningProgress | null) {
  return !!course && !!lesson && !!selectedId
    && lesson.lesson.id === selectedId
    && lesson.courseId === course.id
    && (lesson.courseVersion !== course.version || (!!progress?.active && progress.courseId === course.id
      && (progress.courseVersion !== course.version || lesson.courseVersionId !== progress.courseVersionId)));
}

export function loadedTutorContext(course: ApiCourseDetail | null, selectedId: string | null, lesson: ApiLesson | null, progress: ApiLearningProgress | null): ApiTutorContext | null {
  if (!course || !lesson || !progress?.active || lesson.lesson.id !== selectedId || lesson.courseId !== course.id || progress.courseId !== course.id) return null;
  if (hasTutorVersionMismatch(course, selectedId, lesson, progress)) return null;
  return { lessonId: lesson.lesson.id, courseVersionId: lesson.courseVersionId, generation: progress.generation };
}

export function tutorContextKey(enrollmentId: string | undefined, context: ApiTutorContext | null) {
  return enrollmentId && context ? JSON.stringify([enrollmentId, context.generation, context.courseVersionId, context.lessonId]) : "";
}

export function createTutorRequestOwner() {
  let contextKey = "";
  let current: AbortController | null = null;
  return {
    setContext(key: string) {
      if (contextKey === key) return;
      current?.abort();
      current = null;
      contextKey = key;
    },
    begin() {
      if (!contextKey || current) return null;
      const controller = new AbortController();
      current = controller;
      return {
        signal: controller.signal,
        isCurrent: () => current === controller && !controller.signal.aborted,
        finish() { if (current === controller) current = null; },
      };
    },
    isBusy() { return !!current && !current.signal.aborted; },
    cancel() { current?.abort(); current = null; },
  };
}
