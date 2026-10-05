"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "../components/Sidebar";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { localize, useLearningLanguage } from "../lib/language";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalysisPage() {
  const [range, setRange] = useState<"30" | "all">("30");
  const { profile } = useLearnerProfile();
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);
  const practiceMinutes = range === "all" ? profile.stats.practiceMinutes : profile.stats.last30PracticeMinutes;
  const practiceHours = Math.round(practiceMinutes / 6) / 10;
  const tasksCompleted = range === "all" ? profile.stats.tasksCompleted : profile.stats.last30TasksCompleted;
  const maxWeeklyHours = Math.max(4, Math.ceil(Math.max(...profile.weeklyHours)));
  const metrics = [
    { id: "practice", icon: "◷", label: range === "all" ? t("Total Practice Time", "总练习时间") : t("Practice Time", "练习时间"), value: `${practiceHours}h`, delta: `↗ ${profile.analytics.practiceTrend}%`, tone: "teal" },
    { id: "tasks", icon: "✓", label: t("Tasks Completed", "已完成任务"), value: String(tasksCompleted), delta: `↗ ${profile.analytics.taskTrend}%`, tone: "amber" },
    { id: "goal", icon: "◎", label: t("Weekly Goal", "每周目标"), value: `${profile.stats.weeklyGoalPercent}%`, delta: profile.stats.weeklyGoalPercent === 100 ? t("Complete", "已完成") : `↗ ${profile.analytics.goalTrend}%`, tone: "sand" },
  ];

  return (
    <div className="app-shell">
      <Sidebar active="analysis" />
      <main className="analysis page-content">
        <header className="analysis-head">
          <div><h1>{t("Learning Analytics", "学习分析")}</h1><p>{t("Track your mastery and learning progression.", "追踪你的掌握程度和学习进展。")}</p></div>
          <div className="analysis-head-actions">
            <Button render={<Link href="/analysis/v2" />} className="analysis-v2-link" variant="outline">{t("View v2", "查看 V2")}</Button>
            <div className="range-toggle" aria-label="Analytics date range">
              <Button variant="ghost" type="button" className={range === "30" ? "active" : ""} onClick={() => setRange("30")}>{t("Last 30 Days", "最近 30 天")}</Button>
              <Button variant="ghost" type="button" className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>{t("All Time", "全部时间")}</Button>
            </div>
          </div>
        </header>

        <section className="metric-grid">
          {metrics.map((metric) => (
            <Card as="article" className="metric-card" key={metric.label}>
              <div className="metric-top"><span className={`metric-icon ${metric.tone}`}>{metric.icon}</span><Badge className="delta" variant="outline">{metric.delta}</Badge></div>
              <span className="metric-label">{metric.label}</span><strong>{metric.value}</strong>
              {metric.id === "goal" && <Progress className="progress-track slim" value={profile.stats.weeklyGoalPercent} aria-label={t(`${profile.stats.weeklyGoalPercent}% weekly goal`, `每周目标完成 ${profile.stats.weeklyGoalPercent}%`)} />}
            </Card>
          ))}
        </section>

        <section className="analytics-layout">
          <Card as="article" className="chart-card">
            <h2>{t("Weekly Learning Hours", "每周学习时长")}</h2>
            <div className="weekly-chart" role="img" aria-label={`Learning hours from Monday to Sunday: ${profile.weeklyHours.join(", ")} hours`}>
              <div className="weekly-chart-scale" aria-hidden="true"><span>{maxWeeklyHours}h</span><span>{maxWeeklyHours / 2}h</span><span>0h</span></div>
              <div className="weekly-chart-plot">
                <div className="weekly-chart-lines" aria-hidden="true"><i /><i /><i /></div>
                {profile.weeklyHours.map((hours, index) => (
                  <div className="weekly-bar-column" key={days[index]} title={`${days[index]}: ${hours} hours`}>
                    <span className="weekly-bar-value">{hours || "–"}</span>
                    <i className="weekly-bar" style={{ height: `${Math.max(hours ? 5 : 0, hours / maxWeeklyHours * 100)}%` }} />
                    <strong>{days[index]}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Card>

        </section>

        <section className="achievements"><h2>{t("Recent Achievements", "近期成就")}</h2><div className="achievement-row">{profile.achievements.map((achievement) => <Card as="article" className={achievement.unlocked ? "" : "locked"} key={achievement.title}><span>{achievement.icon}</span><div><strong>{achievement.title}</strong><small>{achievement.subtitle}</small></div></Card>)}</div></section>
      </main>
    </div>
  );
}
