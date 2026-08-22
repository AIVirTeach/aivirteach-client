"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, courseAssetUrl, type ApiCourseDetail, type ApiCourseWelcome } from "../../lib/api";
import { activateCourse } from "../../lib/courses";

const welcomeVideoUrl = process.env.NEXT_PUBLIC_COURSE_WELCOME_VIDEO_URL;

// Courses ingested without a dedicated welcome.json have no CourseWelcome row, so
// GET /courses/:slug/welcome 404s. Build an equivalent welcome view from the course
// detail that's already loaded, instead of blocking the learner from reaching /workspace.
function synthesizeWelcome(course: ApiCourseDetail): ApiCourseWelcome {
  return {
    schemaVersion: 0,
    courseId: course.id,
    title: course.title,
    overviewAsset: null,
    overview: { heading: course.title, paragraphs: [course.description] },
    howItWorks: {
      heading: "Before you start",
      steps: course.requirements.map((requirement, index) => ({
        number: String(index + 1).padStart(2, "0"),
        title: requirement,
        description: "",
      })),
    },
    finalOutcome: {
      heading: "What you'll walk away with",
      description: course.outcomes.map((outcome) => (outcome.endsWith(".") ? outcome : `${outcome}.`)).join(" "),
    },
  };
}

export default function CourseWelcomePage() {
  const router = useRouter();
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [welcome, setWelcome] = useState<ApiCourseWelcome | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.enrollments().then(async (enrollments) => {
      const activeCourseId = enrollments.find((enrollment) => enrollment.active)?.courseId;
      if (!activeCourseId) return;
      const courseData = await api.course(activeCourseId);
      if (!active) return;
      activateCourse(activeCourseId);
      setCourse(courseData);
      try {
        setWelcome(await api.courseWelcome(activeCourseId));
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
        setWelcome(synthesizeWelcome(courseData));
      }
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not prepare this course.");
    }).finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);

  return (
    <main className="course-welcome-page">
      {!checked ? (
        <p className="course-welcome-loading" role="status">Preparing your course...</p>
      ) : course && welcome ? (
        <section className="course-welcome-window" aria-label={`${course.title} welcome`}>
          <header className="course-welcome-progress">
            <span>{step} of 2</span>
            <div aria-hidden="true"><i className="active" /><i className={step === 2 ? "active" : ""} /></div>
          </header>

          {step === 1 ? (
            <div className="course-welcome-grid course-overview-step">
              {welcome.overviewAsset && <figure className="course-welcome-image">
                <img src={courseAssetUrl(course.id, welcome.overviewAsset.id)} alt={welcome.overviewAsset.alt} />
              </figure>}
              <section className="course-overview-copy" aria-labelledby="course-overview-title">
                <p>{course.category}</p>
                <h1 id="course-overview-title">{welcome.overview.heading}</h1>
                <div className="course-overview-paragraphs">{welcome.overview.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
                <section className="course-how-it-works" aria-labelledby="how-it-works-title">
                  <h2 id="how-it-works-title">{welcome.howItWorks.heading}</h2>
                  <ol>{welcome.howItWorks.steps.map((item) => <li key={item.number}><span>{item.number}</span><div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div></li>)}</ol>
                </section>
                <section className="course-final-outcome"><strong>{welcome.finalOutcome.heading}</strong><p>{welcome.finalOutcome.description}</p></section>
              </section>
            </div>
          ) : (
            <div className="course-how-to-step">
              <header><p>LEARNING LAB</p><h1>How to use the VM and course interface</h1><span>Watch this short walkthrough before opening your workspace.</span></header>
              <div className="course-video-frame">
                {welcomeVideoUrl ? (
                  <video controls preload="metadata"><source src={welcomeVideoUrl} />Your browser does not support embedded video.</video>
                ) : (
                  <div className="course-video-placeholder" role="img" aria-label="Learning Lab walkthrough video coming soon"><span aria-hidden="true" /><strong>VM and interface walkthrough</strong><small>Video coming soon</small></div>
                )}
              </div>
            </div>
          )}

          <footer className="course-welcome-actions">
            {step === 2 && <button type="button" onClick={() => setStep(1)}>Back</button>}
            {step === 1 ? <button className="primary-button" type="button" onClick={() => setStep(2)}>Next</button> : <button className="primary-button" type="button" onClick={() => router.push("/workspace")}>Let&apos;s go</button>}
          </footer>
        </section>
      ) : (
        <section className="course-required-card">
          <h1>No active course</h1>
          <p>{error || "Choose a course before entering the Learning Lab."}</p>
          <button className="primary-button" type="button" onClick={() => router.replace("/courses")}>Browse courses</button>
        </section>
      )}
    </main>
  );
}
