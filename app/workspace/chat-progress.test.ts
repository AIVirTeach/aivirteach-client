import { describe, expect, it } from "vitest";
import { progressLabel } from "./chat-progress";

describe("progressLabel", () => {
  it("context_ready 映射成固定文案", () => {
    expect(progressLabel("context_ready", {})).toBe("已加载课程与当前步骤上下文");
  });

  it("reasoning_started 带上轮次", () => {
    expect(progressLabel("reasoning_started", { turn: 2 })).toBe("开始分析问题（第 2 轮推理）");
  });

  it("reasoning_started 没有 turn 字段时不显示轮次", () => {
    expect(progressLabel("reasoning_started", {})).toBe("开始分析问题");
  });

  it("tool_started 带上工具名", () => {
    expect(progressLabel("tool_started", { tool: "check_workspace_status" })).toBe(
      "正在调用工具：check_workspace_status",
    );
  });

  it("tool_finished 带上耗时", () => {
    expect(progressLabel("tool_finished", { duration_ms: 320 })).toBe("工具执行完成 (320ms)");
  });

  it("reasoning_finished 映射成固定文案", () => {
    expect(progressLabel("reasoning_finished", {})).toBe("已生成回答");
  });

  it("未识别的事件（如 accepted/started/done/error）返回 null，不显示进度条目", () => {
    expect(progressLabel("accepted", { status: "accepted" })).toBeNull();
    expect(progressLabel("started", { phase: "diagnosis" })).toBeNull();
    expect(progressLabel("done", { status: "completed" })).toBeNull();
    expect(progressLabel("error", { code: "AGENT_STREAM_FAILED" })).toBeNull();
  });
});
