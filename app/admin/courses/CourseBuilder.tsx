"use client";
/* eslint-disable @next/next/no-img-element -- local blob previews are not compatible with image optimization */

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../AdminShell";
import { getPendingAssetPreview, registerPendingAsset, removePendingAsset } from "../../lib/admin-upload-previews";
import {
  courseAdminData,
  createBlankCourse,
  type AdminCourse,
  type AdminCourseLesson,
  type AdminCourseModule,
  type CourseLevel,
  type CourseStatus,
  type CourseVisibility,
} from "../../lib/admin-courses";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function blankLesson(position: number): AdminCourseLesson {
  return { id: `lesson-${position}`, position, title: "", content: "", objectives: [], activity: { type: "guided-lab", prompt: "", completionType: "learner-confirmation" }, assessmentIds: [] };
}

function blankModule(position: number): AdminCourseModule {
  return { id: `module-${position}`, position, title: "", description: "", lessons: [blankLesson(1)] };
}

export function CourseBuilder({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [course, setCourse] = useState<AdminCourse>(() => createBlankCourse());
  const [loading, setLoading] = useState(Boolean(courseId));
  const [saving, setSaving] = useState<CourseStatus | null>(null);
  const [error, setError] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!courseId) return;
    courseAdminData.get(courseId).then((value) => {
      setCourse(value);
      setPhotoPreviews(Object.fromEntries(value.assets.map((asset) => [asset.id, getPendingAssetPreview(asset.previewKey ?? asset.id)]).filter((entry): entry is [string, string] => Boolean(entry[1]))));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the course.")).finally(() => setLoading(false));
  }, [courseId]);

  function updateMetadata<K extends keyof AdminCourse["metadata"]>(key: K, value: AdminCourse["metadata"][K]) {
    setCourse((current) => ({ ...current, metadata: { ...current.metadata, [key]: value } }));
  }

  function updateModule(moduleIndex: number, patch: Partial<AdminCourseModule>) {
    setCourse((current) => ({ ...current, modules: current.modules.map((module, index) => index === moduleIndex ? { ...module, ...patch } : module) }));
  }

  function updateLesson(moduleIndex: number, lessonIndex: number, patch: Partial<AdminCourseLesson>) {
    setCourse((current) => ({
      ...current,
      modules: current.modules.map((module, currentModuleIndex) => currentModuleIndex === moduleIndex
        ? { ...module, lessons: module.lessons.map((lesson, currentLessonIndex) => currentLessonIndex === lessonIndex ? { ...lesson, ...patch } : lesson) }
        : module),
    }));
  }

  function addModule() {
    setCourse((current) => ({ ...current, modules: [...current.modules, blankModule(current.modules.length + 1)] }));
  }

  function removeModule(moduleIndex: number) {
    setCourse((current) => ({ ...current, modules: current.modules.filter((_, index) => index !== moduleIndex) }));
  }

  function addLesson(moduleIndex: number) {
    setCourse((current) => ({ ...current, modules: current.modules.map((module, index) => index === moduleIndex ? { ...module, lessons: [...module.lessons, blankLesson(module.lessons.length + 1)] } : module) }));
  }

  function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const availableSlots = Math.max(0, 8 - course.assets.length);
    const acceptedFiles = files.slice(0, availableSlots).filter((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Photos must be JPEG, PNG, or WebP files.");
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Each photo must be 5 MB or smaller.");
        return false;
      }
      return true;
    });
    if (!availableSlots) {
      setError("A course can have up to 8 photos in this preview.");
      return;
    }
    if (!acceptedFiles.length) return;
    setError("");
    const timestamp = Date.now().toString(36);
    const newAssets = acceptedFiles.map((file, index) => {
      const id = `course-photo-${timestamp}-${index + 1}`;
      const previewUrl = registerPendingAsset(id, file);
      setPhotoPreviews((current) => ({ ...current, [id]: previewUrl }));
      return { id, type: "image", path: file.name, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), previewKey: id };
    });
    setCourse((current) => ({
      ...current,
      assets: [...current.assets, ...newAssets],
      welcome: { ...current.welcome, overviewAssetId: current.welcome.overviewAssetId ?? newAssets[0]?.id },
    }));
  }

  function updatePhotoAlt(assetId: string, alt: string) {
    setCourse((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === assetId ? { ...asset, alt } : asset) }));
  }

  function makeCoverPhoto(assetId: string) {
    setCourse((current) => ({ ...current, welcome: { ...current.welcome, overviewAssetId: assetId } }));
  }

  function removePhoto(assetId: string) {
    const target = course.assets.find((asset) => asset.id === assetId);
    removePendingAsset(target?.previewKey ?? assetId);
    setPhotoPreviews((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
    setCourse((current) => {
      const assets = current.assets.filter((asset) => asset.id !== assetId);
      return {
        ...current,
        assets,
        welcome: { ...current.welcome, overviewAssetId: current.welcome.overviewAssetId === assetId ? assets[0]?.id : current.welcome.overviewAssetId },
      };
    });
  }

  function removeLesson(moduleIndex: number, lessonIndex: number) {
    setCourse((current) => ({ ...current, modules: current.modules.map((module, index) => index === moduleIndex ? { ...module, lessons: module.lessons.filter((_, currentIndex) => currentIndex !== lessonIndex) } : module) }));
  }

  async function save(status: CourseStatus) {
    if (!formRef.current?.reportValidity()) return;
    setSaving(status);
    setError("");
    const nextCourse: AdminCourse = {
      ...course,
      id: course.id || course.slug || slugify(course.metadata.title),
      slug: course.slug || slugify(course.metadata.title),
      status,
      metadata: { ...course.metadata, shortTitle: course.metadata.shortTitle || course.metadata.title },
    };
    try {
      if (courseId) await courseAdminData.update(courseId, nextCourse);
      else await courseAdminData.create(nextCourse);
      router.push("/admin/courses");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the course.");
      setSaving(null);
    }
  }

  const totalLessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <AdminShell
      active="course-settings"
      title={courseId ? "Edit Course" : "New Course"}
      description={courseId ? "Update the course using the same structure as the local course manifests." : "Fill in each section to create a complete course structure."}
      actions={<Link className="admin-outline-button admin-header-cancel" href="/admin/courses">Cancel</Link>}
    >
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <div className="admin-builder-loading" role="status">Loading course builder…</div> : (
        <form className="admin-course-builder" ref={formRef} onSubmit={(event) => event.preventDefault()}>
          <div className="admin-builder-main">
            <nav className="admin-builder-steps" aria-label="Course builder sections"><span><b>1</b>Course</span><span><b>2</b>Welcome</span><span><b>3</b>Modules</span><span><b>4</b>Access</span></nav>

            <section className="admin-builder-section">
              <header><span>1</span><div><h2>Course information</h2><p>These fields map to the course manifest metadata.</p></div></header>
              <div className="admin-builder-fields">
                <label className="admin-builder-field wide"><span>Course title *</span><input value={course.metadata.title} onChange={(event) => { const title = event.target.value; updateMetadata("title", title); if (!courseId && (!course.slug || course.slug === slugify(course.metadata.title))) setCourse((current) => ({ ...current, slug: slugify(title) })); }} placeholder="Build an AI workflow with n8n" required /></label>
                <label className="admin-builder-field"><span>Short title *</span><input value={course.metadata.shortTitle} onChange={(event) => updateMetadata("shortTitle", event.target.value)} placeholder="AI Workflow" required /></label>
                <label className="admin-builder-field"><span>Course slug *</span><input value={course.slug} onChange={(event) => setCourse((current) => ({ ...current, slug: slugify(event.target.value) }))} placeholder="ai-workflow" required /></label>
                <label className="admin-builder-field"><span>Category *</span><input value={course.metadata.category} onChange={(event) => updateMetadata("category", event.target.value)} required /></label>
                <label className="admin-builder-field"><span>Difficulty</span><select value={course.metadata.level} onChange={(event) => updateMetadata("level", event.target.value as CourseLevel)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
                <label className="admin-builder-field"><span>Language</span><input value={course.metadata.language} onChange={(event) => updateMetadata("language", event.target.value)} placeholder="en" /></label>
                <label className="admin-builder-field wide"><span>Description *</span><textarea value={course.metadata.description} onChange={(event) => updateMetadata("description", event.target.value)} rows={4} placeholder="What will learners build and why does it matter?" required /></label>
                <label className="admin-builder-field wide"><span>Tags</span><input value={course.metadata.tags.join(", ")} onChange={(event) => updateMetadata("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="n8n, Docker, Gemini, automation" /><small>Separate tags with commas.</small></label>
                <div className="admin-photo-uploader">
                  <div className="admin-photo-heading"><div><strong>Course photos</strong><span>Add a cover image and supporting course visuals.</span></div><label className="admin-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadPhotos} />+ Upload photos</label></div>
                  <p>JPEG, PNG, or WebP · up to 5 MB each · 8 photos maximum. Files are temporary previews until object storage is connected.</p>
                  {course.assets.length > 0 && <div className="admin-photo-grid">
                    {course.assets.map((asset) => {
                      const previewUrl = photoPreviews[asset.id];
                      const isCover = course.welcome.overviewAssetId === asset.id;
                      return <article className="admin-photo-card" key={asset.id}>
                        <div className="admin-photo-preview">{previewUrl ? <img src={previewUrl} alt={asset.alt} /> : <span><b>Image</b><small>{asset.path}</small></span>}{isCover && <em>Cover</em>}</div>
                        <label><span>Alternative text</span><input value={asset.alt} onChange={(event) => updatePhotoAlt(asset.id, event.target.value)} placeholder="Describe this image" /></label>
                        <div>{!isCover && <button type="button" onClick={() => makeCoverPhoto(asset.id)}>Set as cover</button>}<button className="remove" type="button" onClick={() => removePhoto(asset.id)}>Remove</button></div>
                      </article>;
                    })}
                  </div>}
                </div>
              </div>
            </section>

            <section className="admin-builder-section">
              <header><span>2</span><div><h2>Learner welcome</h2><p>Set expectations before the learner starts the first module.</p></div></header>
              <div className="admin-builder-fields">
                <label className="admin-builder-field wide"><span>Welcome heading *</span><input value={course.welcome.overview.heading} onChange={(event) => setCourse((current) => ({ ...current, welcome: { ...current.welcome, overview: { ...current.welcome.overview, heading: event.target.value } } }))} placeholder="Build your first AI automation" required /></label>
                <label className="admin-builder-field wide"><span>Overview paragraphs</span><textarea value={course.welcome.overview.paragraphs.join("\n")} onChange={(event) => setCourse((current) => ({ ...current, welcome: { ...current.welcome, overview: { ...current.welcome.overview, paragraphs: lines(event.target.value) } } }))} rows={5} placeholder={"One paragraph per line\nExplain the tools and finished project."} /><small>One paragraph per line.</small></label>
                <label className="admin-builder-field wide"><span>Learning outcomes *</span><textarea value={course.outcomes.join("\n")} onChange={(event) => setCourse((current) => ({ ...current, outcomes: lines(event.target.value) }))} rows={5} placeholder={"Deploy the required tools.\nBuild and test the workflow.\nPublish the finished automation."} required /><small>One outcome per line.</small></label>
                <label className="admin-builder-field wide"><span>Requirements</span><textarea value={course.requirements.join("\n")} onChange={(event) => setCourse((current) => ({ ...current, requirements: lines(event.target.value) }))} rows={4} placeholder={"Ubuntu environment\nInternet access\nRequired service accounts"} /><small>One requirement per line.</small></label>
                <label className="admin-builder-field wide"><span>Final outcome *</span><textarea value={course.welcome.finalOutcome.description} onChange={(event) => setCourse((current) => ({ ...current, welcome: { ...current.welcome, finalOutcome: { ...current.welcome.finalOutcome, description: event.target.value } } }))} rows={3} placeholder="Describe what the learner will have built at the end." required /></label>
              </div>
            </section>

            <section className="admin-builder-section admin-modules-section">
              <header><span>3</span><div><h2>Modules and lessons</h2><p>Build the course outline, then fill in each lesson.</p></div></header>
              <div className="admin-modules-list">
                {course.modules.map((module, moduleIndex) => (
                  <article className="admin-module-builder" key={`${module.id}-${moduleIndex}`}>
                    <header><div><span>Module {moduleIndex + 1}</span><strong>{module.title || "Untitled module"}</strong></div>{course.modules.length > 1 && <button type="button" onClick={() => removeModule(moduleIndex)}>Remove module</button>}</header>
                    <div className="admin-builder-fields compact">
                      <label className="admin-builder-field"><span>Module title *</span><input value={module.title} onChange={(event) => updateModule(moduleIndex, { title: event.target.value, id: module.id.startsWith("module-") ? slugify(event.target.value) || module.id : module.id })} required /></label>
                      <label className="admin-builder-field"><span>Module ID</span><input value={module.id} onChange={(event) => updateModule(moduleIndex, { id: slugify(event.target.value) })} required /></label>
                      <label className="admin-builder-field wide"><span>Module description *</span><textarea value={module.description} onChange={(event) => updateModule(moduleIndex, { description: event.target.value })} rows={2} required /></label>
                    </div>
                    <div className="admin-lesson-builders">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <details className="admin-lesson-builder" open={moduleIndex === 0 && lessonIndex === 0} key={`${lesson.id}-${lessonIndex}`}>
                          <summary><span><b>{moduleIndex + 1}.{lessonIndex + 1}</b>{lesson.title || "Untitled lesson"}</span><i>{lesson.content.length ? `${lesson.content.length.toLocaleString()} characters` : "Fill in lesson"}</i></summary>
                          <div className="admin-builder-fields compact">
                            <label className="admin-builder-field"><span>Lesson title *</span><input value={lesson.title} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { title: event.target.value, id: lesson.id.startsWith("lesson-") ? slugify(event.target.value) || lesson.id : lesson.id })} required /></label>
                            <label className="admin-builder-field"><span>Lesson ID</span><input value={lesson.id} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { id: slugify(event.target.value) })} required /></label>
                            <label className="admin-builder-field wide"><span>Learning objectives *</span><textarea value={lesson.objectives.join("\n")} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { objectives: lines(event.target.value) })} rows={3} placeholder="One objective per line" required /></label>
                            <label className="admin-builder-field wide"><span>Lesson content *</span><textarea className="admin-course-content-input" value={lesson.content} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { content: event.target.value })} rows={12} placeholder="Write the lesson in Markdown..." required /></label>
                            <label className="admin-builder-field"><span>Activity type</span><input value={lesson.activity.type} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { activity: { ...lesson.activity, type: event.target.value } })} placeholder="guided-lab" /></label>
                            <label className="admin-builder-field"><span>Completion type</span><input value={lesson.activity.completionType} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { activity: { ...lesson.activity, completionType: event.target.value } })} placeholder="learner-confirmation" /></label>
                            <label className="admin-builder-field wide"><span>Activity prompt *</span><textarea value={lesson.activity.prompt} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { activity: { ...lesson.activity, prompt: event.target.value } })} rows={3} required /></label>
                            <label className="admin-builder-field wide"><span>Assessment IDs</span><input value={lesson.assessmentIds.join(", ")} onChange={(event) => updateLesson(moduleIndex, lessonIndex, { assessmentIds: event.target.value.split(",").map((id) => id.trim()).filter(Boolean) })} placeholder="check-first-step" /><small>Existing assessment definitions are preserved with the course.</small></label>
                            {module.lessons.length > 1 && <button className="admin-builder-remove" type="button" onClick={() => removeLesson(moduleIndex, lessonIndex)}>Remove this lesson</button>}
                          </div>
                        </details>
                      ))}
                      <button className="admin-add-row" type="button" onClick={() => addLesson(moduleIndex)}>+ Add lesson to module {moduleIndex + 1}</button>
                    </div>
                  </article>
                ))}
                <button className="admin-add-module" type="button" onClick={addModule}>+ Add another module</button>
              </div>
            </section>
          </div>

          <aside className="admin-builder-publish">
            <span className="course-chip">◇ &nbsp; Course access</span>
            <h2>{course.metadata.shortTitle || "New course"}</h2>
            <p>Choose who can find this course, then save a draft or publish it.</p>
            <label><span>Visibility</span><select value={course.visibility} onChange={(event) => setCourse((current) => ({ ...current, visibility: event.target.value as CourseVisibility }))}><option value="public">Public — shown in catalog</option><option value="private">Private — invited learners</option><option value="hidden">Hidden — admin only</option></select></label>
            <dl><div><dt>Modules</dt><dd>{course.modules.length}</dd></div><div><dt>Lessons</dt><dd>{totalLessons}</dd></div><div><dt>Assessments</dt><dd>{course.assessments.length}</dd></div><div><dt>Version</dt><dd>{course.version}</dd></div></dl>
            <button className="primary-button" type="button" onClick={() => void save("published")} disabled={saving !== null}>{saving === "published" ? "Publishing…" : courseId ? "Update and publish" : "Publish course"}</button>
            <button className="admin-outline-button" type="button" onClick={() => void save("draft")} disabled={saving !== null}>{saving === "draft" ? "Saving…" : "Save as draft"}</button>
            <small>This version saves locally. Database publishing will be connected in the next phase.</small>
          </aside>
        </form>
      )}
    </AdminShell>
  );
}
