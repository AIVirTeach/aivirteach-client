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
    if (!window.confirm("Reset all locally saved Python course progress and learning time?")) return;
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
            <Button render={<Link href="/courses" />} variant="link">← Course catalog</Button>
            <span>FRONTEND PRACTICE COURSE</span>
            <h1>Python Basics: Browser Lab</h1>
            <p>Four quick lessons that save your progress and learning activity on this device.</p>
          </div>
          <div className="mock-course-session">
            <span>Active learning time</span>
            <strong>{formatLearningTime(progress.totalSeconds)}</strong>
            <Button variant="destructive" type="button" onClick={resetCourse}>Reset progress</Button>
          </div>
        </header>

        <section className="mock-course-progress" aria-label={`${completion}% course completion`}>
          <Progress className="mock-course-progress-track" value={completion} aria-label={`${completion}% course completion`} />
          <strong>{progress.completedLessonIds.length} of {mockCourseLessons.length} lessons complete</strong>
          <span>{completion}%</span>
        </section>

        <div className="mock-course-layout">
          <Card as="aside" className="mock-course-outline" aria-label="Course lessons">
            <header><span>COURSE OUTLINE</span><strong>Python foundations</strong></header>
            <ol>
              {mockCourseLessons.map((item, index) => {
                const complete = progress.completedLessonIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <Button variant="ghost" className={`${index === lessonIndex ? "active" : ""} ${complete ? "complete" : ""}`} type="button" onClick={() => selectLesson(index)} aria-current={index === lessonIndex ? "step" : undefined}>
                      <span>{complete ? "✓" : item.number}</span>
                      <div><small>Lesson {item.number}</small><strong>{item.title}</strong></div>
                    </Button>
                  </li>
                );
              })}
            </ol>
            <div className="mock-course-local-note"><span aria-hidden="true">i</span><p><strong>Saved locally</strong>Your activity stays in this browser and feeds Analytics V2.</p></div>
          </Card>

          <Card as="article" className="mock-course-lesson">
            <header>
              <div><span>LESSON {lesson.number} · {lesson.skill.toUpperCase()}</span><h2>{lesson.title}</h2><p>{lesson.objective}</p></div>
              {lessonComplete && <Badge className="mock-lesson-complete">Completed</Badge>}
            </header>

            <section className="mock-course-concept">
              <h3>Understand the idea</h3>
              <p>{lesson.explanation}</p>
              <div className="mock-code-example"><header><span>python</span><i /><i /><i /></header><pre><code>{lesson.code}</code></pre></div>
            </section>

            <section className="mock-course-challenge" aria-labelledby="mock-challenge-title">
              <div className="mock-course-challenge-heading"><span>CHECK YOUR UNDERSTANDING</span><h3 id="mock-challenge-title">{lesson.prompt}</h3></div>
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
                  <strong>{feedback === "correct" ? "Correct" : "Not quite"}</strong>
                  <p>{feedback === "correct" ? lesson.answerExplanation : "Review the example, choose another answer, and try again."}</p>
                </div>
              )}

              <footer>
                <Button variant="outline" size="lg" type="button" onClick={() => selectLesson(Math.max(0, lessonIndex - 1))} disabled={lessonIndex === 0}>Previous</Button>
                {lessonIndex === mockCourseLessons.length - 1 && lessonComplete ? (
                  <Button render={<Link href="/analysis/v2" />} className="primary-button" size="lg">View learning analytics →</Button>
                ) : feedback === "correct" || lessonComplete ? (
                  <Button className="primary-button" size="lg" type="button" onClick={goToNextLesson}>Next lesson →</Button>
                ) : (
                  <Button className="primary-button" size="lg" type="button" onClick={checkAnswer} disabled={selectedAnswer === null}>Check answer</Button>
                )}
              </footer>
            </section>
          </Card>
        </div>
      </main>
    </div>
  );
}
