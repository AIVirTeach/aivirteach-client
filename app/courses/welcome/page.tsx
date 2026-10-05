"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError, courseAssetUrl, type ApiCourseDetail, type ApiCourseWelcome } from "../../lib/api";
import { activateCourse } from "../../lib/courses";
import { localize, useLearningLanguage } from "../../lib/language";

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
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);
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
        <p className="course-welcome-loading" role="status">{t("Preparing your course...", "正在准备课程……")}</p>
      ) : course && welcome ? (
        <Card as="section" className="course-welcome-window" aria-label={`${course.title} welcome`}>
          <header className="course-welcome-progress">
            <span>{t(`${step} of 2`, `第 ${step} 步，共 2 步`)}</span>
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
              <header><p>{t("LEARNING LAB", "学习实验室")}</p><h1>{t("How to use the VM and course interface", "如何使用虚拟机和课程界面")}</h1><span>{t("Watch this short walkthrough before opening your workspace.", "打开工作区前，请观看这段简短说明。")}</span></header>
              <div className="course-video-frame">
                {welcomeVideoUrl ? (
                  <video controls preload="metadata"><source src={welcomeVideoUrl} />{t("Your browser does not support embedded video.", "你的浏览器不支持嵌入式视频。")}</video>
                ) : (
                  <div className="course-video-placeholder" role="img" aria-label={t("Learning Lab walkthrough video coming soon", "学习实验室介绍视频即将推出")}><span aria-hidden="true" /><strong>{t("VM and interface walkthrough", "虚拟机与界面介绍")}</strong><small>{t("Video coming soon", "视频即将推出")}</small></div>
                )}
              </div>
            </div>
          )}

          <footer className="course-welcome-actions">
            {step === 2 && <Button variant="outline" size="lg" type="button" onClick={() => setStep(1)}>{t("Back", "返回")}</Button>}
            {step === 1 ? <Button className="primary-button" size="lg" type="button" onClick={() => setStep(2)}>{t("Next", "下一步")}</Button> : <Button className="primary-button" size="lg" type="button" onClick={() => router.push("/workspace")}>{t("Let's go", "开始吧")}</Button>}
          </footer>
        </Card>
      ) : (
        <Card as="section" className="course-required-card">
          <h1>{t("No active course", "没有进行中的课程")}</h1>
          <p>{error || t("Choose a course before entering the Learning Lab.", "进入学习实验室前，请先选择课程。")}</p>
          <Button className="primary-button" size="lg" type="button" onClick={() => router.replace("/courses")}>{t("Browse courses", "浏览课程")}</Button>
        </Card>
      )}
    </main>
  );
}
