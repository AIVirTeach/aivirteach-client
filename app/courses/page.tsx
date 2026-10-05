"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sidebar } from "../components/Sidebar";
import { api, courseAssetUrl, type ApiCourse } from "../lib/api";
import { activateCourse, clearActiveCourse, type DemoCourse } from "../lib/courses";
import { resetMockCourseProgress, startMockCourse } from "../lib/mock-course";
import { localize, useLearningLanguage } from "../lib/language";

export default function CoursesPage() {
  const router = useRouter();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<DemoCourse[]>([]);
  const [error, setError] = useState("");
  const [pendingCourse, setPendingCourse] = useState<DemoCourse | null>(null);
  const [starting, setStarting] = useState(false);
  const [restartCourseTarget, setRestartCourseTarget] = useState<DemoCourse | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<DemoCourse | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const restartConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  const closePreview = useCallback(() => {
    setPreviewCourse(null);
    window.requestAnimationFrame(() => previewTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    Promise.all([api.courses(), api.enrollments()]).then(([courseData, enrollments]) => {
      setCourses(courseData.map(toDemoCourse));
      const activeEnrollment = enrollments.find((enrollment) => enrollment.active);
      if (activeEnrollment) {
        activateCourse(activeEnrollment.courseId);
        setActiveCourseId(activeEnrollment.courseId);
      } else {
        clearActiveCourse();
        setActiveCourseId(null);
      }
    }).catch((caught) => {
      setCourses([]);
      setError(caught instanceof Error ? caught.message : "Could not load courses.");
    });
  }, []);

  useEffect(() => {
    if (!pendingCourse) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !starting) setPendingCourse(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [pendingCourse, starting]);

  useEffect(() => {
    if (!restartCourseTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restartConfirmButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !restarting) setRestartCourseTarget(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [restartCourseTarget, restarting]);

  useEffect(() => {
    if (!previewCourse) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previewCloseRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePreview();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePreview, previewCourse]);

  function selectCourse(course: DemoCourse) {
    if (activeCourseId === course.id) {
      activateCourse(course.id);
      router.push(course.localOnly ? "/courses/python-basics" : "/workspace");
      return;
    }
    if (!activeCourseId) {
      void startCourse(course);
      return;
    }
    setPendingCourse(course);
  }

  async function startCourse(course: DemoCourse) {
    setStarting(true);
    if (course.localOnly) {
      startMockCourse();
      activateCourse(course.id);
      setActiveCourseId(course.id);
      setPendingCourse(null);
      router.push("/courses/python-basics");
      return;
    }
    try {
      await api.enroll(course.id);
      activateCourse(course.id);
      setActiveCourseId(course.id);
      setPendingCourse(null);
      router.push("/courses/welcome");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start this course.");
      setPendingCourse(null);
      setStarting(false);
    }
  }

  async function confirmStartCourse() {
    if (!pendingCourse) return;
    await startCourse(pendingCourse);
  }

  async function confirmRestartCourse() {
    if (!restartCourseTarget) return;
    setRestarting(true);
    setError("");
    if (restartCourseTarget.localOnly) {
      resetMockCourseProgress();
      clearActiveCourse(restartCourseTarget.id);
      setActiveCourseId(null);
      setRestartCourseTarget(null);
      setRestarting(false);
      return;
    }
    try {
      await api.restartCourse(restartCourseTarget.id);
      clearActiveCourse(restartCourseTarget.id);
      setActiveCourseId(null);
      setRestartCourseTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restart this course.");
      setRestartCourseTarget(null);
    } finally {
      setRestarting(false);
    }
  }

  const orderedCourses = activeCourseId
    ? [...courses].sort((left, right) => Number(right.id === activeCourseId) - Number(left.id === activeCourseId))
    : courses;
  const catalogModalOpen = Boolean(pendingCourse || restartCourseTarget || previewCourse);

  return (
    <>
      <div className={`app-shell ${catalogModalOpen ? "course-page-inert" : ""}`} inert={catalogModalOpen ? true : undefined} aria-hidden={catalogModalOpen ? true : undefined}>
        <Sidebar active="courses" />
        <main className="courses-page page-content">
        <header className="courses-head">
          <p className="eyebrow">{t("COURSE CATALOG", "课程目录")}</p>
          <h1>{t("Choose what to learn next", "选择接下来要学习的内容")}</h1>
          <p>{t("Start a course and continue directly in your interactive Learning Lab.", "开始一门课程，并直接进入互动学习实验室继续学习。")}</p>
        </header>
        {error && <Alert className="auth-error" variant="destructive">{error}</Alert>}
        <section className="course-catalog" aria-label={t("Available courses", "可用课程")}>
          {orderedCourses.map((course) => {
            const isActive = activeCourseId === course.id;
            return (
              <Card as="article" className={"catalog-card " + (isActive ? "active" : "")} key={course.id}>
                {course.coverAssetId ? (
                  <div className="catalog-image-wrap">
                    <img className="catalog-image" src={courseAssetUrl(course.id, course.coverAssetId)} alt={`Preview of ${course.title}`} />
                    <Button
                      className="catalog-image-enlarge"
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={(event) => {
                        previewTriggerRef.current = event.currentTarget;
                        setPreviewCourse(course);
                      }}
                      aria-label={`Enlarge preview of ${course.title}`}
                    >
                      <span aria-hidden="true" />
                    </Button>
                  </div>
                ) : <div className={"catalog-art " + course.tone} aria-hidden="true"><span /></div>}
                <div className="catalog-copy">
                  <div className="catalog-course-info">
                    <div className="catalog-label-row"><span>{course.category}</span>{course.localOnly && <Badge variant="outline">{t("Browser demo", "浏览器演示")}</Badge>}</div>
                    <h2>{course.title}</h2>
                    <div className="catalog-meta"><span>{course.level}</span></div>
                  </div>
                  <div className="catalog-actions">
                    {isActive && <Button className="restart-course-button" variant="destructive" size="lg" type="button" onClick={() => setRestartCourseTarget(course)}>{t("Restart course", "重新开始课程")}</Button>}
                    <Button className={isActive ? "continue-course-button" : "primary-button"} variant={isActive ? "secondary" : "default"} size="lg" type="button" onClick={() => selectCourse(course)} disabled={starting}>{isActive ? t("Continue course", "继续课程") : t("Start course", "开始课程")}</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
        </main>
      </div>
      <Dialog open={Boolean(pendingCourse)} onOpenChange={(open) => { if (!open && !starting) setPendingCourse(null); }}>
        {pendingCourse && (
          <DialogContent className="course-confirm-dialog" showCloseButton={false}>
            <span className="course-confirm-mark" aria-hidden="true">!</span>
            <DialogTitle id="course-confirm-title">{t(`Start ${pendingCourse.title}?`, `开始“${pendingCourse.title}”？`)}</DialogTitle>
            <DialogDescription id="course-confirm-description">{pendingCourse.localOnly ? t("This short practice course runs entirely in your browser. Progress and learning analytics are saved only on this device.", "这门短期练习课程完全在浏览器中运行，进度和学习分析仅保存在此设备上。") : t("Starting a new course will pause your current course. Its Learning Lab may be terminated after 3 days, and you may need to restart that lab from the beginning.", "开始新课程会暂停当前课程。其学习实验室可能在 3 天后终止，届时你可能需要重新开始。")}</DialogDescription>
            <div className="course-confirm-actions">
              <Button variant="outline" size="lg" type="button" onClick={() => setPendingCourse(null)} disabled={starting}>{t("Cancel", "取消")}</Button>
              <Button className="primary-button" size="lg" type="button" onClick={() => void confirmStartCourse()} disabled={starting} ref={confirmButtonRef}>{starting ? t("Starting...", "正在开始……") : t("Start new course", "开始新课程")}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={Boolean(restartCourseTarget)} onOpenChange={(open) => { if (!open && !restarting) setRestartCourseTarget(null); }}>
        {restartCourseTarget && (
          <DialogContent className="course-confirm-dialog course-restart-dialog" showCloseButton={false}>
            <span className="course-confirm-mark restart" aria-hidden="true">!</span>
            <DialogTitle id="course-restart-title">{t(`Restart ${restartCourseTarget.title}?`, `重新开始“${restartCourseTarget.title}”？`)}</DialogTitle>
            <DialogDescription id="course-restart-description">{restartCourseTarget.localOnly ? "This removes the Python course progress, answers, and learning time saved in this browser. The course will return to a brand-new state." : "This clears your saved progress and returns the course to a brand-new state. You can start it again when you're ready."}</DialogDescription>
            <div className="course-confirm-actions">
              <Button variant="outline" size="lg" type="button" onClick={() => setRestartCourseTarget(null)} disabled={restarting}>{t("Cancel", "取消")}</Button>
              <Button className="restart-confirm-button" variant="destructive" size="lg" type="button" onClick={() => void confirmRestartCourse()} disabled={restarting} ref={restartConfirmButtonRef}>{restarting ? t("Restarting...", "正在重新开始……") : t("Restart course", "重新开始课程")}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={Boolean(previewCourse?.coverAssetId)} onOpenChange={(open) => { if (!open) closePreview(); }}>
        {previewCourse?.coverAssetId && (
          <DialogContent className="catalog-image-dialog" showCloseButton={false} aria-label={`Preview of ${previewCourse.title}`}>
            <Button className="catalog-image-close" variant="ghost" size="icon" type="button" onClick={closePreview} aria-label="Close enlarged image" ref={previewCloseRef}><span aria-hidden="true" /></Button>
            <img src={courseAssetUrl(previewCourse.id, previewCourse.coverAssetId)} alt={`Preview of ${previewCourse.title}`} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function toDemoCourse(course: ApiCourse): DemoCourse {
  const tone = course.id === "ai-daily-briefing" ? "blue" : "indigo";
  return { id: course.id, title: course.title, category: course.category, description: course.description, level: course.level, duration: Math.round(course.durationMinutes / 60) + " hours", lessons: course.lessonCount, tone, coverAssetId: course.coverAssetId };
}
