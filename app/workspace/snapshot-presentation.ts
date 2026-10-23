import type { ApiLearningSnapshot, SnapshotCourseVersion } from "../lib/api";

export function completedSnapshotLessonIds(state: ApiLearningSnapshot["state"], pinnedVersion: SnapshotCourseVersion) {
  const completed = new Set<string>();
  if (!("lessons" in state) || !pinnedVersion) return completed;
  const pinnedIds = new Set(pinnedVersion.modules.flatMap((module) => module.lessons.map((lesson) => lesson.contentId)));
  for (const [lessonId, value] of Object.entries(state.lessons)) {
    if (pinnedIds.has(lessonId) && value.completedAt !== null) completed.add(lessonId);
  }
  return completed;
}

export function snapshotReadingTitle(snapshot: ApiLearningSnapshot) {
  if (!("readingLessonId" in snapshot.state) || !snapshot.state.readingLessonId || !snapshot.courseVersion) return null;
  const readingId = snapshot.state.readingLessonId;
  return snapshot.courseVersion.modules.flatMap((module) => module.lessons).find((lesson) => lesson.contentId === readingId)?.title ?? readingId;
}
