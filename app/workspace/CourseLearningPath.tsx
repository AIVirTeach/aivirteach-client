"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, type ApiCourseDetail } from "../lib/api";
import { CourseLessonView } from "../components/CourseLessonView";
import type { CopyToVm } from "../components/lesson-blocks/copy-code";
import { createLessonLoader, initialLessonId, type LessonLoadState } from "./course-lesson-loader";

export function CourseLearningPath({ course, progressPercent, copyToVm }: {
  course: ApiCourseDetail;
  progressPercent: number;
  copyToVm: CopyToVm;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(`aivirteach.course.lesson.${course.id}`); } catch { /* Storage can be unavailable. */ }
    return initialLessonId(course, stored, progressPercent);
  });
  const [state, setState] = useState<LessonLoadState | null>(null);
  const [retry, setRetry] = useState(0);
  const lessons = course.modules.flatMap((module) => module.lessons);
  useEffect(() => {
    if (!selectedId) return;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const loader = createLessonLoader((id) => api.lesson(course.id, id), (next) => {
      setState(next);
      if (next.status === "ready") {
        try { window.localStorage.setItem(`aivirteach.course.lesson.${course.id}`, next.id); } catch { /* Reading does not require storage. */ }
      }
    });
    void loader.load(selectedId);
    return () => loader.dispose();
  }, [course.id, selectedId, retry]);
  const index = lessons.findIndex((lesson) => lesson.id === selectedId);
  return <div className="course-learning-path" ref={scrollRef}>
    <nav className="course-lesson-navigation" aria-label="课程课时 / Course lessons">
      <label htmlFor="lab-lesson-select">{course.title}</label>
      <select id="lab-lesson-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lessons.length}>
        {!selectedId && <option value="">选择课时 / Select lesson</option>}
        {course.modules.map((module) => <optgroup key={module.id} label={module.title}>
          {module.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
        </optgroup>)}
      </select>
      <div>
        <Button variant="outline" size="sm" disabled={index <= 0} onClick={() => setSelectedId(lessons[index - 1].id)}>上一节 / Previous</Button>
        <span>{index < 0 ? 0 : index + 1} / {lessons.length}</span>
        <Button variant="outline" size="sm" disabled={index < 0 || index >= lessons.length - 1} onClick={() => setSelectedId(lessons[index + 1].id)}>下一节 / Next</Button>
      </div>
    </nav>
    {!lessons.length ? <p className="course-load-status" role="status">课程暂无课时 / No lessons yet</p>
      : state?.id !== selectedId || state?.status === "loading" || !state ? <p className="course-load-status" role="status">正在加载课时… / Loading lesson…</p>
      : state.status === "error" ? <div className="course-load-status" role="alert"><p>{state.message}</p><Button onClick={() => setRetry((value) => value + 1)}>重试 / Retry</Button></div>
      : <CourseLessonView key={selectedId} mode="learner" title={state.lesson.lesson.title} moduleTitle={state.lesson.module.title} blocks={state.lesson.blocks} assets={state.lesson.assets} markdown={state.lesson.markdown} copyToVm={copyToVm} />}
  </div>;
}
