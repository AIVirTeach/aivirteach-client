"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { activateCourse, courseCatalog } from "../lib/courses";

export default function CoursesPage() {
  const router = useRouter();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  useEffect(() => {
    setActiveCourseId(window.localStorage.getItem("aivirteach.activeCourse.v1"));
  }, []);

  function startCourse(courseId: string) {
    activateCourse(courseId);
    setActiveCourseId(courseId);
    router.push("/workspace");
  }

  return (
    <div className="app-shell">
      <Sidebar active="courses" />
      <main className="courses-page page-content">
        <header className="courses-head">
          <p className="eyebrow">COURSE CATALOG</p>
          <h1>Choose what to learn next</h1>
          <p>Start a course and continue directly in your interactive Learning Lab.</p>
        </header>

        <section className="course-catalog" aria-label="Available courses">
          {courseCatalog.map((course) => {
            const isActive = activeCourseId === course.id;
            return (
              <article className={`catalog-card ${isActive ? "active" : ""}`} key={course.id}>
                <div className={`catalog-art ${course.tone}`} aria-hidden="true"><span /></div>
                <div className="catalog-copy">
                  <div className="catalog-label-row"><span>{course.category}</span>{isActive && <strong>Active course</strong>}</div>
                  <h2>{course.title}</h2>
                  <p>{course.description}</p>
                  <div className="catalog-meta"><span>{course.level}</span><span>{course.duration}</span><span>{course.lessons} lessons</span></div>
                  <button className="primary-button" type="button" onClick={() => startCourse(course.id)}>{isActive ? "Continue course" : "Start course"} <span aria-hidden="true">→</span></button>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
