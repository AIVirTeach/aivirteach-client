"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { api, courseAssetUrl, type ApiCourse } from "../lib/api";
import { activateCourse, clearActiveCourse, type DemoCourse } from "../lib/courses";

export default function CoursesPage() {
  const router = useRouter();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<DemoCourse[]>([]);
  const [error, setError] = useState("");
  const [pendingCourse, setPendingCourse] = useState<DemoCourse | null>(null);
  const [starting, setStarting] = useState(false);
  const [restartCourseTarget, setRestartCourseTarget] = useState<DemoCourse | null>(null);
  const [restarting, setRestarting] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const restartConfirmButtonRef = useRef<HTMLButtonElement>(null);

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
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load courses."));
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

  function selectCourse(course: DemoCourse) {
    if (activeCourseId === course.id) {
      activateCourse(course.id);
      router.push("/workspace");
      return;
    }
    setPendingCourse(course);
  }

  async function confirmStartCourse() {
    if (!pendingCourse) return;
    setStarting(true);
    try {
      await api.enroll(pendingCourse.id);
      activateCourse(pendingCourse.id);
      setActiveCourseId(pendingCourse.id);
      setPendingCourse(null);
      router.push("/courses/welcome");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start this course.");
      setPendingCourse(null);
      setStarting(false);
    }
  }

  async function confirmRestartCourse() {
    if (!restartCourseTarget) return;
    setRestarting(true);
    setError("");
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

  return (
    <>
      <div className={`app-shell ${pendingCourse || restartCourseTarget ? "course-page-inert" : ""}`} inert={pendingCourse || restartCourseTarget ? true : undefined} aria-hidden={pendingCourse || restartCourseTarget ? true : undefined}>
        <Sidebar active="courses" />
        <main className="courses-page page-content">
        <header className="courses-head">
          <p className="eyebrow">COURSE CATALOG</p>
          <h1>Choose what to learn next</h1>
          <p>Start a course and continue directly in your interactive Learning Lab.</p>
        </header>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <section className="course-catalog" aria-label="Available courses">
          {orderedCourses.map((course) => {
            const isActive = activeCourseId === course.id;
            return (
              <article className={"catalog-card " + (isActive ? "active" : "")} key={course.id}>
                {course.coverAssetId ? (
                  <div className="catalog-image-wrap">
                    <img className="catalog-image" src={courseAssetUrl(course.id, course.coverAssetId)} alt={`Preview of ${course.title}`} />
                  </div>
                ) : <div className={"catalog-art " + course.tone} aria-hidden="true"><span /></div>}
                <div className="catalog-copy">
                  <div className="catalog-course-info">
                    <div className="catalog-label-row"><span>{course.category}</span></div>
                    <h2>{course.title}</h2>
                    <div className="catalog-meta"><span>{course.level}</span><span>{course.duration}</span><span>{course.lessons} lessons</span></div>
                  </div>
                  <div className="catalog-actions">
                    {isActive && <button className="restart-course-button" type="button" onClick={() => setRestartCourseTarget(course)}>Restart course</button>}
                    <button className={isActive ? "continue-course-button" : "primary-button"} type="button" onClick={() => selectCourse(course)}>{isActive ? "Continue course" : "Start course"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        </main>
      </div>
      {pendingCourse && (
        <div className="course-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !starting) setPendingCourse(null); }}>
          <section className="course-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="course-confirm-title" aria-describedby="course-confirm-description">
            <span className="course-confirm-mark" aria-hidden="true">!</span>
            <h2 id="course-confirm-title">Start {pendingCourse.title}?</h2>
            <p id="course-confirm-description">Starting a new course will pause your current course. Its Learning Lab may be terminated after 3 days, and you may need to restart that lab from the beginning.</p>
            <div className="course-confirm-actions">
              <button type="button" onClick={() => setPendingCourse(null)} disabled={starting}>Cancel</button>
              <button className="primary-button" type="button" onClick={() => void confirmStartCourse()} disabled={starting} ref={confirmButtonRef}>{starting ? "Starting..." : "Start new course"}</button>
            </div>
          </section>
        </div>
      )}
      {restartCourseTarget && (
        <div className="course-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !restarting) setRestartCourseTarget(null); }}>
          <section className="course-confirm-dialog course-restart-dialog" role="dialog" aria-modal="true" aria-labelledby="course-restart-title" aria-describedby="course-restart-description">
            <span className="course-confirm-mark restart" aria-hidden="true">!</span>
            <h2 id="course-restart-title">Restart {restartCourseTarget.title}?</h2>
            <p id="course-restart-description">This resets your saved progress and returns the course to the catalog. You will need to select Start course when you are ready to begin again.</p>
            <div className="course-confirm-actions">
              <button type="button" onClick={() => setRestartCourseTarget(null)} disabled={restarting}>Cancel</button>
              <button className="restart-confirm-button" type="button" onClick={() => void confirmRestartCourse()} disabled={restarting} ref={restartConfirmButtonRef}>{restarting ? "Restarting..." : "Restart course"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function toDemoCourse(course: ApiCourse): DemoCourse {
  const tone = course.id === "n8n-agent-builder" ? "blue" : course.id === "python-data-analysis" ? "cyan" : course.id === "prompt-engineering" ? "violet" : "indigo";
  return { id: course.id, title: course.title, category: course.category, description: course.description, level: course.level, duration: Math.round(course.durationMinutes / 60) + " hours", lessons: course.lessonCount, tone, coverAssetId: course.coverAssetId };
}
