import { describe, expect, it, vi } from "vitest";
import { readTutorStream } from "./read-tutor-stream";

function source() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  return {
    response: new Response(stream),
    send(event: string, data: unknown) { controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); },
    close() { controller.close(); },
  };
}
const progress = (event: string, data = {}) => ({ type: "progress", event, data });
const complete = { type: "complete", studentMessage: { text: "question" }, tutorMessage: { text: "persisted answer" } };

describe("readTutorStream", () => {
  it("shows live text before completion and uses the persisted final answer", async () => {
    const input = source();
    const onDraft = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onDraft });
    input.send("assistant_delta", progress("assistant_delta", { delta: "live" }));
    await vi.waitFor(() => expect(onDraft).toHaveBeenCalledWith("live"));
    input.send("complete", complete);
    await expect(result).resolves.toBe("persisted answer");
  });
  it("clears failed draft and accepts authoritative fallback", async () => {
    const input = source(); const onDraft = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onDraft });
    input.send("assistant_delta", progress("assistant_delta", { delta: "partial" }));
    input.send("answer_failed", progress("answer_failed"));
    input.send("assistant_delta", progress("assistant_delta", { delta: "ignored" }));
    input.send("complete", complete);
    await expect(result).resolves.toBe("persisted answer");
    expect(onDraft.mock.calls).toEqual([["partial"], [""]]);
  });
  it("rejects an incomplete stream", async () => {
    const input = source();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onDraft: vi.fn() });
    input.close(); await expect(result).rejects.toThrow("before completion");
  });
  it("cancels an idle read when its context is aborted", async () => {
    const input = source(); const controller = new AbortController();
    const result = readTutorStream(input.response, { signal: controller.signal, onDraft: vi.fn() });
    controller.abort(); await expect(result).rejects.toThrow("before completion");
    expect(input.response.body?.locked).toBe(false);
  });
});
