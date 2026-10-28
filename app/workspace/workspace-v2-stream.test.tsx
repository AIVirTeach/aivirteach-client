// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ApiCourseDetail, type ApiEnrollment, type ApiLearningProgress, type ApiLesson } from "../lib/api";
import { WorkspaceV2 } from "./workspace-v2";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./use-course-learning-session", () => ({ useCourseLearningSession: mocks.session }));
vi.mock("./use-console-session", () => ({ useConsoleSession: () => ({
  session: null, error: "", loading: false, start: vi.fn(), stop: vi.fn(), reportViewerError: vi.fn(),
}) }));
vi.mock("./CourseLearningPath", () => ({ CourseLearningPath: () => <div>Learning path</div> }));

const course: ApiCourseDetail = {
  id: "course-1", title: "Course", category: "Coding", description: "Course description", level: "Beginner",
  durationMinutes: 30, lessonCount: 1, published: true, slug: "course", version: 1, shortTitle: "Course",
  language: "en", tags: [], outcomes: [], requirements: [], modules: [],
};
const enrollment: ApiEnrollment = {
  id: "enrollment-1", userId: "user-1", courseId: course.id, active: true, progressPercent: 0,
  currentModule: "module-1", enrolledAt: "2026-01-01", course,
};
const progress: ApiLearningProgress = {
  enrollmentId: enrollment.id, courseId: course.id, generation: 1, revision: 1,
  courseVersionId: "version-1", courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 1,
  currentLessonId: "lesson-1", nextLessonId: null, progressPercent: 0, status: "in_progress", achievements: [],
};
const lesson: ApiLesson = {
  courseVersionId: "version-1", courseVersion: 1, courseId: course.id,
  module: { id: "module-1", title: "Module", position: 0 },
  lesson: { id: "lesson-1", position: 0, title: "Lesson", estimatedMinutes: 30, objectives: [],
    activity: { type: "reading", prompt: "Read", completionType: "manual" } },
  blocks: [], assets: {}, assessment: null,
  navigation: { previousLessonId: null, nextLessonId: null, index: 0, total: 1 },
};
const encoder = new TextEncoder();
function stream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; } }));
  return {
    response,
    frame(event: string, payload: object) {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
    },
  };
}
function enter(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("V2 tutor stream wiring", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", { randomUUID: () => "request-1" });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    mocks.session.mockReturnValue({ selectedId: lesson.lesson.id, state: { status: "ready", id: lesson.lesson.id, lesson },
      progress: { snapshot: progress }, select: vi.fn(), retry: vi.fn() });
    vi.spyOn(api, "enrollments").mockResolvedValue([enrollment]);
    vi.spyOn(api, "course").mockResolvedValue(course);
    vi.spyOn(api, "workspace").mockResolvedValue({ id: "workspace-1", enrollmentId: enrollment.id, status: "STOPPED", errorMessage: null });
    vi.spyOn(api, "health").mockResolvedValue({ status: "ok", database: "up" });
    vi.spyOn(api, "chatMessages").mockResolvedValue([]);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<WorkspaceV2 />); });
    await act(async () => {});
  });

  afterEach(async () => {
    if (root) await act(async () => { root.unmount(); });
    host?.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders live deltas, clears failed drafts, and uses the authoritative fallback", async () => {
    const run = stream();
    const request = vi.spyOn(api, "streamChatMessage").mockResolvedValue(run.response);
    await act(async () => { host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click(); });
    const form = host.querySelector<HTMLFormElement>(".message-form");
    const input = form?.querySelector<HTMLInputElement>("input");
    expect(form).not.toBeNull();
    await act(async () => { if (input) enter(input, "Help"); });
    await act(async () => { form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { run.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "Partial" } }); });
    expect(host.querySelector(".message.tutor.pending")?.textContent).toContain("Partial");
    await act(async () => { run.frame("answer_failed", { type: "progress", event: "answer_failed", data: {} }); });
    expect(host.textContent).not.toContain("Partial");
    expect(host.querySelector(".message.tutor.pending")).not.toBeNull();
    await act(async () => { run.frame("complete", { type: "complete", studentMessage: { text: "Help" }, tutorMessage: { text: "Final" } }); });
    expect(host.querySelector(".message.tutor.pending")).toBeNull();
    expect(Array.from(host.querySelectorAll(".message.tutor"), (element) => element.textContent).join(" ")).toContain("Final");
    expect(host.textContent).not.toContain("Partial");
  });

});
