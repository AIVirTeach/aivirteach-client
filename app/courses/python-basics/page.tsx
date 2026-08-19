"use client";

import Link from "next/link";
import { useState } from "react";
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
            <Link href="/courses">← Course catalog</Link>
            <span>FRONTEND PRACTICE COURSE</span>
            <h1>Python Basics: Browser Lab</h1>
            <p>Four quick lessons that save your progress and learning activity on this device.</p>
          </div>
          <div className="mock-course-session">
            <span>Active learning time</span>
            <strong>{formatLearningTime(progress.totalSeconds)}</strong>
            <button type="button" onClick={resetCourse}>Reset progress</button>
          </div>
        </header>

        <section className="mock-course-progress" aria-label={`${completion}% course completion`}>
          <div><span style={{ width: `${completion}%` }} /></div>
          <strong>{progress.completedLessonIds.length} of {mockCourseLessons.length} lessons complete</strong>
          <span>{completion}%</span>
        </section>

        <div className="mock-course-layout">
          <aside className="mock-course-outline" aria-label="Course lessons">
            <header><span>COURSE OUTLINE</span><strong>Python foundations</strong></header>
            <ol>
              {mockCourseLessons.map((item, index) => {
                const complete = progress.completedLessonIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button className={`${index === lessonIndex ? "active" : ""} ${complete ? "complete" : ""}`} type="button" onClick={() => selectLesson(index)} aria-current={index === lessonIndex ? "step" : undefined}>
                      <span>{complete ? "✓" : item.number}</span>
                      <div><small>Lesson {item.number}</small><strong>{item.title}</strong></div>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mock-course-local-note"><span aria-hidden="true">i</span><p><strong>Saved locally</strong>Your activity stays in this browser and feeds Analytics V2.</p></div>
          </aside>

          <article className="mock-course-lesson">
            <header>
              <div><span>LESSON {lesson.number} · {lesson.skill.toUpperCase()}</span><h2>{lesson.title}</h2><p>{lesson.objective}</p></div>
              {lessonComplete && <strong className="mock-lesson-complete">Completed</strong>}
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
                  <button
                    className={selectedAnswer === index ? "selected" : ""}
                    type="button"
                    role="radio"
                    aria-checked={selectedAnswer === index}
                    onClick={() => { setSelectedAnswer(index); setFeedback(""); }}
                    key={choice}
                  >
                    <span>{String.fromCharCode(65 + index)}</span><code>{choice}</code>
                  </button>
                ))}
              </div>

              {feedback && (
                <div className={`mock-answer-feedback ${feedback}`} role="status">
                  <strong>{feedback === "correct" ? "Correct" : "Not quite"}</strong>
                  <p>{feedback === "correct" ? lesson.answerExplanation : "Review the example, choose another answer, and try again."}</p>
                </div>
              )}

              <footer>
                <button type="button" onClick={() => selectLesson(Math.max(0, lessonIndex - 1))} disabled={lessonIndex === 0}>Previous</button>
                {lessonIndex === mockCourseLessons.length - 1 && lessonComplete ? (
                  <Link className="primary-button" href="/analysis/v2">View learning analytics →</Link>
                ) : feedback === "correct" || lessonComplete ? (
                  <button className="primary-button" type="button" onClick={goToNextLesson}>Next lesson →</button>
                ) : (
                  <button className="primary-button" type="button" onClick={checkAnswer} disabled={selectedAnswer === null}>Check answer</button>
                )}
              </footer>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
