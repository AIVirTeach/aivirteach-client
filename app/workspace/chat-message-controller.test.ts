import { describe, expect, it } from "vitest";
import { chatMessagesKey, createChatMessageController, type ChatMessage } from "./chat-message-controller";

const initial: ChatMessage[] = [{ role: "tutor", text: "Ready" }];
const oldHistory: ChatMessage[] = [{ role: "student", text: "Old round" }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("generation-scoped chat history", () => {
  it("uses an enrollment and generation key and rejects invalid generations", () => {
    expect(chatMessagesKey("enrollment:1", 0)).toBe("enrollment%3A1:0");
    expect(chatMessagesKey("enrollment-1", -1)).toBe("");
    expect(chatMessagesKey("enrollment-1", Number.NaN)).toBe("");
  });

  it("drops an old round history response after the active generation changes", async () => {
    const controller = createChatMessageController(initial);
    const oldKey = chatMessagesKey("enrollment-1", 4);
    const newKey = chatMessagesKey("enrollment-1", 5);
    const history = deferred<readonly ChatMessage[]>();
    controller.activate(oldKey);
    const loading = controller.load(oldKey, () => history.promise);

    controller.activate(newKey);
    history.resolve(oldHistory);

    expect(await loading).toBe(false);
    expect(controller.getSnapshot()).toEqual({ key: newKey, messages: initial });
  });

  it("does not let history or refresh replace a message sent while the request was pending", async () => {
    const controller = createChatMessageController(initial);
    const key = chatMessagesKey("enrollment-1", 5);
    const history = deferred<readonly ChatMessage[]>();
    controller.activate(key);
    const loading = controller.load(key, () => history.promise, initial);
    controller.append(key, { role: "student", text: "New local message" });
    history.resolve(oldHistory);

    expect(await loading).toBe(false);
    expect(controller.getSnapshot()).toEqual({
      key,
      messages: [...initial, { role: "student", text: "New local message" }],
    });
  });

  it("clears prior chat messages when the current generation has an empty history", async () => {
    const controller = createChatMessageController(initial);
    const key = chatMessagesKey("enrollment-1", 5);
    controller.activate(key);
    await controller.load(key, async () => oldHistory);
    await controller.load(key, async () => []);

    expect(controller.getSnapshot()).toEqual({ key, messages: initial });
  });

  it("accepts only the newest history request for the active round", async () => {
    const controller = createChatMessageController(initial);
    const key = chatMessagesKey("enrollment-1", 5);
    const earlier = deferred<readonly ChatMessage[]>();
    const later = deferred<readonly ChatMessage[]>();
    controller.activate(key);
    const firstLoad = controller.load(key, () => earlier.promise);
    const secondLoad = controller.load(key, () => later.promise);
    later.resolve([{ role: "student", text: "Latest history" }]);
    expect(await secondLoad).toBe(true);
    earlier.resolve(oldHistory);

    expect(await firstLoad).toBe(false);
    expect(controller.getSnapshot().messages).toEqual([{ role: "student", text: "Latest history" }]);
  });
});
