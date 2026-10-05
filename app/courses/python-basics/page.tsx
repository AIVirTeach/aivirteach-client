"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "../../components/Sidebar";
import { useMockCourseProgress } from "../../hooks/useMockCourseProgress";
import { mockCourseCompletion, mockCourseLessons } from "../../lib/mock-course";
import { localize, useLearningLanguage } from "../../lib/language";

function formatLearningTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function PythonBasicsCoursePage() {
  const { progress, submitAnswer, reset } = useMockCourseProgress(true);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"" | "correct" | "incorrect">("");
  const lesson = mockCourseLessons[lessonIndex];
  const completion = mockCourseCompletion(progress);
  const lessonComplete = progress.completedLessonIds.includes(lesson.id);
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  function selectLesson(index: number) {
    setLessonIndex(index);
    setSelectedAnswer(null);
    setFeedback("");
  }

  function checkAnswer() {
    if (selectedAnswer === null) return;
    const correct = selectedAnswer === lesson.answer;
    submitAnswer(lesson.id, correct);
    setFeedback(correct ? "correct" : "incorrect");
  }

  function goToNextLesson() {
    if (lessonIndex < mockCourseLessons.length - 1) selectLesson(lessonIndex + 1);
  }

  function resetCourse() {
    if (!window.confirm(t("Reset all locally saved Python course progress and learning time?", "要重置本地保存的全部 Python 课程进度和学习时间吗？"))) return;
    reset();
    setLessonIndex(0);
    setSelectedAnswer(null);
    setFeedback("");
  }

  return (
    <div className="app-shell mock-course-shell">
      <Sidebar active="workspace" />
      <main className="mock-course-page page-content">
        <header className="mock-course-head">
          <div>
            <Button render={<Link href="/courses" />} variant="link">← {t("Course catalog", "课程目录")}</Button>
            <span>{t("FRONTEND PRACTICE COURSE", "前端练习课程")}</span>
            <h1>{t("Python Basics: Browser Lab", "Python 基础：浏览器实验室")}</h1>
            <p>{t("Four quick lessons that save your progress and learning activity on this device.", "四节简短课程，会在此设备上保存你的进度和学习活动。")}</p>
          </div>
          <div className="mock-course-session">
            <span>{t("Active learning time", "有效学习时间")}</span>
            <strong>{formatLearningTime(progress.totalSeconds)}</strong>
            <Button variant="destructive" type="button" onClick={resetCourse}>{t("Reset progress", "重置进度")}</Button>
          </div>
        </header>

        <section className="mock-course-progress" aria-label={`${completion}% course completion`}>
          <Progress className="mock-course-progress-track" value={completion} aria-label={`${completion}% course completion`} />
          <strong>{t(`${progress.completedLessonIds.length} of ${mockCourseLessons.length} lessons complete`, `已完成 ${progress.completedLessonIds.length}/${mockCourseLessons.length} 节课程`)}</strong>
          <span>{completion}%</span>
        </section>

        <div className="mock-course-layout">
          <Card as="aside" className="mock-course-outline" aria-label="Course lessons">
            <header><span>{t("COURSE OUTLINE", "课程大纲")}</span><strong>{t("Python foundations", "Python 基础")}</strong></header>
            <ol>
              {mockCourseLessons.map((item, index) => {
                const complete = progress.completedLessonIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <Button variant="ghost" className={`${index === lessonIndex ? "active" : ""} ${complete ? "complete" : ""}`} type="button" onClick={() => selectLesson(index)} aria-current={index === lessonIndex ? "step" : undefined}>
                      <span>{complete ? "✓" : item.number}</span>
                      <div><small>{t(`Lesson ${item.number}`, `第 ${item.number} 课`)}</small><strong>{item.title}</strong></div>
                    </Button>
                  </li>
                );
              })}
            </ol>
            <div className="mock-course-local-note"><span aria-hidden="true">i</span><p><strong>{t("Saved locally", "保存在本地")}</strong>{t("Your activity stays in this browser and feeds Analytics V2.", "你的活动保存在此浏览器中，并用于分析 V2。")}</p></div>
          </Card>

          <Card as="article" className="mock-course-lesson">
            <header>
              <div><span>LESSON {lesson.number} · {lesson.skill.toUpperCase()}</span><h2>{lesson.title}</h2><p>{lesson.objective}</p></div>
              {lessonComplete && <Badge className="mock-lesson-complete">{t("Completed", "已完成")}</Badge>}
            </header>

            <section className="mock-course-concept">
              <h3>{t("Understand the idea", "理解概念")}</h3>
              <p>{lesson.explanation}</p>
              <div className="mock-code-example"><header><span>python</span><i /><i /><i /></header><pre><code>{lesson.code}</code></pre></div>
            </section>

            <section className="mock-course-challenge" aria-labelledby="mock-challenge-title">
              <div className="mock-course-challenge-heading"><span>{t("CHECK YOUR UNDERSTANDING", "检查你的理解")}</span><h3 id="mock-challenge-title">{lesson.prompt}</h3></div>
              <div className="mock-answer-list" role="radiogroup" aria-label="Answer choices">
                {lesson.choices.map((choice, index) => (
                  <Button
                    variant="outline"
                    className={selectedAnswer === index ? "selected" : ""}
                    type="button"
                    role="radio"
                    aria-checked={selectedAnswer === index}
                    onClick={() => { setSelectedAnswer(index); setFeedback(""); }}
                    key={choice}
                  >
                    <span>{String.fromCharCode(65 + index)}</span><code>{choice}</code>
                  </Button>
                ))}
              </div>

              {feedback && (
                <div className={`mock-answer-feedback ${feedback}`} role="status">
                  <strong>{feedback === "correct" ? t("Correct", "正确") : t("Not quite", "还不完全正确")}</strong>
                  <p>{feedback === "correct" ? lesson.answerExplanation : t("Review the example, choose another answer, and try again.", "复习示例，选择另一个答案后重试。")}</p>
                </div>
              )}

              <footer>
                <Button variant="outline" size="lg" type="button" onClick={() => selectLesson(Math.max(0, lessonIndex - 1))} disabled={lessonIndex === 0}>{t("Previous", "上一节")}</Button>
                {lessonIndex === mockCourseLessons.length - 1 && lessonComplete ? (
                  <Button render={<Link href="/analysis/v2" />} className="primary-button" size="lg">{t("View learning analytics →", "查看学习分析 →")}</Button>
                ) : feedback === "correct" || lessonComplete ? (
                  <Button className="primary-button" size="lg" type="button" onClick={goToNextLesson}>{t("Next lesson →", "下一节 →")}</Button>
                ) : (
                  <Button className="primary-button" size="lg" type="button" onClick={checkAnswer} disabled={selectedAnswer === null}>{t("Check answer", "检查答案")}</Button>
                )}
              </footer>
            </section>
          </Card>
        </div>
      </main>
    </div>
  );
}
