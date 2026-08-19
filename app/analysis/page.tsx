"use client";

import Link from "next/link";
import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useLearnerProfile } from "../hooks/useLearnerProfile";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalysisPage() {
  const [range, setRange] = useState<"30" | "all">("30");
  const [insightExpanded, setInsightExpanded] = useState(false);
  const { profile } = useLearnerProfile();
  const practiceMinutes = range === "all" ? profile.stats.practiceMinutes : profile.stats.last30PracticeMinutes;
  const practiceHours = Math.round(practiceMinutes / 6) / 10;
  const tasksCompleted = range === "all" ? profile.stats.tasksCompleted : profile.stats.last30TasksCompleted;
  const maxWeeklyHours = Math.max(4, Math.ceil(Math.max(...profile.weeklyHours)));
  const metrics = [
    { icon: "◷", label: range === "all" ? "Total Practice Time" : "Practice Time", value: `${practiceHours}h`, delta: `↗ ${profile.analytics.practiceTrend}%`, tone: "teal" },
    { icon: "✓", label: "Tasks Completed", value: String(tasksCompleted), delta: `↗ ${profile.analytics.taskTrend}%`, tone: "amber" },
    { icon: "◎", label: "Weekly Goal", value: `${profile.stats.weeklyGoalPercent}%`, delta: profile.stats.weeklyGoalPercent === 100 ? "Complete" : `↗ ${profile.analytics.goalTrend}%`, tone: "sand" },
  ];

  return (
    <div className="app-shell">
      <Sidebar active="analysis" />
      <main className="analysis page-content">
        <header className="analysis-head">
          <div><h1>Learning Analytics</h1><p>Track your mastery and learning progression.</p></div>
          <div className="analysis-head-actions">
            <Link className="analysis-v2-link" href="/analysis/v2">View v2</Link>
            <div className="range-toggle" aria-label="Analytics date range">
              <button className={range === "30" ? "active" : ""} onClick={() => setRange("30")}>Last 30 Days</button>
              <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>All Time</button>
            </div>
          </div>
        </header>

        <section className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top"><span className={`metric-icon ${metric.tone}`}>{metric.icon}</span><span className="delta">{metric.delta}</span></div>
              <span className="metric-label">{metric.label}</span><strong>{metric.value}</strong>
              {metric.label === "Weekly Goal" && <div className="progress-track slim"><span style={{ width: `${profile.stats.weeklyGoalPercent}%` }} /></div>}
            </article>
          ))}
        </section>

        <section className="analytics-layout">
          <article className="chart-card">
            <h2>Weekly Learning Hours</h2>
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
          </article>

          <aside className="analytics-side">
            <article className="insight-card">
              <div className="insight-title"><span>●</span><h2>AI Insight</h2></div>
              <p>&ldquo;{profile.analytics.insight}&rdquo;{insightExpanded && <small className="insight-detail">{profile.analytics.insightDetail}</small>}</p>
              <button type="button" onClick={() => setInsightExpanded((value) => !value)}>{insightExpanded ? "Hide detail" : "View detail"} &nbsp;→</button>
            </article>
            <article className="mastery-card"><h2>Skill Mastery</h2>{profile.skills.map((skill, index) => <div className="skill-row" key={skill.name}><div><span>{skill.name}</span><strong>{skill.value}%</strong></div><div className="progress-track slim"><span className={index === 1 ? "amber" : index === 2 ? "sand" : "teal"} style={{ width: `${skill.value}%` }} /></div></div>)}</article>
          </aside>
        </section>

        <section className="achievements"><h2>Recent Achievements</h2><div className="achievement-row">{profile.achievements.map((achievement) => <article className={achievement.unlocked ? "" : "locked"} key={achievement.title}><span>{achievement.icon}</span><div><strong>{achievement.title}</strong><small>{achievement.subtitle}</small></div></article>)}</div></section>
      </main>
    </div>
  );
}
