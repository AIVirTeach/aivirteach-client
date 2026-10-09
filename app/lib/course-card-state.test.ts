import { describe, expect, it } from "vitest";
import { courseCardState, courseEntryPath, resolveEnrollmentStatus } from "./course-card-state";

describe("courseCardState", () => {
  it("没有报名记录：未开始，只显示 Start", () => {
    expect(courseCardState(undefined, false)).toEqual({ status: "not_started", isCurrent: false, actions: ["start"] });
  });

  it("当前课即使尚未记录进度，也显示 Restart + Continue 而不是自相矛盾的 Start", () => {
    expect(courseCardState("not_started", true)).toEqual({ status: "not_started", isCurrent: true, actions: ["restart", "continue"] });
  });

  it("学习中（包括暂停的课）：Restart + Continue", () => {
    expect(courseCardState("in_progress", false)).toEqual({ status: "in_progress", isCurrent: false, actions: ["restart", "continue"] });
  });

  it("已完成：只有 Restart", () => {
    expect(courseCardState("completed", true)).toEqual({ status: "completed", isCurrent: true, actions: ["restart"] });
  });

  it("服务端给了未知的 status（新状态、null、原型属性名）：按未开始处理，不能让页面崩溃", () => {
    for (const weird of ["archived", null, "", "toString"]) {
      expect(courseCardState(weird as never, false)).toEqual({ status: "not_started", isCurrent: false, actions: ["start"] });
    }
  });

  it("旧服务端没有 status，但这门课是当前课：按学习中处理，保留 Continue / Restart", () => {
    expect(courseCardState(undefined, true)).toEqual({ status: "in_progress", isCurrent: true, actions: ["restart", "continue"] });
  });
});

describe("resolveEnrollmentStatus", () => {
  it("认识的 status 原样返回，与是否当前课无关", () => {
    expect(resolveEnrollmentStatus("completed", true)).toBe("completed");
    expect(resolveEnrollmentStatus("not_started", true)).toBe("not_started");
    expect(resolveEnrollmentStatus("in_progress", false)).toBe("in_progress");
  });

  it("不认识的值（null、空串、原型属性名）一律按未开始处理，即使是当前课", () => {
    for (const weird of ["archived", null, "", "toString"]) {
      expect(resolveEnrollmentStatus(weird, true)).toBe("not_started");
    }
  });

  it("缺失 status：当前课按学习中（旧服务端），其余按未开始", () => {
    expect(resolveEnrollmentStatus(undefined, true)).toBe("in_progress");
    expect(resolveEnrollmentStatus(undefined, false)).toBe("not_started");
  });
});

describe("courseEntryPath", () => {
  it("学习中直接进 workspace，其余先看欢迎页", () => {
    expect(courseEntryPath("in_progress")).toBe("/workspace");
    expect(courseEntryPath("not_started")).toBe("/courses/welcome");
    expect(courseEntryPath("completed")).toBe("/courses/welcome");
    expect(courseEntryPath(undefined)).toBe("/courses/welcome");
  });

  it("旧服务端没有 status 的当前课：卡片显示 Continue，点进去也要进 workspace，而不是欢迎页", () => {
    const card = courseCardState(undefined, true);
    expect(card.actions).toContain("continue");
    expect(courseEntryPath(card.status)).toBe("/workspace");
  });
});
