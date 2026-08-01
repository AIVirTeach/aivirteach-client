"use client";

import { useState } from "react";
import { Sidebar } from "../components/Sidebar";

const metrics = [
  { icon: "◷", label: "Total Practice Time", value: "45h", delta: "↗ 12%", tone: "teal" },
  { icon: "✓", label: "Tasks Completed", value: "120", delta: "↗ 8%", tone: "amber" },
  { icon: "◎", label: "Command Accuracy", value: "92%", delta: "↗ 3%", tone: "sand" },
];

const skills = [
  { label: "Conceptual", value: 85, tone: "teal" },
  { label: "Practical", value: 70, tone: "amber" },
  { label: "Problem Solving", value: 92, tone: "sand" },
];

export default function AnalysisPage() {
  const [range, setRange] = useState<"30" | "all">("30");
  return (
    <div className="app-shell">
      <Sidebar active="analysis" />
      <main className="analysis page-content">
        <header className="analysis-head">
          <div><p className="eyebrow">PERSONAL INSIGHTS</p><h1>Learning Analytics</h1><p>Track your mastery and cognitive progression.</p></div>
          <div className="range-toggle" aria-label="Analytics date range">
            <button className={range === "30" ? "active" : ""} onClick={() => setRange("30")}>Last 30 Days</button>
            <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>All Time</button>
          </div>
        </header>
        <section className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top"><span className={`metric-icon ${metric.tone}`}>{metric.icon}</span><span className="delta">{metric.delta}</span></div>
              <span className="metric-label">{metric.label}</span><strong>{metric.value}</strong>
              {metric.label === "Command Accuracy" && <div className="progress-track slim"><span style={{ width: "92%" }} /></div>}
            </article>
          ))}
        </section>
        <section className="analytics-layout">
          <article className="chart-card">
            <h2>Weekly Learning Hours</h2>
            <div className="line-chart" aria-label="Weekly learning hours: week 1 eight hours, week 2 twelve hours, week 3 ten hours, week 4 fifteen hours">
              <div className="chart-grid"><span>15</span><span>10</span><span>5</span><span>0</span></div>
              <div className="chart-plot">
                <span className="chart-area" />
                <i className="segment s1" /><i className="segment s2" /><i className="segment s3" />
                <b className="point p1" /><b className="point p2" /><b className="point p3" /><b className="point p4" />
              </div>
              <div className="chart-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div>
            </div>
          </article>
          <aside className="analytics-side">
            <article className="insight-card"><div className="insight-title"><span>●</span><h2>AI Insight</h2></div><p>&ldquo;Your command accuracy has improved by 15% this week. Great job focusing on the terminal tasks!&rdquo;</p><button type="button">View detail &nbsp;→</button></article>
            <article className="mastery-card"><h2>Skill Mastery</h2>{skills.map((skill) => <div className="skill-row" key={skill.label}><div><span>{skill.label}</span><strong>{skill.value}%</strong></div><div className="progress-track slim"><span className={skill.tone} style={{ width: `${skill.value}%` }} /></div></div>)}</article>
          </aside>
        </section>
        <section className="achievements"><h2>Recent Achievements</h2><div className="achievement-row"><article><span>⌁</span><div><strong>Terminal Navigator</strong><small>Completed 20 command tasks</small></div></article><article><span>✓</span><div><strong>Data Wrangler</strong><small>Mastered Pandas filtering</small></div></article><article><span>★</span><div><strong>Five Day Focus</strong><small>Maintained your learning streak</small></div></article></div></section>
      </main>
    </div>
  );
}
