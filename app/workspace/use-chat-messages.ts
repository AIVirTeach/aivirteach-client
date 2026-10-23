"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../lib/api";
import { chatMessagesKey, createChatMessageController, type ChatMessage } from "./chat-message-controller";

export function useChatMessages(enrollmentId: string | undefined, generation: number | undefined, initialMessages: readonly ChatMessage[]) {
  const [controller] = useState(() => createChatMessageController(initialMessages));
  const key = chatMessagesKey(enrollmentId, generation);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => {
    controller.activate(key);
    if (!key || !enrollmentId || generation === undefined) return;
    void controller.load(key, async () => {
      const items = await api.chatMessages(enrollmentId, generation);
      return items.map(({ role, text }) => ({ role, text }));
    });
  }, [controller, enrollmentId, generation, key]);

  const appendMessage = useCallback((message: ChatMessage) => controller.append(key, message), [controller, key]);
  const loadMessages = useCallback((emptyFallback?: readonly ChatMessage[]) => {
    if (!key || !enrollmentId || generation === undefined) return Promise.resolve(false);
    return controller.load(key, async () => {
      const items = await api.chatMessages(enrollmentId, generation);
      return items.map(({ role, text }) => ({ role, text }));
    }, emptyFallback);
  }, [controller, enrollmentId, generation, key]);

  return {
    messages: snapshot.key === key ? snapshot.messages : initialMessages,
    appendMessage,
    loadMessages,
  };
}
