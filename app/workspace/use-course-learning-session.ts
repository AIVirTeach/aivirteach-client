"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ApiCourseDetail } from "../lib/api";
import { createLessonLoader, initialLessonId, type LessonLoadState } from "./course-lesson-loader";
import { loadedTutorContext } from "./tutor-context";
import { useLearningProgress } from "./use-learning-progress";

export function useCourseLearningSession(course: ApiCourseDetail | null) {
  const progress = useLearningProgress(course?.id, course?.version);
  const [selection, setSelection] = useState({ courseId: "", courseVersionId: "", generation: -1, lessonId: "" });
  const [loadedState, setLoadedState] = useState<{ key: string; state: LessonLoadState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const initialVisitKey = useRef("");
  const { snapshot, visit } = progress;
  const sessionKey = course && snapshot ? `${course.id}:${course.version}:${snapshot.courseVersionId}:${snapshot.generation}` : "";
  const selectedId = sessionKey && selection.courseId === course?.id && selection.courseVersionId === snapshot?.courseVersionId && selection.generation === snapshot?.generation
    ? selection.lessonId
    : !course || !snapshot
      ? ""
      : initialLessonId(course, snapshot);
  useEffect(() => {
    if (!course || !snapshot) return;
    const key = `${course.id}:${snapshot.courseVersionId}:${snapshot.generation}`;
    if (initialVisitKey.current === key) return;
    const id = initialLessonId(course, snapshot);
    if (id) { initialVisitKey.current = key; void visit(id); }
  }, [course, snapshot, visit]);
  useEffect(() => {
    if (!course || !selectedId || !sessionKey) return;
    const loader = createLessonLoader((id) => api.lesson(course.id, id), (state) => setLoadedState({ key: sessionKey, state }));
    void loader.load(selectedId);
    return () => loader.dispose();
  }, [course, selectedId, sessionKey, attempt]);
  const state = loadedState?.key === sessionKey ? loadedState.state : null;
  const loaded = state?.status === "ready" && state.id === selectedId ? state.lesson : null;
  return {
    progress, selectedId, state,
    context: loadedTutorContext(course, selectedId, loaded, snapshot),
    select(id: string) {
      if (!course || !snapshot) return;
      setSelection({ courseId: course.id, courseVersionId: snapshot.courseVersionId, generation: snapshot.generation, lessonId: id });
      void visit(id);
    },
    retry() { setAttempt((value) => value + 1); },
  };
}
