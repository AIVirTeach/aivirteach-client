"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { type ApiCourseDetail } from "../lib/api";
import type { useCourseLearningSession } from "./use-course-learning-session";
import { CourseLessonView } from "../components/CourseLessonView";
import type { CopyToVm } from "../components/lesson-blocks/copy-code";
import { LearningSnapshots } from "./LearningSnapshots";

export function CourseLearningPath({ course, copyToVm, session }: {
  course: ApiCourseDetail;
  copyToVm: CopyToVm;
  session: ReturnType<typeof useCourseLearningSession>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { progress, selectedId, select, state, retry } = session;
  const lessons = course.modules.flatMap((module) => module.lessons);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectedId]);
  const index = lessons.findIndex((lesson) => lesson.id === selectedId);
  return <div className="course-learning-path" ref={scrollRef}>
    <nav className="course-lesson-navigation" aria-label="课程课时 / Course lessons">
      <label htmlFor="lab-lesson-select">{course.title}</label>
      <select id="lab-lesson-select" value={selectedId} onChange={(event) => void select(event.target.value)} disabled={!lessons.length || !progress.snapshot?.active}>
        {!selectedId && <option value="">选择课时 / Select lesson</option>}
        {course.modules.map((module) => <optgroup key={module.id} label={module.title}>
          {module.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{progress.snapshot?.completedLessonIds.includes(lesson.id) ? "✓ " : ""}{lesson.title}</option>)}
        </optgroup>)}
      </select>
      <div>
        <Button variant="outline" size="sm" disabled={index <= 0 || !progress.snapshot?.active} onClick={() => void select(lessons[index - 1].id)}>上一节 / Previous</Button>
        <span>{index < 0 ? 0 : index + 1} / {lessons.length}</span>
        <Button variant="outline" size="sm" disabled={index < 0 || index >= lessons.length - 1 || !progress.snapshot?.active} onClick={() => void select(lessons[index + 1].id)}>下一节 / Next</Button>
      </div>
    </nav>
    <section className="course-load-status" aria-label="学习进度 / Learning progress">
      {progress.snapshot && <p>{progress.snapshot.completedLessonIds.length} / {progress.snapshot.totalLessons} 已完成 · {progress.snapshot.progressPercent}%</p>}
      {progress.snapshot?.achievements.length ? <p>历史结课记录已保留 / Previous course completion retained</p> : null}
      <Button variant="outline" disabled={progress.busy || !progress.snapshot?.active || state?.status !== "ready" || state.id !== selectedId} onClick={() => void progress.setCompleted(selectedId, !progress.snapshot?.completedLessonIds.includes(selectedId))}>
        {progress.busy ? "同步中… / Syncing…" : progress.snapshot?.completedLessonIds.includes(selectedId) ? "取消完成 / Mark incomplete" : "标记完成 / Mark complete"}
      </Button>
      <p>这是学习记录；评测通过由系统单独判定。 / Self-reported progress; assessment results are separate.</p>
      <LearningSnapshots key={`${course.id}:${progress.snapshot?.generation ?? "pending"}`} courseId={course.id} progress={progress} />
      {progress.error && <div role="alert">{progress.error}<Button variant="outline" disabled={progress.busy} onClick={() => void progress.reload()}>刷新进度 / Refresh progress</Button></div>}
    </section>
    {!lessons.length ? <p className="course-load-status" role="status">课程暂无课时 / No lessons yet</p>
      : state?.id !== selectedId || state?.status === "loading" || !state ? <p className="course-load-status" role="status">正在加载课时… / Loading lesson…</p>
      : state.status === "error" ? <div className="course-load-status" role="alert"><p>{state.message}</p><Button onClick={retry}>重试 / Retry</Button></div>
      : <CourseLessonView key={selectedId} mode="learner" title={state.lesson.lesson.title} moduleTitle={state.lesson.module.title} blocks={state.lesson.blocks} assets={state.lesson.assets} markdown={state.lesson.markdown} copyToVm={copyToVm} />}
  </div>;
}
