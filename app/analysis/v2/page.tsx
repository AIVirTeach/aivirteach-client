"use client";

import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { useLearnerProfile } from "../../hooks/useLearnerProfile";
import { useMockCourseProgress } from "../../hooks/useMockCourseProgress";
import { mockCourseCompletion, mockCourseLessons, mockCourseSkillScores, mockCourseStreak, mockCourseWeeklyHours } from "../../lib/mock-course";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalysisV2Page() {
  const [range, setRange] = useState<"30" | "all">("30");
  const [insightExpanded, setInsightExpanded] = useState(false);
  const { profile, loading, error } = useLearnerProfile();
  const { progress: mockProgress } = useMockCourseProgress();
  const hasMockCourseData = Boolean(mockProgress.startedAt);
  const mockCompletion = mockCourseCompletion(mockProgress);
  const mockSkills = mockCourseSkillScores(mockProgress);
  const mockWeeklyHours = mockCourseWeeklyHours(mockProgress);
  const weeklyHours = hasMockCourseData ? mockWeeklyHours : profile.weeklyHours;
  const course = hasMockCourseData ? {
    category: "Python Programming",
    title: "Python Basics: Browser Lab",
    module: mockCompletion === 100 ? "All four browser lessons complete" : `Lesson ${Math.min(mockProgress.completedLessonIds.length + 1, mockCourseLessons.length)} of ${mockCourseLessons.length}`,
    progress: mockCompletion,
  } : profile.course;

  const practiceMinutes = hasMockCourseData ? mockProgress.totalSeconds / 60 : range === "all" ? profile.stats.practiceMinutes : profile.stats.last30PracticeMinutes;
  const tasksCompleted = hasMockCourseData ? mockProgress.completedLessonIds.length : range === "all" ? profile.stats.tasksCompleted : profile.stats.last30TasksCompleted;
  const practiceHours = Math.round(practiceMinutes / 6) / 10;
  const weeklyTotal = Math.round(weeklyHours.reduce((total, hours) => total + hours, 0) * 10) / 10;
  const actualMaxWeeklyHours = Math.max(...weeklyHours);
  const maxWeeklyHours = Math.max(1, actualMaxWeeklyHours);
  const bestDayIndex = Math.max(0, weeklyHours.indexOf(actualMaxWeeklyHours));
  const courseProgressStyle = { "--course-progress": `${course.progress}%` } as CSSProperties;
  const skillsMastered = hasMockCourseData ? mockSkills.filter((skill) => skill.value === 100).length : profile.stats.skillsMastered;
  const streakDays = hasMockCourseData ? mockCourseStreak(mockProgress) : profile.stats.streakDays;
  const analyticsInsight = hasMockCourseData
    ? mockCompletion === 100
      ? "You completed every Python Basics lesson. A short review session tomorrow will help reinforce the new concepts."
      : mockProgress.completedLessonIds.length === 0
        ? "Complete the first Python challenge to establish a baseline for your learning analytics."
        : `You have completed ${mockProgress.completedLessonIds.length} of ${mockCourseLessons.length} lessons. Continue with the next lesson while the earlier concepts are still fresh.`
    : profile.analytics.insight;
  const analyticsInsightDetail = hasMockCourseData
    ? `Your browser has recorded ${Math.round(mockProgress.totalSeconds / 60)} learning minutes, ${mockProgress.attempts} attempts, and ${mockProgress.correctAnswers} correct answers so far.`
    : profile.analytics.insightDetail;
  const achievements = hasMockCourseData
    ? mockCourseLessons.map((lesson) => ({ title: lesson.skill, subtitle: lesson.title, unlocked: mockProgress.completedLessonIds.includes(lesson.id) }))
    : profile.achievements;

  const metrics = [
    { label: "Practice time", value: `${practiceHours}h`, detail: hasMockCourseData ? "Tracked in this browser" : `+${profile.analytics.practiceTrend}% from before`, tone: "blue" },
    { label: "Tasks completed", value: String(tasksCompleted), detail: hasMockCourseData ? `${mockProgress.attempts} total attempts` : `+${profile.analytics.taskTrend}% from before`, tone: "violet" },
    { label: "Current streak", value: `${streakDays}d`, detail: "Keep the rhythm going", tone: "amber" },
    { label: "Skills mastered", value: String(skillsMastered), detail: `${hasMockCourseData ? mockSkills.length : profile.skills.length} skill areas tracked`, tone: "cyan" },
  ];

  return (
    <div className="app-shell analysis-v2-shell">
      <Sidebar active="analysis" />
      <main className={`analysis-v2 page-content ${loading ? "data-loading" : ""}`}>
        {error && <p className="auth-error" role="alert">Backend unavailable: {error}</p>}

        <header className="analysis-v2-head">
          <div>
            <div className="analysis-v2-kicker"><span>Learning Analytics</span><b>V2</b></div>
            <h1>See where your learning is moving.</h1>
            <p>A focused view of your progress, practice patterns, and next best action.</p>
          </div>
          <div className="analysis-v2-head-actions">
            <Link href="/analysis">Classic view</Link>
            <div className="analysis-v2-range" aria-label="Analytics date range">
              <button className={range === "30" ? "active" : ""} type="button" onClick={() => setRange("30")}>30 days</button>
              <button className={range === "all" ? "active" : ""} type="button" onClick={() => setRange("all")}>All time</button>
            </div>
          </div>
        </header>

        <section className="analysis-v2-course" aria-labelledby="analysis-v2-course-title">
          <div className="analysis-v2-course-copy">
            <span>{course.category}</span>
            <h2 id="analysis-v2-course-title">{course.title}</h2>
            <p>{course.module}</p>
            <div className="analysis-v2-course-track" aria-label={`${course.progress}% course completion`}>
              <span style={{ width: `${course.progress}%` }} />
            </div>
          </div>
          <div className="analysis-v2-course-progress" style={courseProgressStyle} aria-label={`${course.progress}% complete`}>
            <div><strong>{course.progress}%</strong><span>complete</span></div>
          </div>
          <div className="analysis-v2-course-note">
            <span>Next milestone</span>
            <strong>{course.progress === 100 ? "Course complete" : `${Math.min(100, Math.ceil((course.progress + 1) / 10) * 10)}% completion`}</strong>
            <Link href={course.progress === 100 ? "/courses" : hasMockCourseData ? "/courses/python-basics" : "/workspace"}>{course.progress === 100 ? "Explore another course" : "Continue learning"}<span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="analysis-v2-metrics" aria-label="Learning outcomes">
          {metrics.map((metric) => (
            <article key={metric.label}>
              <span className={`analysis-v2-metric-mark ${metric.tone}`} aria-hidden="true" />
              <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>
            </article>
          ))}
        </section>

        <section className="analysis-v2-main-grid">
          <article className="analysis-v2-panel analysis-v2-weekly">
            <header>
              <div><span className="analysis-v2-label">THIS WEEK</span><h2>Learning activity</h2></div>
              <div><strong>{weeklyTotal}h</strong><span>Total practice</span></div>
            </header>
            <div className="analysis-v2-chart" role="img" aria-label={`Learning hours from Monday to Sunday: ${weeklyHours.join(", ")} hours`}>
              {weeklyHours.map((hours, index) => (
                <div className={`analysis-v2-bar-column ${index === bestDayIndex ? "best" : ""}`} key={days[index]} title={`${days[index]}: ${hours} hours`}>
                  <span>{hours ? `${hours}h` : "0"}</span>
                  <div><i style={{ height: `${hours ? Math.max(8, hours / maxWeeklyHours * 100) : 3}%` }} /></div>
                  <strong>{days[index]}</strong>
                </div>
              ))}
            </div>
            <footer><span><i /> Active learning</span><p>{weeklyTotal > 0 ? <>Your strongest day was <strong>{days[bestDayIndex]}</strong> with {actualMaxWeeklyHours} hours.</> : "Complete a lesson to begin charting activity."}</p></footer>
          </article>

          <aside className="analysis-v2-side">
            <article className="analysis-v2-insight">
              <header><span aria-hidden="true">AI</span><div><small>PERSONAL INSIGHT</small><strong>Recommended focus</strong></div></header>
              <p>{analyticsInsight}</p>
              {insightExpanded && <p className="analysis-v2-insight-detail">{analyticsInsightDetail}</p>}
              <button type="button" onClick={() => setInsightExpanded((expanded) => !expanded)}>{insightExpanded ? "Show less" : "Why this matters"}<span aria-hidden="true">→</span></button>
            </article>
          </aside>
        </section>

        <section className="analysis-v2-achievements">
          <header><div><span className="analysis-v2-label">MILESTONES</span><h2>Achievements</h2></div><span>{achievements.filter((achievement) => achievement.unlocked).length} of {achievements.length} unlocked</span></header>
          <div>
            {achievements.map((achievement, index) => (
              <article className={achievement.unlocked ? "unlocked" : "locked"} key={achievement.title}>
                <span aria-hidden="true">{achievement.unlocked ? "✓" : index + 1}</span>
                <div><strong>{achievement.title}</strong><small>{achievement.subtitle}</small></div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
