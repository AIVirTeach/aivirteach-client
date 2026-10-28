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
    close() { controller.close(); },
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

  async function submitTeacher(run: ReturnType<typeof stream>) {
    vi.spyOn(api, "streamChatMessage").mockResolvedValue(run.response);
    await act(async () => { host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="false"]')?.click(); });
    const form = host.querySelector<HTMLFormElement>(".message-form")!;
    const input = form.querySelector<HTMLInputElement>("input")!;
    await act(async () => { enter(input, "Help"); });
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  }

  it("opens the teacher panel immediately after a floating question", async () => {
    const run = stream();
    vi.spyOn(api, "streamChatMessage").mockResolvedValue(run.response);
    await act(async () => { host.querySelector<HTMLButtonElement>(".floating-ai-button")?.click(); });
    const form = host.querySelector<HTMLFormElement>(".floating-ai-prompt")!;
    const input = form.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, "Help");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.querySelector(".lab-v2-teacher")).not.toBeNull();
    expect(host.querySelector(".floating-ai-prompt")).toBeNull();
    await act(async () => { run.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "Live floating reply" } }); });
    expect(host.querySelector(".message.tutor.pending")?.textContent).toContain("Live floating reply");
  });

  it("does not publish an unsaved reply and explains a save failure", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => {
      run.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "Unsaved draft" } });
      run.frame("reply_persisting", { type: "progress", event: "reply_persisting", data: {} });
    });
    expect(host.querySelector(".message.tutor.pending")?.textContent).toContain("Saving the reply");
    await act(async () => { run.frame("error", { code: "REPLY_NOT_SAVED" }); });
    expect(host.textContent).not.toContain("Unsaved draft");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be confirmed as saved");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Refresh the conversation");
    expect(Array.from(host.querySelectorAll("button")).some(button => button.textContent === "Refresh conversation")).toBe(true);
    expect(host.querySelector(".message.tutor.pending")).toBeNull();
  });

  it("treats EOF as unconfirmed instead of a completed reply", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => {
      run.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "Interrupted draft" } });
      run.close();
    });
    expect(host.textContent).not.toContain("Interrupted draft");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be confirmed");
  });

  it("stops receiving without claiming the backend was cancelled", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => {
      Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Stop receiving')?.click();
    });
    expect(host.textContent).toContain("The tutor may continue and save it");
    expect(host.querySelector(".message.tutor.pending")).toBeNull();
    expect(run.response.body?.locked).toBe(false);
  });

  it("refreshes saved history after stopping without remounting the workspace", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => {
      Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Stop receiving")?.click();
    });
    expect(host.textContent).toContain("Refresh the conversation to check");
    vi.mocked(api.chatMessages).mockResolvedValue([
      { id: "student-1", userId: "user-1", threadId: "thread-1", createdAt: "2026-01-01", role: "student", text: "Help" },
      { id: "tutor-1", userId: "user-1", threadId: "thread-1", createdAt: "2026-01-01", role: "tutor", text: "Saved after stopping" },
    ]);
    const workspaceLoads = vi.mocked(api.workspace).mock.calls.length;
    await act(async () => {
      Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Refresh conversation")?.click();
    });
    expect(host.textContent).toContain("Saved after stopping");
    expect(host.textContent).toContain("Conversation refreshed");
    expect(api.workspace).toHaveBeenCalledTimes(workspaceLoads);
    expect(api.streamChatMessage).toHaveBeenCalledTimes(1);
  });

  it("preserves messages on a history refresh failure and allows retry", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => { run.close(); });
    vi.mocked(api.chatMessages).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => {
      Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Refresh conversation")?.click();
    });
    expect(host.textContent).toContain("Could not refresh the conversation");
    expect(host.querySelector(".message.student")?.textContent).toContain("Help");
    expect(Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Refresh conversation")?.disabled).toBe(false);
  });

  it("does not overwrite a new reply when an old history refresh returns", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => { run.close(); });
    let resolveHistory!: (messages: Awaited<ReturnType<typeof api.chatMessages>>) => void;
    vi.mocked(api.chatMessages).mockReturnValueOnce(new Promise(resolve => { resolveHistory = resolve; }));
    await act(async () => {
      Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Refresh conversation")?.click();
    });
    expect(Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Refreshing...")?.disabled).toBe(true);
    const next = stream();
    vi.mocked(api.streamChatMessage).mockResolvedValueOnce(next.response);
    await act(async () => { enter(host.querySelector<HTMLInputElement>(".message-form input")!, "New question"); });
    await act(async () => { host.querySelector(".message-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await act(async () => { next.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "New reply" } }); });
    await act(async () => { resolveHistory([]); });
    expect(host.querySelector(".message.tutor.pending")?.textContent).toContain("New reply");
    expect(host.textContent).toContain("New question");
    expect(host.textContent).not.toContain("Could not refresh the conversation");
  });

  it("hides and cancels the old draft when the lesson context changes", async () => {
    const run = stream(); await submitTeacher(run);
    await act(async () => { run.frame("assistant_delta", { type: "progress", event: "assistant_delta", data: { delta: "Old lesson draft" } }); });
    mocks.session.mockReturnValue({ selectedId: "lesson-2", state: { status: "ready", id: "lesson-2", lesson: { ...lesson, lesson: { ...lesson.lesson, id: "lesson-2" } } }, progress: { snapshot: progress }, select: vi.fn(), retry: vi.fn() });
    await act(async () => { root.render(<WorkspaceV2 />); });
    expect(host.textContent).not.toContain("Old lesson draft");
    expect(host.querySelector(".message.tutor.pending")).toBeNull();
    expect(run.response.body?.locked).toBe(false);
  });
});
