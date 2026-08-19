"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addMockCourseTime,
  emptyMockCourseProgress,
  mockCourseProgressEvent,
  readMockCourseProgress,
  recordMockCourseAnswer,
  resetMockCourseProgress,
  startMockCourse,
  type MockCourseProgress,
} from "../lib/mock-course";

export function useMockCourseProgress(trackTime = false) {
  const [progress, setProgress] = useState<MockCourseProgress>(emptyMockCourseProgress);

  useEffect(() => {
    function sync(event: Event) {
      setProgress((event as CustomEvent<MockCourseProgress>).detail);
    }

    function syncStorage(event: StorageEvent) {
      if (event.key) setProgress(readMockCourseProgress());
    }

    window.addEventListener(mockCourseProgressEvent, sync);
    window.addEventListener("storage", syncStorage);
    const loadTimer = window.setTimeout(() => {
      setProgress(trackTime ? startMockCourse() : readMockCourseProgress());
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener(mockCourseProgressEvent, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, [trackTime]);

  useEffect(() => {
    if (!trackTime) return;
    let previous = Date.now();

    function captureTime(updateState = true) {
      const now = Date.now();
      const elapsed = Math.min(10, Math.max(0, Math.round((now - previous) / 1000)));
      previous = now;
      if (document.visibilityState === "visible" && elapsed > 0) {
        const next = addMockCourseTime(elapsed);
        if (updateState) setProgress(next);
      }
    }

    const timer = window.setInterval(captureTime, 5000);
    return () => {
      window.clearInterval(timer);
      captureTime(false);
    };
  }, [trackTime]);

  const submitAnswer = useCallback((lessonId: string, correct: boolean) => {
    setProgress(recordMockCourseAnswer(lessonId, correct));
  }, []);

  const reset = useCallback(() => {
    setProgress(resetMockCourseProgress());
  }, []);

  return { progress, submitAnswer, reset };
}
