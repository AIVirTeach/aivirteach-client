"use client";

import Link from "next/link";
import { type ChangeEvent, type DragEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../AdminShell";
import {
  courseAdminData,
  type AdminAssessment,
  type AdminCourse,
  type AdminCourseLesson,
  type AdminCourseModule,
} from "../../../lib/admin-courses";
import { registerPendingAsset, removePendingAsset } from "../../../lib/admin-upload-previews";

type ManifestLesson = Omit<AdminCourseLesson, "content"> & { sourceRange: { startLine: number; endLine: number } };
type ManifestModule = Omit<AdminCourseModule, "lessons"> & { lessons: ManifestLesson[] };
type CourseManifest = Omit<AdminCourse, "visibility" | "welcome" | "modules" | "assessments"> & {
  welcome: { path: string };
  modules: ManifestModule[];
  assessments: { path: string; delivery: string };
};
type AssessmentDocument = { schemaVersion: number; courseId: string; assessments: AdminAssessment[] };
type PreparedUpload = {
  files: File[];
  manifest: CourseManifest;
  welcome: AdminCourse["welcome"];
  assessments: AssessmentDocument;
  sourceText: string;
  assetFiles: Map<string, File>;
};

function normalizedFilePath(file: File) {
  return (file.webkitRelativePath || file.name).replace(/\\/g, "/").toLowerCase();
}

function findFile(files: File[], requestedPath: string) {
  const normalizedRequest = requestedPath.replace(/\\/g, "/").toLowerCase();
  const basename = normalizedRequest.split("/").pop();
  return files.find((file) => {
    const path = normalizedFilePath(file);
    return path === normalizedRequest || path.endsWith(`/${normalizedRequest}`) || file.name.toLowerCase() === basename;
  });
}

async function readJson<T>(file: File, label: string): Promise<T> {
  try {
    return JSON.parse(await file.text()) as T;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

async function prepareUpload(files: File[]): Promise<PreparedUpload> {
  const courseFile = findFile(files, "course.json");
  if (!courseFile) throw new Error("course.json is required.");
  const manifest = await readJson<CourseManifest>(courseFile, "course.json");
  if (!manifest.id || !manifest.slug || !manifest.metadata?.title || !Array.isArray(manifest.modules)) throw new Error("course.json is missing required course metadata or modules.");
  if (!manifest.welcome?.path) throw new Error("course.json must reference welcome.json.");
  if (!manifest.assessments?.path) throw new Error("course.json must reference assessments.json.");
  if (!manifest.source?.path) throw new Error("course.json must reference the course Markdown source.");

  const welcomeFile = findFile(files, manifest.welcome.path);
  const assessmentFile = findFile(files, manifest.assessments.path);
  const sourceFile = findFile(files, manifest.source.path);
  if (!welcomeFile) throw new Error(`${manifest.welcome.path} is required.`);
  if (!assessmentFile) throw new Error(`${manifest.assessments.path} is required.`);
  if (!sourceFile) throw new Error(`${manifest.source.path} is required because the lesson source ranges depend on it.`);

  const welcome = await readJson<AdminCourse["welcome"]>(welcomeFile, manifest.welcome.path);
  const assessments = await readJson<AssessmentDocument>(assessmentFile, manifest.assessments.path);
  if (welcome.courseId !== manifest.id) throw new Error("welcome.json courseId does not match course.json.");
  if (assessments.courseId !== manifest.id) throw new Error("assessments.json courseId does not match course.json.");

  const assetFiles = new Map<string, File>();
  const missingAssets: string[] = [];
  for (const asset of manifest.assets ?? []) {
    const file = findFile(files, asset.path);
    if (file) assetFiles.set(asset.id, file);
    else missingAssets.push(asset.path);
  }
  if (missingAssets.length) throw new Error(`Missing referenced assets: ${missingAssets.join(", ")}.`);

  const sourceText = await sourceFile.text();
  const sourceLineCount = sourceText.split(/\r?\n/).length;
  for (const courseModule of manifest.modules) {
    if (!courseModule.id || !courseModule.title || !Array.isArray(courseModule.lessons)) throw new Error("Every module needs an id, title, and lessons array.");
    for (const lesson of courseModule.lessons) {
      if (!lesson.id || !lesson.title || !lesson.sourceRange) throw new Error(`A lesson in ${courseModule.title} is missing its id, title, or sourceRange.`);
      if (lesson.sourceRange.startLine < 1 || lesson.sourceRange.endLine > sourceLineCount || lesson.sourceRange.startLine > lesson.sourceRange.endLine) throw new Error(`The source range for “${lesson.title}” is outside the uploaded Markdown file.`);
    }
  }
  return { files, manifest, welcome, assessments, sourceText, assetFiles };
}

function buildPrivateDraft(prepared: PreparedUpload) {
  const { manifest, welcome, assessments, sourceText, assetFiles } = prepared;
  const sourceLines = sourceText.split(/\r?\n/);
  const uploadKey = `${manifest.id}-${Date.now().toString(36)}`;
  const registeredPreviewKeys: string[] = [];
  const assets = (manifest.assets ?? []).map((asset) => {
    const file = assetFiles.get(asset.id)!;
    const previewKey = `${uploadKey}-${asset.id}`;
    if (file.type.startsWith("image/")) {
      registerPendingAsset(previewKey, file);
      registeredPreviewKeys.push(previewKey);
    }
    return { ...asset, previewKey };
  });
  const course: AdminCourse = {
    ...manifest,
    status: "draft",
    visibility: "private",
    assets,
    welcome,
    modules: manifest.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        content: sourceLines.slice(lesson.sourceRange.startLine - 1, lesson.sourceRange.endLine).join("\n").trim(),
      })),
    })),
    assessments: assessments.assessments,
  };
  return { course, registeredPreviewKeys };
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CourseUpload() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function selectFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    setPrepared(null);
    setError("");
    if (!nextFiles.length) return;
    setValidating(true);
    try {
      setPrepared(await prepareUpload(nextFiles));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not validate the course package.");
    } finally {
      setValidating(false);
    }
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    void selectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function dropFiles(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void selectFiles(Array.from(event.dataTransfer.files));
  }

  async function importCourse() {
    if (!prepared) return;
    setImporting(true);
    setError("");
    const { course, registeredPreviewKeys } = buildPrivateDraft(prepared);
    try {
      await courseAdminData.create(course);
      router.push("/admin/courses");
    } catch (caught) {
      registeredPreviewKeys.forEach(removePendingAsset);
      setError(caught instanceof Error ? caught.message : "Could not import the course.");
      setImporting(false);
    }
  }

  const lessonCount = prepared?.manifest.modules.reduce((total, module) => total + module.lessons.length, 0) ?? 0;

  return (
    <AdminShell active="course-settings" title="Upload Course" description="Import a complete course package for review before it can be published." actions={<Link className="admin-outline-button admin-header-cancel" href="/admin/courses">Cancel</Link>}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <section className="admin-package-layout">
        <div className="admin-package-main">
          <article className="admin-package-card">
            <header><span>1</span><div><h2>Select every course file</h2><p>The importer checks the manifest and all referenced files before continuing.</p></div></header>
            <div className="admin-package-body">
              <label className="admin-package-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}>
                <input type="file" accept=".json,.md,.markdown,.png,.jpg,.jpeg,.webp" multiple onChange={chooseFiles} />
                <span aria-hidden="true">↑</span><strong>Choose course files</strong><small>or drag the complete course folder here</small>
              </label>
              <div className="admin-required-files"><span><b>Required</b> course.json</span><span><b>Required</b> welcome.json</span><span><b>Required</b> assessments.json</span><span><b>Referenced</b> Markdown and assets</span></div>
            </div>
          </article>

          {files.length > 0 && <article className="admin-package-card">
            <header><span>2</span><div><h2>Package contents</h2><p>{validating ? "Checking relationships and source ranges…" : prepared ? "All required course files passed validation." : "Resolve the validation message before importing."}</p></div></header>
            <div className="admin-upload-file-list">{files.map((file, index) => <div key={`${normalizedFilePath(file)}-${index}`}><span>{file.name}</span><small>{fileSize(file.size)}</small></div>)}</div>
          </article>}

          {prepared && <article className="admin-package-card admin-import-summary">
            <header><span>3</span><div><h2>Review import</h2><p>The imported course will not appear publicly.</p></div></header>
            <div className="admin-import-facts"><div><span>Course</span><strong>{prepared.manifest.metadata.title}</strong></div><div><span>Modules</span><strong>{prepared.manifest.modules.length}</strong></div><div><span>Lessons</span><strong>{lessonCount}</strong></div><div><span>Assessments</span><strong>{prepared.assessments.assessments.length}</strong></div><div><span>Status</span><strong>Unpublished draft</strong></div><div><span>Access</span><strong>Private</strong></div></div>
          </article>}
        </div>

        <aside className="admin-package-action">
          <span className="course-chip">◇ &nbsp; Safe import</span>
          <h2>Private by default</h2>
          <p>Every uploaded course starts as an unpublished private draft. An administrator must inspect it in the course builder and publish it manually.</p>
          <button className="primary-button" type="button" onClick={() => void importCourse()} disabled={!prepared || importing}>{importing ? "Importing…" : "Import private draft"}</button>
          <small>Course files and image previews remain local until backend file storage is connected.</small>
        </aside>
      </section>
    </AdminShell>
  );
}
