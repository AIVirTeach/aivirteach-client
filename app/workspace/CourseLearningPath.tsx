"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { type ApiCourseDetail } from "../lib/api";
import type { useCourseLearningSession } from "./use-course-learning-session";
import { CourseLessonView } from "../components/CourseLessonView";
import type { CopyToVm } from "../components/lesson-blocks/copy-code";
import { LessonCompletionButton } from "./LessonCompletionButton";
import { localize, useLearningLanguage } from "../lib/language";

export function CourseLearningPath({ course, copyToVm, session }: {
  course: ApiCourseDetail;
  copyToVm: CopyToVm;
  session: ReturnType<typeof useCourseLearningSession>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const language = useLearningLanguage();
  const t = (en: string, zh: string) => localize(language, en, zh);
  const { progress, selectedId, select, state, retry } = session;
  const lessons = course.modules.flatMap((module) => module.lessons);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectedId]);
  const index = lessons.findIndex((lesson) => lesson.id === selectedId);
  return <div className="course-learning-path" ref={scrollRef}>
    <nav className="course-lesson-navigation" aria-label={t("Course lessons", "课程课时")}>
      <label htmlFor="lab-lesson-select">{course.title}</label>
      <select id="lab-lesson-select" value={selectedId} onChange={(event) => void select(event.target.value)} disabled={!lessons.length || !progress.snapshot?.active}>
        {!selectedId && <option value="">{t("Select lesson", "选择课时")}</option>}
        {course.modules.map((module) => <optgroup key={module.id} label={module.title}>
          {module.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{progress.snapshot?.completedLessonIds.includes(lesson.id) ? "✓ " : ""}{lesson.title}</option>)}
        </optgroup>)}
      </select>
      <div>
        <Button variant="outline" size="sm" disabled={index <= 0 || !progress.snapshot?.active} onClick={() => void select(lessons[index - 1].id)}>{t("Previous", "上一节")}</Button>
        <span>{index < 0 ? 0 : index + 1} / {lessons.length}</span>
        <Button variant="outline" size="sm" disabled={index < 0 || index >= lessons.length - 1 || !progress.snapshot?.active} onClick={() => void select(lessons[index + 1].id)}>{t("Next", "下一节")}</Button>
      </div>
    </nav>
    <LessonCompletionButton lessonId={selectedId} progress={progress} disabled={state?.status !== "ready" || state.id !== selectedId} />
    {!lessons.length ? <p className="course-load-status" role="status">{t("No lessons yet", "课程暂无课时")}</p>
      : state?.id !== selectedId || state?.status === "loading" || !state ? <p className="course-load-status" role="status">{t("Loading lesson…", "正在加载课时…")}</p>
      : state.status === "error" ? <div className="course-load-status" role="alert"><p>{state.message}</p><Button onClick={retry}>{t("Retry", "重试")}</Button></div>
      : <CourseLessonView key={selectedId} mode="learner" title={state.lesson.lesson.title} moduleTitle={state.lesson.module.title} blocks={state.lesson.blocks} assets={state.lesson.assets} copyToVm={copyToVm} />}
  </div>;
}
