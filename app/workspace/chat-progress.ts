type ProgressData = Record<string, unknown>;

const LABELS: Record<string, (data: ProgressData) => string> = {
  context_ready: () => "已加载课程与当前步骤上下文",
  reasoning_started: (data) =>
    `开始分析问题${typeof data.turn === "number" ? `（第 ${data.turn} 轮推理）` : ""}`,
  reasoning_finished: () => "已生成回答",
  tool_started: (data) => `正在调用工具：${typeof data.tool === "string" ? data.tool : "diagnostic tool"}`,
  tool_finished: (data) =>
    `工具执行完成${typeof data.duration_ms === "number" ? ` (${data.duration_ms}ms)` : ""}`,
};

// labs 转发的事件里混杂着生命周期帧（accepted/started/done/error），这些已经有专门的 UI
// 状态处理，这里只挑出"过程性"事件转成人类可读的进度条目；不认识的事件返回 null 表示不展示。
export function progressLabel(event: string, data: ProgressData): string | null {
  return LABELS[event]?.(data) ?? null;
}
