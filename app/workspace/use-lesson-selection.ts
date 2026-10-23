"use client";

import { useCallback, useState } from "react";
import { latchLessonSelection, selectedLessonIdForSession, type LessonSelection } from "./lesson-selection";

export function useLessonSelection(sessionKey: string, initialLessonId: string) {
  const [selection, setSelection] = useState<LessonSelection | null>(null);
  const initialSelection = latchLessonSelection(selection, sessionKey, initialLessonId);
  if (initialSelection !== selection) setSelection(initialSelection);

  const select = useCallback((lessonId: string) => {
    if (sessionKey) setSelection({ sessionKey, lessonId });
  }, [sessionKey]);

  return { selectedId: selectedLessonIdForSession(selection, sessionKey, initialLessonId), select };
}
