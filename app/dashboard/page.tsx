"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useMockProfile } from "../hooks/useMockProfile";
import { activateCourse, courseCatalog } from "../lib/courses";

export default function DashboardPage() {
  const { profile, loading, recordPractice } = useMockProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [highlightUnread, setHighlightUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");

  useEffect(() => {
    if (!searchFeedback) return;
    const timer = window.setTimeout(() => setSearchFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [searchFeedback]);

  const firstName = profile.name.split(" ")[0];
  const isAllClear = profile.accountType === "all-clear";
  const currentCatalogCourse = profile.accountType === "beginner" ? courseCatalog[2] : courseCatalog[0];
  const practiceHours = Math.round(profile.stats.practiceMinutes / 60);
  const stats = [
    { icon: "streak", value: `${profile.stats.streakDays} Days`, label: "Current Streak", tone: "amber" },
    { icon: "practice", value: `${practiceHours}h`, label: "Practice Time", tone: "neutral" },
    { icon: "skills", value: String(profile.stats.skillsMastered), label: "Skills Mastered", tone: "peach" },
  ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchFeedback("Enter a course or skill to search.");
      return;
    }

    const searchableItems = [profile.course.title, profile.course.category, profile.course.module, ...profile.skills.map((skill) => skill.name)];
    const match = searchableItems.find((item) => item.toLowerCase().includes(query.toLowerCase()));
    setSearchFeedback(match ? `Found: ${match}` : `No results for “${query}”.`);
  }

  function toggleNotifications() {
    if (notificationsOpen) {
      setNotificationsOpen(false);
      setHighlightUnread(false);
      return;
    }

    setHighlightUnread(!notificationsRead && profile.notifications.length > 0);
    setNotificationsRead(true);
    setNotificationsOpen(true);
  }

  function closeNotifications() {
    setNotificationsOpen(false);
    setHighlightUnread(false);
  }

  return (
    <div className="app-shell dashboard-shell">
      <Sidebar active="dashboard" />
      <main className={`dashboard page-content ${loading ? "data-loading" : ""}`}>
        <header className="dashboard-toolbar">
          <form className="search-box" role="search" onSubmit={submitSearch}>
            <input aria-label="Search courses and skills" placeholder="Search..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchFeedback(""); }} />
            <button className="search-button" type="submit" aria-label="Search"><span className="search-glyph" aria-hidden="true" /></button>
            {searchFeedback && <output className="search-feedback" aria-live="polite">{searchFeedback}</output>}
          </form>
          <div className="notification-wrap">
            <button className="notification-button" aria-label={notificationsRead ? "Notifications" : "Notifications, new items"} aria-expanded={notificationsOpen} onClick={toggleNotifications}><span className="bell-icon" aria-hidden="true" />{!notificationsRead && <span className="notification-dot" />}</button>
            {notificationsOpen && <section className="notification-popover"><header><strong>Notifications</strong><button onClick={closeNotifications} aria-label="Close notifications">×</button></header>{profile.notifications.map((notification) => <p className={highlightUnread ? "unread" : ""} key={notification}>{highlightUnread && <span className="new-label">New</span>}{notification}</p>)}</section>}
          </div>
        </header>
        <section className="welcome-copy">
          <h1>{isAllClear ? `Hi, ${firstName}! You're all clear.` : `Hi, ${firstName}! You're making great progress.`}</h1>
          <p>{isAllClear ? "You have completed every available lesson. Keep your skills fresh or explore what is next." : "Pick up where you left off or explore new concepts."}</p>
        </section>
        <section className="dashboard-grid" aria-label="Current learning overview">
          <article className="course-card">
            <span className="course-chip">◇ &nbsp; {profile.course.category}</span>
            <h2>{profile.course.title}</h2>
            <p>{profile.course.module}</p>
            <div className="course-progress-label"><strong>{profile.course.progress}% Completed</strong></div>
            <div className="progress-track"><span style={{ width: `${profile.course.progress}%` }} /></div>
            <Link className="primary-button resume-button" href={isAllClear ? "/courses" : "/workspace"} onClick={() => { if (!isAllClear) { activateCourse(currentCatalogCourse.id); recordPractice(15); } }}>{isAllClear ? "Explore Courses" : "Resume Session"} <span>→</span></Link>
          </article>
          <div className="stat-stack">
            {stats.map((stat) => <article className="stat-card" key={stat.label}><span className={`stat-icon ${stat.tone}`} aria-hidden="true"><i className={`stat-glyph ${stat.icon}`} /></span><div><strong>{stat.value}</strong><span>{stat.label}</span></div></article>)}
          </div>
        </section>
        <section className="activity-section">
          <header><div><span className="eyebrow">YOUR MOMENTUM</span><h2>Recent activity</h2></div><Link href="/analysis">View progress →</Link></header>
          <div className="activity-list">{profile.recentActivity.slice(0, 3).map((activity) => <article key={activity.id}><span className={`activity-mark ${activity.kind}`}>{activity.kind === "lesson" ? "✓" : activity.kind === "practice" ? "⌁" : "★"}</span><div><strong>{activity.title}</strong><small>{activity.detail}</small></div><time>{activity.occurredAt}</time></article>)}</div>
        </section>
      </main>
    </div>
  );
}
