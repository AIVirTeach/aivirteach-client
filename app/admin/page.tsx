"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import { courseAdminData, type CourseAdminStats } from "../lib/admin-courses";

const emptyStats: CourseAdminStats = { totalLearners: 0, lessonCompletions: 0, totalCourses: 0, publicCourses: 0, privateCourses: 0, hiddenCourses: 0, totalLessons: 0, draftCourses: 0 };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<CourseAdminStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    courseAdminData.stats().then(setStats).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load website analytics.")).finally(() => setLoading(false));
  }, []);

  const publishedPercent = stats.totalCourses
    ? Math.round((stats.publicCourses / stats.totalCourses) * 100)
    : 0;
  const cards = [
    { icon: "practice", value: stats.totalLearners.toLocaleString(), label: "Total Learners", tone: "neutral" },
    { icon: "skills", value: String(stats.totalLessons), label: "Course Lessons", tone: "peach" },
    { icon: "streak", value: String(stats.publicCourses), label: "Public Courses", tone: "amber" },
  ];

  return (
    <AdminShell
      active="analytics"
      title="Website Analytics"
      description="See how learners are using AIVirTeach and keep an eye on published content."
      actions={<Link className="primary-button admin-header-button" href="/admin/courses/new">+ New Course</Link>}
    >
      {error && <p className="auth-error" role="alert">{error}</p>}
      <section className={`dashboard-grid admin-analytics-grid ${loading ? "data-loading" : ""}`} aria-label="Website analytics overview">
        <article className="course-card admin-engagement-card">
          <span className="course-chip">◇ &nbsp; Learner engagement</span>
          <h2>{loading ? "—" : stats.lessonCompletions.toLocaleString()}</h2>
          <p>Lesson completions across the learning platform</p>
          <div className="course-progress-label"><strong>{publishedPercent}% of course content is published</strong></div>
          <div className="progress-track"><span style={{ width: `${publishedPercent}%` }} /></div>
          <Link className="primary-button resume-button" href="/admin/courses">Open Course Settings <span>→</span></Link>
        </article>
        <div className="stat-stack">
          {cards.map((card) => <article className="stat-card" key={card.label}><span className={`stat-icon ${card.tone}`} aria-hidden="true"><i className={`stat-glyph ${card.icon}`} /></span><div><strong>{loading ? "—" : card.value}</strong><span>{card.label}</span></div></article>)}
        </div>
      </section>
      <section className="admin-analytics-notes" aria-label="Analytics notes">
        <article><span>01</span><div><strong>Content overview</strong><p>{stats.totalCourses} courses and {stats.totalLessons} lessons were loaded from the local course data.</p></div></article>
        <article><span>02</span><div><strong>Course management</strong><p>Control which courses are public, private, or hidden from Course Settings.</p></div></article>
        <article><span>03</span><div><strong>Backend integration</strong><p>Learner trends will update from live server analytics when the admin API is connected.</p></div></article>
      </section>
    </AdminShell>
  );
}
