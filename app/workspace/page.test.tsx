// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCourseDetail, ApiLearningProgress, ApiLesson } from "../lib/api";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import WorkspacePage from "./page";

const summary = { id: "lesson-1", position: 1, title: "Activity lesson", estimatedMinutes: 5, objectives: [], activity: { type: "READ", prompt: "", completionType: "SELF" } };
const course: ApiCourseDetail = { id: "activity-course", slug: "activity-course", title: "Activity course", shortTitle: "Activity", category: "test", description: "", level: "Beginner", durationMinutes: 5, lessonCount: 1, published: true, version: 1, language: "en", tags: [], outcomes: [], requirements: [], modules: [{ id: "module-1", position: 1, title: "First module", description: "", estimatedMinutes: 5, lessons: [summary] }] };
const progress: ApiLearningProgress = { enrollmentId: "enrollment-1", courseId: course.id, generation: 0, revision: 0, courseVersionId: "version-1", courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 1, currentLessonId: "lesson-1", nextLessonId: "lesson-1", progressPercent: 0, status: "in_progress", achievements: [] };
const lesson: ApiLesson = { courseVersionId: "version-1", courseVersion: 1, courseId: course.id, module: { id: "module-1", title: "First module", position: 1 }, lesson: summary, blocks: [{ id: "body", type: "paragraph", props: { text: "Read the installation guide." } }], assessment: null, navigation: { previousLessonId: null, nextLessonId: null, index: 0, total: 1 } };

class WorkspaceSocket {
  close() {}
}

describe("V1 lesson activity from the course response", () => {
  let host: HTMLDivElement;
  let root: Root;
  let prompt: string;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("aivir-interface-version", "v1");
    localStorage.setItem("aivirteach.learning-language", "zh-CN");
    vi.stubGlobal("WebSocket", WorkspaceSocket);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname.replace("/api/v1", "");
      const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (path === "/me/enrollments") return response([{ id: "enrollment-1", courseId: course.id, active: true, course }]);
      if (path === `/courses/${course.id}`) return response(course);
      if (path === `/courses/${course.id}/lessons/${summary.id}`) return response({ ...lesson, lesson: { ...summary, activity: { ...summary.activity, prompt } } });
      if (path.endsWith("/progress") || path.endsWith("/reading-position")) return response(progress);
      if (path === "/workspaces/enrollment-1") return response({ id: "workspace-1", enrollmentId: "enrollment-1", status: "STOPPED", errorMessage: null });
      if (path.endsWith("/chat/messages")) return response([]);
      if (path === "/health") return response({ status: "ok" });
      return response({ message: "No fixture for this endpoint" }, 404);
    }));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
  it("renders the real activity prompt separately from lesson blocks", async () => {
    prompt = "安装完成后，请运行验证命令并解释输出。";
    await act(async () => root.render(<WorkspacePage />));
    expect(host.textContent).toContain("Read the installation guide.");
    expect(host.textContent).toContain(prompt);
    expect(host.textContent).toContain("课时活动");
    expect(host.querySelectorAll("button[data-completion-state]")).toHaveLength(1);
  });
  it("does not invent an activity when the lesson response has no instruction", async () => {
    prompt = "   ";
    await act(async () => root.render(<WorkspacePage />));
    expect(host.textContent).toContain("Read the installation guide.");
    expect(host.textContent).not.toContain("课时活动");
    expect(host.querySelectorAll("button[data-completion-state]")).toHaveLength(1);
  });
});
