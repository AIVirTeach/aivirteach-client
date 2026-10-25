// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiLearningProgress } from "../lib/api";
import { applyLearningLanguage } from "../lib/language";
import { LessonCompletionButton } from "./LessonCompletionButton";
import { emptyProgress, type LearningProgressState } from "./learning-progress-controller";

const initial: ApiLearningProgress = { enrollmentId: "e", courseId: "c", generation: 0, revision: 0, courseVersionId: "v1", courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 9, currentLessonId: "a", nextLessonId: "a", progressPercent: 0, status: "in_progress", achievements: [] };
const command = { lessonId: "a", completed: true, courseVersionId: "v1", generation: 0 };
function progress(state: Partial<LearningProgressState> = {}) {
  return { ...emptyProgress, snapshot: initial, ...state, reload: vi.fn(), visit: vi.fn().mockResolvedValue(true), setCompleted: vi.fn().mockResolvedValue(true), retryCompletion: vi.fn().mockResolvedValue(true) };
}

describe("one lesson completion control", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
  it("has one localized action and course progress, without archive controls", async () => {
    const current = progress();
    await act(async () => root.render(<LessonCompletionButton lessonId="a" progress={current} />));
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(host.textContent).toContain("Mark lesson complete");
    expect(host.textContent).not.toMatch(/snapshot|history|评测/i);
    expect(host.querySelector("progress")?.max).toBe(100);
    await act(async () => { host.querySelector("button")?.click(); });
    expect(current.setCompleted).toHaveBeenCalledWith("a", true);
    await act(async () => applyLearningLanguage("zh-CN"));
    expect(host.textContent).toContain("标记本节已学完");
    expect(host.textContent).not.toContain("Mark lesson");
  });
  it("disables repeated clicks while saving and announces the state", async () => {
    const current = progress({ busy: true, completion: { status: "saving", command } });
    await act(async () => root.render(<LessonCompletionButton lessonId="a" progress={current} />));
    const button = host.querySelector("button");
    expect(button?.disabled).toBe(true);
    expect(button?.dataset.completionState).toBe("saving");
    expect(button?.getAttribute("aria-busy")).toBe("true");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Saving…");
    await act(async () => button?.click());
    expect(current.setCompleted).not.toHaveBeenCalled();
  });
  it("shows saved only for confirmed action and reuses the same control to undo", async () => {
    const snapshot = { ...initial, completedLessonIds: ["a"], progressPercent: 11 };
    const current = progress({ snapshot, completion: { status: "saved", command } });
    await act(async () => root.render(<LessonCompletionButton lessonId="a" progress={current} />));
    expect(host.textContent).toContain("Completed · Saved");
    expect(host.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => host.querySelector("button")?.click());
    expect(current.setCompleted).toHaveBeenCalledWith("a", false);
    await act(async () => root.render(<LessonCompletionButton lessonId="a" progress={progress({ snapshot })} />));
    expect(host.textContent).toContain("Lesson completed");
    expect(host.textContent).not.toContain("Saved");
  });
  it("retries the retained command even when the live progress could not be loaded", async () => {
    const current = progress({ snapshot: null, completion: { status: "failed", command } });
    await act(async () => root.render(<LessonCompletionButton lessonId="a" progress={current} />));
    expect(host.querySelector("button")?.disabled).toBe(false);
    expect(host.querySelector("button")?.dataset.completionState).toBe("failed");
    await act(async () => host.querySelector("button")?.click());
    expect(current.retryCompletion).toHaveBeenCalledTimes(1);
    expect(current.setCompleted).not.toHaveBeenCalled();
    expect(current.reload).not.toHaveBeenCalled();
  });
  it("does not display another lesson's save or failure feedback", async () => {
    const current = progress({ completion: { status: "failed", command } });
    await act(async () => root.render(<LessonCompletionButton lessonId="b" progress={current} />));
    expect(host.textContent).toContain("Mark lesson complete");
    expect(host.querySelector("button")?.dataset.completionState).toBe("idle");
    await act(async () => host.querySelector("button")?.click());
    expect(current.setCompleted).toHaveBeenCalledWith("b", true);
    expect(current.retryCompletion).not.toHaveBeenCalled();
  });
});
