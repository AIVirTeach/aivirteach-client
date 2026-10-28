export type ChatStreamFrame =
  | { type: "progress"; event: string; data: Record<string, unknown> }
  | { type: "complete"; studentMessage: { text: string }; tutorMessage: { text: string } };

function isTextMessage(value: unknown): value is { text: string } {
  return typeof value === "object" && value !== null && typeof (value as { text?: unknown }).text === "string";
}

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
