import { describe, expect, it, vi } from "vitest";
import { readTutorStream, TutorReplyNotSavedError } from "./read-tutor-stream";

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
    const onState = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState });
    input.send("assistant_delta", progress("assistant_delta", { delta: "live" }));
    await vi.waitFor(() => expect(onState).toHaveBeenCalledWith({ kind: "answering", draft: "live" }));
    input.send("complete", complete);
    await expect(result).resolves.toBe("persisted answer");
  });
  it("clears failed draft and accepts authoritative fallback", async () => {
    const input = source(); const onState = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState });
    input.send("assistant_delta", progress("assistant_delta", { delta: "partial" }));
    input.send("answer_failed", progress("answer_failed"));
    input.send("assistant_delta", progress("assistant_delta", { delta: "ignored" }));
    input.send("complete", complete);
    await expect(result).resolves.toBe("persisted answer");
    expect(onState.mock.calls).toEqual([[{ kind: "answering", draft: "partial" }], [{ kind: "fallback", reason: "answer" }], [{ kind: "completed", text: "persisted answer" }]]);
  });
  it("distinguishes an invalid assessment from a failed answer draft", async () => {
    const input = source(); const onState = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState });
    input.send("answer_failed", progress("answer_failed", { code: "ASSESSMENT_INVALID" }));
    input.send("complete", complete);
    await result;
    expect(onState).toHaveBeenCalledWith({ kind: "fallback", reason: "assessment" });
  });
  it("rejects an incomplete stream", async () => {
    const input = source();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState: vi.fn() });
    input.close(); await expect(result).rejects.toThrow("before completion");
  });
  it("cancels an idle read when its context is aborted", async () => {
    const input = source(); const controller = new AbortController();
    const result = readTutorStream(input.response, { signal: controller.signal, onState: vi.fn() });
    controller.abort(); await expect(result).rejects.toThrow("before completion");
    expect(input.response.body?.locked).toBe(false);
  });
  it("keeps generation completion separate from saving and final confirmation", async () => {
    const input = source(); const onState = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState });
    input.send("assistant_delta", progress("assistant_delta", { delta: "draft" }));
    input.send("answer_finished", progress("answer_finished"));
    input.send("reply_persisting", progress("reply_persisting"));
    await vi.waitFor(() => expect(onState).toHaveBeenLastCalledWith({ kind: "saving", draft: "draft" }));
    expect(onState.mock.calls.some(([state]) => state.kind === "completed")).toBe(false);
    input.send("error", { code: "REPLY_NOT_SAVED" });
    await expect(result).rejects.toBeInstanceOf(TutorReplyNotSavedError);
  });
  it("maps tool progress to fixed learner statuses without exposing tool payload", async () => {
    const input = source(); const onState = vi.fn();
    const result = readTutorStream(input.response, { signal: new AbortController().signal, onState });
    input.send("tool_started", progress("tool_started", { tool: "private tool output" }));
    input.send("tool_finished", progress("tool_finished"));
    input.send("complete", complete);
    await result;
    expect(onState.mock.calls.slice(0, 2)).toEqual([[{ kind: "diagnosing", activity: "tools" }], [{ kind: "diagnosing", activity: "validating" }]]);
  });
});
