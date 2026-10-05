"use client";

import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "../../components/Sidebar";
import { useLearnerProfile } from "../../hooks/useLearnerProfile";
import { useMockCourseProgress } from "../../hooks/useMockCourseProgress";
import { mockCourseCompletion, mockCourseLessons, mockCourseSkillScores, mockCourseStreak, mockCourseWeeklyHours } from "../../lib/mock-course";
import { localize, useLearningLanguage } from "../../lib/language";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalysisV2Page() {
  const [range, setRange] = useState<"30" | "all">("30");
  const [insightExpanded, setInsightExpanded] = useState(false);
  const { profile, loading, error } = useLearnerProfile();
  const { progress: mockProgress } = useMockCourseProgress();
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);
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
    { label: t("Practice time", "练习时间"), value: `${practiceHours}h`, detail: hasMockCourseData ? t("Tracked in this browser", "在此浏览器中记录") : t(`+${profile.analytics.practiceTrend}% from before`, `较之前 +${profile.analytics.practiceTrend}%`), tone: "blue" },
    { label: t("Tasks completed", "已完成任务"), value: String(tasksCompleted), detail: hasMockCourseData ? t(`${mockProgress.attempts} total attempts`, `共尝试 ${mockProgress.attempts} 次`) : t(`+${profile.analytics.taskTrend}% from before`, `较之前 +${profile.analytics.taskTrend}%`), tone: "violet" },
    { label: t("Current streak", "连续学习"), value: `${streakDays}d`, detail: t("Keep the rhythm going", "保持学习节奏"), tone: "amber" },
    { label: t("Skills mastered", "已掌握技能"), value: String(skillsMastered), detail: t(`${hasMockCourseData ? mockSkills.length : profile.skills.length} skill areas tracked`, `正在追踪 ${hasMockCourseData ? mockSkills.length : profile.skills.length} 个技能领域`), tone: "cyan" },
  ];

  return (
    <div className="app-shell analysis-v2-shell">
      <Sidebar active="analysis" />
      <main className={`analysis-v2 page-content ${loading ? "data-loading" : ""}`}>
        {error && <Alert className="auth-error" variant="destructive">Backend unavailable: {error}</Alert>}

        <header className="analysis-v2-head">
          <div>
            <div className="analysis-v2-kicker"><span>{t("Learning Analytics", "学习分析")}</span><b>V2</b></div>
            <h1>{t("See where your learning is moving.", "掌握你的学习进展。")}</h1>
            <p>{t("A focused view of your progress, practice patterns, and next best action.", "集中查看学习进度、练习模式和下一步最佳行动。")}</p>
          </div>
          <div className="analysis-v2-head-actions">
            <Button render={<Link href="/analysis" />} variant="ghost">{t("Classic view", "经典视图")}</Button>
            <div className="analysis-v2-range" aria-label="Analytics date range">
              <Button variant="ghost" className={range === "30" ? "active" : ""} type="button" onClick={() => setRange("30")}>{t("30 days", "30 天")}</Button>
              <Button variant="ghost" className={range === "all" ? "active" : ""} type="button" onClick={() => setRange("all")}>{t("All time", "全部时间")}</Button>
            </div>
          </div>
        </header>

        <Card as="section" className="analysis-v2-course" aria-labelledby="analysis-v2-course-title">
          <div className="analysis-v2-course-copy">
            <span>{course.category}</span>
            <h2 id="analysis-v2-course-title">{course.title}</h2>
            <p>{course.module}</p>
            <Progress className="analysis-v2-course-track" value={course.progress} aria-label={`${course.progress}% course completion`} />
          </div>
          <div className="analysis-v2-course-progress" style={courseProgressStyle} aria-label={`${course.progress}% complete`}>
            <div><strong>{course.progress}%</strong><span>{t("complete", "已完成")}</span></div>
          </div>
          <div className="analysis-v2-course-note">
            <span>{t("Next milestone", "下一个里程碑")}</span>
            <strong>{course.progress === 100 ? t("Course complete", "课程已完成") : t(`${Math.min(100, Math.ceil((course.progress + 1) / 10) * 10)}% completion`, `完成 ${Math.min(100, Math.ceil((course.progress + 1) / 10) * 10)}%`)}</strong>
            <Button render={<Link href={course.progress === 100 ? "/courses" : hasMockCourseData ? "/courses/python-basics" : "/workspace"} />} variant="link">{course.progress === 100 ? t("Explore another course", "探索其他课程") : t("Continue learning", "继续学习")}<span aria-hidden="true">→</span></Button>
          </div>
        </Card>

        <section className="analysis-v2-metrics" aria-label="Learning outcomes">
          {metrics.map((metric) => (
            <Card as="article" key={metric.label}>
              <span className={`analysis-v2-metric-mark ${metric.tone}`} aria-hidden="true" />
              <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>
            </Card>
          ))}
        </section>

        <section className="analysis-v2-main-grid">
          <Card as="article" className="analysis-v2-panel analysis-v2-weekly">
            <header>
              <div><span className="analysis-v2-label">{t("THIS WEEK", "本周")}</span><h2>{t("Learning activity", "学习活动")}</h2></div>
              <div><strong>{weeklyTotal}h</strong><span>{t("Total practice", "总练习时长")}</span></div>
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
          </Card>

          <aside className="analysis-v2-side">
            <Card as="article" className="analysis-v2-insight">
              <header><span aria-hidden="true">AI</span><div><small>{t("PERSONAL INSIGHT", "个人洞察")}</small><strong>{t("Recommended focus", "建议重点")}</strong></div></header>
              <p>{analyticsInsight}</p>
              {insightExpanded && <p className="analysis-v2-insight-detail">{analyticsInsightDetail}</p>}
              <Button variant="link" type="button" onClick={() => setInsightExpanded((expanded) => !expanded)}>{insightExpanded ? t("Show less", "收起") : t("Why this matters", "为何重要")}<span aria-hidden="true">→</span></Button>
            </Card>
          </aside>
        </section>

        <section className="analysis-v2-achievements">
          <header><div><span className="analysis-v2-label">{t("MILESTONES", "里程碑")}</span><h2>{t("Achievements", "成就")}</h2></div><span>{t(`${achievements.filter((achievement) => achievement.unlocked).length} of ${achievements.length} unlocked`, `已解锁 ${achievements.filter((achievement) => achievement.unlocked).length}/${achievements.length}`)}</span></header>
          <div>
            {achievements.map((achievement, index) => (
              <Card as="article" className={achievement.unlocked ? "unlocked" : "locked"} key={achievement.title}>
                <span aria-hidden="true">{achievement.unlocked ? "✓" : index + 1}</span>
                <div><strong>{achievement.title}</strong><small>{achievement.subtitle}</small></div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
