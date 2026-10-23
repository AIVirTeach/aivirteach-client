export type ChatMessage = { role: "tutor" | "student"; text: string };
export type ChatMessagesSnapshot = { key: string; messages: readonly ChatMessage[] };

type Conversation = {
  messages: readonly ChatMessage[];
  localVersion: number;
  requestId: number;
};

export function chatMessagesKey(enrollmentId: string | undefined, generation: number | undefined) {
  if (!enrollmentId || generation === undefined || !Number.isSafeInteger(generation) || generation < 0) return "";
  return `${encodeURIComponent(enrollmentId)}:${generation}`;
}

export function createChatMessageController(initialMessages: readonly ChatMessage[]) {
  const conversations = new Map<string, Conversation>();
  const listeners = new Set<() => void>();
  let activeKey = "";
  let snapshot: ChatMessagesSnapshot = { key: "", messages: initialMessages };

  function publish() {
    const conversation = conversations.get(activeKey);
    snapshot = { key: activeKey, messages: conversation?.messages ?? initialMessages };
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    activate(key: string) {
      if (key === activeKey) return;
      const previous = conversations.get(activeKey);
      if (previous) previous.requestId += 1;
      activeKey = key;
      if (key && !conversations.has(key)) {
        conversations.set(key, { messages: initialMessages, localVersion: 0, requestId: 0 });
      }
      publish();
    },
    async load(key: string, read: () => Promise<readonly ChatMessage[]>, emptyFallback?: readonly ChatMessage[]) {
      const conversation = conversations.get(key);
      if (!key || key !== activeKey || !conversation) return false;
      const requestId = ++conversation.requestId;
      const localVersion = conversation.localVersion;
      try {
        const messages = await read();
        if (key !== activeKey || conversation.requestId !== requestId || conversation.localVersion !== localVersion) return false;
        conversation.messages = messages.length ? [...messages] : [...(emptyFallback ?? initialMessages)];
        publish();
        return true;
      } catch {
        return false;
      }
    },
    append(key: string, message: ChatMessage) {
      const conversation = conversations.get(key);
      if (!key || key !== activeKey || !conversation) return;
      conversation.messages = [...conversation.messages, message];
      conversation.localVersion += 1;
      publish();
    },
  };
}
