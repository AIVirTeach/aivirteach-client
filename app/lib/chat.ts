import type { ApiChatMessage, ApiSendChatMessageInput } from "./api";

export type ChatViewMessage = Pick<ApiChatMessage, "id" | "role" | "text" | "createdAt">;

export function courseChatThreadId(userId: string, courseId: string) {
  const learner = userId.trim();
  const course = courseId.trim();
  if (!learner || !course) throw new Error("A learner and course are required to open a tutor conversation.");

  return `chat:v1:${encodeURIComponent(learner)}:${encodeURIComponent(course)}`;
}

export function createChatMessageInput(text: string, courseId: string, lessonId: string): ApiSendChatMessageInput {
  const normalizedText = text.trim();
  const course = courseId.trim();
  const lesson = lessonId.trim();
  if (!normalizedText || !course || !lesson) throw new Error("A message, course, and lesson are required to ask the tutor.");
  return { text: normalizedText, courseId: course, lessonId: lesson };
}

export function toChatViewMessage(message: ApiChatMessage): ChatViewMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  };
}

export function mergeChatMessages(current: ChatViewMessage[], incoming: ChatViewMessage[]) {
  const knownIds = new Set(current.map((message) => message.id));
  const merged = [...current];
  for (const message of incoming) {
    if (knownIds.has(message.id)) continue;
    knownIds.add(message.id);
    merged.push(message);
  }
  return merged;
}
