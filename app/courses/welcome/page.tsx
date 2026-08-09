"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { activateCourse, readActiveCourse, type DemoCourse } from "../../lib/courses";

const welcomeVideoUrl = process.env.NEXT_PUBLIC_COURSE_WELCOME_VIDEO_URL;
const milestones = ["Learn the essential concepts", "Build the core project", "Test and improve your work", "Complete the final challenge"];

export default function CourseWelcomePage() {
  const router = useRouter();
  const [course, setCourse] = useState<DemoCourse | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api.enrollments().then((enrollments) => {
      const activeCourseId = enrollments.find((enrollment) => enrollment.active)?.courseId;
      if (activeCourseId) activateCourse(activeCourseId);
      setCourse(readActiveCourse());
    }).catch(() => setCourse(readActiveCourse())).finally(() => setChecked(true));
  }, []);

  return (
    <main className="course-welcome-page">
      {!checked ? (
        <p className="course-welcome-loading" role="status">Preparing your course...</p>
      ) : course ? (
        <section className="course-welcome-window" aria-label={`${course.title} welcome`}>
          <div className="course-welcome-grid">
            <section className="course-welcome-video" aria-labelledby="welcome-video-title">
              <h1 id="welcome-video-title">How to use the Learning Lab</h1>
              <div className="course-video-frame">
                {welcomeVideoUrl ? (
                  <video controls preload="metadata"><source src={welcomeVideoUrl} />Your browser does not support embedded video.</video>
                ) : (
                  <div className="course-video-placeholder" role="img" aria-label="How to use the Learning Lab video coming soon"><span aria-hidden="true" /><strong>How-to video</strong><small>Video coming soon</small></div>
                )}
              </div>
            </section>
            <section className="course-welcome-summary" aria-labelledby="course-summary-title">
              <p>{course.category}</p>
              <h2 id="course-summary-title">{course.title}</h2>
              <ol>{milestones.map((milestone, index) => <li key={milestone}><span>{String(index + 1).padStart(2, "0")}</span><strong>{milestone}</strong></li>)}</ol>
            </section>
          </div>
          <button className="primary-button course-welcome-enter" type="button" onClick={() => router.push("/workspace")}>Let&apos;s Go!</button>
        </section>
      ) : (
        <section className="course-required-card">
          <h1>No active course</h1>
          <p>Choose a course before entering the Learning Lab.</p>
          <button className="primary-button" type="button" onClick={() => router.replace("/courses")}>Browse courses</button>
        </section>
      )}
    </main>
  );
}
