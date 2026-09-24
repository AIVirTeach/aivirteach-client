export type ChatStreamFrame =
  | { type: "progress"; event: string; data: Record<string, unknown> }
  | { type: "complete"; studentMessage: { text: string }; tutorMessage: { text: string } };

function isTextMessage(value: unknown): value is { text: string } {
  return typeof value === "object" && value !== null && typeof (value as { text?: unknown }).text === "string";
}

// SSE 帧的 data 是后端拼的原始 JSON 字符串，格式跟后端约定不一致时不能让 JSON.parse
// 或者裸的 as 断言把一个技术性报错（"Cannot read properties of undefined"）直接甩给学生
// 看——解析/校验失败一律返回 null，调用方跳过这一帧，tutorText 保持 null 时走既有的
// "助教不可用"兜底文案，不用单独再造一条错误路径。
export function parseChatStreamFrame(raw: string): ChatStreamFrame | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || !("type" in data)) return null;
  const record = data as Record<string, unknown>;

  if (record.type === "progress" && typeof record.event === "string" && typeof record.data === "object" && record.data !== null) {
    return { type: "progress", event: record.event, data: record.data as Record<string, unknown> };
  }
  if (record.type === "complete" && isTextMessage(record.studentMessage) && isTextMessage(record.tutorMessage)) {
    return { type: "complete", studentMessage: record.studentMessage, tutorMessage: record.tutorMessage };
  }
  return null;
}
