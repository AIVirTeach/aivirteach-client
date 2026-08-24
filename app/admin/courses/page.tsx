"use client";
/* eslint-disable @next/next/no-img-element -- local blob previews are not compatible with image optimization */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../AdminShell";
import { courseAdminData, type AdminCourse, type CourseVisibility } from "../../lib/admin-courses";
import { getPendingAssetPreview } from "../../lib/admin-upload-previews";

type VisibilityFilter = "all" | CourseVisibility;

function lessonCount(course: AdminCourse) {
  return course.modules.reduce((total, module) => total + module.lessons.length, 0);
}

export default function CourseSettingsPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisibilityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    courseAdminData.list().then(setCourses).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load course data.")).finally(() => setLoading(false));
  }, []);

  const visibleCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesFilter = filter === "all" || course.visibility === filter;
      const matchesQuery = !normalizedQuery || [course.metadata.title, course.metadata.shortTitle, course.metadata.category, ...course.metadata.tags].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [courses, filter, query]);

  async function changeVisibility(course: AdminCourse, visibility: CourseVisibility) {
    setPendingId(course.id);
    setError("");
    try {
      const updated = await courseAdminData.setVisibility(course.id, visibility);
      setCourses((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${course.metadata.shortTitle} is now ${visibility}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update course visibility.");
    } finally {
      setPendingId(null);
    }
  }

  async function removeCourse(course: AdminCourse) {
    if (!window.confirm(`Remove “${course.metadata.title}” from Course Settings? This only changes the local admin preview.`)) return;
    setPendingId(course.id);
    setError("");
    try {
      await courseAdminData.remove(course.id);
      setCourses((items) => items.filter((item) => item.id !== course.id));
      setNotice(`${course.metadata.shortTitle} was removed from the local preview.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the course.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AdminShell
      active="course-settings"
      title="Course Settings"
      description="Add, edit, remove, and control access to every course in the catalog."
      actions={<><Link className="admin-outline-button admin-header-button" href="/admin/courses/upload">Upload Course</Link><Link className="primary-button admin-header-button" href="/admin/courses/new">+ New Course</Link></>}
    >
      <div className="admin-source-note"><span aria-hidden="true">i</span><p><strong>Local course source</strong> These courses were synced from <code>course data/catalog.json</code> and their course manifests. Changes remain in this browser until database integration.</p></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="admin-course-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></p>}
      <section className="admin-course-tools" aria-label="Course filters">
        <label className="search-box admin-course-search">
          <input aria-label="Search courses" placeholder="Search courses..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <span className="search-button" aria-hidden="true"><span className="search-glyph" /></span>
        </label>
        <div className="admin-access-filters" role="group" aria-label="Filter by course visibility">
          {(["all", "public", "private", "hidden"] as const).map((value) => <button className={filter === value ? "active" : ""} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{value}</button>)}
        </div>
      </section>

      <section className={`admin-course-list ${loading ? "data-loading" : ""}`} aria-label="Courses">
        {visibleCourses.map((course, index) => (
          <article className="admin-course-row" key={course.id}>
            {(() => {
              const coverAsset = course.assets.find((asset) => asset.id === course.welcome.overviewAssetId) ?? course.assets[0];
              const coverPreview = coverAsset ? getPendingAssetPreview(coverAsset.previewKey ?? coverAsset.id) : undefined;
              return coverPreview
                ? <div className="admin-course-cover"><img src={coverPreview} alt={coverAsset.alt} /></div>
                : <div className={`catalog-art ${index % 2 ? "indigo" : "blue"}`} aria-hidden="true"><span /></div>;
            })()}
            <div className="admin-course-copy">
              <div className="admin-course-heading">
                <span className={`admin-visibility-badge ${course.visibility}`}>{course.visibility}</span>
                <span className={`admin-status-badge ${course.status}`}>{course.status}</span>
                <h2>{course.metadata.title}</h2>
                <p>{course.metadata.description}</p>
                <div className="admin-course-meta"><span>{course.metadata.category}</span><span>{course.metadata.level}</span><span>{course.modules.length} modules</span><span>{lessonCount(course)} lessons</span></div>
              </div>
              <div className="admin-course-controls">
                <label><span>Course access</span><select value={course.visibility} onChange={(event) => void changeVisibility(course, event.target.value as CourseVisibility)} disabled={pendingId === course.id} aria-label={`Visibility for ${course.metadata.title}`}><option value="public">Public</option><option value="private">Private</option><option value="hidden">Hidden</option></select></label>
                <div><Link className="admin-outline-button" href={`/admin/courses/${encodeURIComponent(course.id)}/edit`}>Edit course</Link><button className="admin-remove-button" type="button" onClick={() => void removeCourse(course)} disabled={pendingId === course.id}>{pendingId === course.id ? "Updating…" : "Remove"}</button></div>
              </div>
            </div>
          </article>
        ))}
        {!loading && visibleCourses.length === 0 && <div className="admin-course-empty"><span aria-hidden="true">+</span><h2>No courses found</h2><p>{courses.length ? "Try another search or access filter." : "Use the guided builder to create your first course."}</p><Link className="primary-button admin-header-button" href="/admin/courses/new">+ New Course</Link></div>}
        {loading && <div className="admin-course-empty"><p>Loading local course data…</p></div>}
      </section>
    </AdminShell>
  );
}
