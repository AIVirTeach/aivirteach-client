import { describe, expect, it } from "vitest";
import { createLessonLoader, initialLessonId, type LessonLoadState } from "./course-lesson-loader";
import type { ApiCourseDetail, ApiLesson } from "../lib/api";

const course = { modules: [{ lessons: [{ id: "a" }, { id: "b" }] }] } as ApiCourseDetail;
describe("published lesson selection", () => {
  it("uses server reading position then next pending lesson, without percentage inference", () => {
    expect(initialLessonId(course, { currentLessonId: "a", nextLessonId: "b" })).toBe("a");
    expect(initialLessonId(course, { currentLessonId: "removed", nextLessonId: "b" })).toBe("b");
    expect(initialLessonId(course, { currentLessonId: null, nextLessonId: null })).toBe("a");
    expect(initialLessonId({ modules: [] } as unknown as ApiCourseDetail, { currentLessonId: null, nextLessonId: null })).toBe("");
  });
  it("ignores a late response after selecting a different lesson", async () => {
    const states: LessonLoadState[] = [];
    let finishA!: (lesson: ApiLesson) => void;
    const loader = createLessonLoader((id) => id === "a" ? new Promise((resolve) => { finishA = resolve; }) : Promise.resolve({ lesson: { id: "b" } } as ApiLesson), (state) => states.push(state));
    const a = loader.load("a");
    await loader.load("b");
    finishA({ lesson: { id: "a" } } as ApiLesson);
    await a;
    expect(states.map((state) => `${state.status}:${state.id}`)).toEqual(["loading:a", "loading:b", "ready:b"]);
  });
  it("reports failure, permits retry, and ignores a response after unmount", async () => {
    const states: LessonLoadState[] = [];
    let fail = true;
    const loader = createLessonLoader(async () => { if (fail) throw new Error("Offline"); return {} as ApiLesson; }, (state) => states.push(state));
    await loader.load("a");
    expect(states.at(-1)).toEqual({ status: "error", id: "a", message: "Offline" });
    fail = false;
    await loader.load("a");
    expect(states.at(-1)?.status).toBe("ready");
    const pending = loader.load("b");
    loader.dispose();
    await pending;
    expect(states.at(-1)).toEqual({ status: "loading", id: "b" });
  });
});
