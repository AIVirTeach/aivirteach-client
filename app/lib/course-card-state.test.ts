import { describe, expect, it } from "vitest";
import { courseCardState } from "./course-card-state";

describe("courseCardState", () => {
  it("没有报名记录：未开始，只显示 Start", () => {
    expect(courseCardState(undefined, false)).toEqual({ status: "not_started", isCurrent: false, actions: ["start"] });
  });

  it("刚 restart 的当前课：仍标记为当前，但按钮回到 Start", () => {
    expect(courseCardState("not_started", true)).toEqual({ status: "not_started", isCurrent: true, actions: ["start"] });
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
