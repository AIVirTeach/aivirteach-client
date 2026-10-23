export type LessonSelection = { sessionKey: string; lessonId: string };

export function latchLessonSelection(current: LessonSelection | null, sessionKey: string, initialLessonId: string): LessonSelection | null {
  if (!sessionKey) return current;
  if (current?.sessionKey === sessionKey) return current;
  return { sessionKey, lessonId: initialLessonId };
}

export function selectedLessonIdForSession(selection: LessonSelection | null, sessionKey: string, initialLessonId: string) {
  return selection?.sessionKey === sessionKey ? selection.lessonId : sessionKey ? initialLessonId : "";
}
