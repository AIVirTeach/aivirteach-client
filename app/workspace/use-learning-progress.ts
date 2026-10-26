"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { createLearningProgressController, emptyProgress } from "./learning-progress-controller";

export function useLearningProgress(courseId: string | undefined, courseVersion: number | undefined) {
  const key = `${courseId ?? ""}:${courseVersion ?? ""}`;
  const [stored, setStored] = useState({ key: "", state: emptyProgress });
  const controller = useRef<ReturnType<typeof createLearningProgressController> | null>(null);
  useEffect(() => {
    if (!courseId || courseVersion === undefined) return;
    const current = createLearningProgressController(courseId, courseVersion, api, state => setStored({ key, state }), { reloadCourse: () => window.location.reload() });
    controller.current = current;
    void current.reload();
    const refresh = () => { void current.reload(); };
    window.addEventListener("focus", refresh);
    return () => { current.dispose(); controller.current = null; window.removeEventListener("focus", refresh); };
  }, [courseId, courseVersion, key]);
  const reload = useCallback(() => controller.current?.reload(), []);
  const visit = useCallback((id: string) => controller.current?.visit(id) ?? Promise.resolve(false), []);
  const setCompleted = useCallback((id: string, completed: boolean) => controller.current?.setCompleted(id, completed) ?? Promise.resolve(false), []);
  const recover = useCallback((id: string) => controller.current?.recover(id) ?? Promise.resolve(false), []);
  return { ...(stored.key === key ? stored.state : emptyProgress), reload, visit, setCompleted, recover };
}
