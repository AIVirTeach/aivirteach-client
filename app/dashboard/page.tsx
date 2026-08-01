import Link from "next/link";
import { Sidebar } from "../components/Sidebar";

const stats = [
  { icon: "●", value: "5 Days", label: "Current Streak", tone: "amber" },
  { icon: "◷", value: "12h", label: "Practice Time", tone: "neutral" },
  { icon: "◆", value: "8", label: "Skills Mastered", tone: "peach" },
];

export default function DashboardPage() {
  return (
    <div className="app-shell">
      <Sidebar active="dashboard" />
      <main className="dashboard page-content">
        <header className="dashboard-toolbar">
          <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search" placeholder="Search..." /></label>
          <button className="notification-button" aria-label="Notifications">♟<span /></button>
        </header>
        <section className="welcome-copy">
          <p className="eyebrow">YOUR LEARNING SPACE</p>
          <h1>Hi, Alex! You&apos;re making great progress.</h1>
          <p>Pick up where you left off or explore new concepts.</p>
        </section>
        <section className="dashboard-grid" aria-label="Current learning overview">
          <article className="course-card">
            <span className="course-chip">▣ &nbsp; Data Science</span>
            <h2>Python for Data Science</h2>
            <p>Module 4: Advanced Pandas DataFrames</p>
            <div className="course-progress-label"><span>Course progress</span><strong>65% Completed</strong></div>
            <div className="progress-track"><span style={{ width: "65%" }} /></div>
            <Link className="primary-button resume-button" href="/workspace">Resume Session <span>→</span></Link>
          </article>
          <div className="stat-stack">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <span className={`stat-icon ${stat.tone}`}>{stat.icon}</span>
                <div><strong>{stat.value}</strong><span>{stat.label}</span></div>
              </article>
            ))}
          </div>
        </section>
        <section className="next-up">
          <div><span className="eyebrow">NEXT UP</span><h2>Data cleaning patterns</h2><p>Continue your guided path after completing the current task.</p></div>
          <span className="next-number">04</span>
        </section>
      </main>
    </div>
  );
}
