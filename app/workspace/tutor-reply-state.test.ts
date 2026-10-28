import { describe, expect, it } from "vitest";
import { initialTutorReply, reduceTutorReply } from "./tutor-reply-state";

describe("tutor reply projection", () => {
  it("keeps an answer provisional until the persisted completion arrives", () => {
    const draft = reduceTutorReply(initialTutorReply, { kind: "delta", text: "draft" });
    const generated = reduceTutorReply(draft, { kind: "answer-finished" });
    expect(generated).toEqual({ kind: "awaiting", draft: "draft" });
    const saving = reduceTutorReply(generated, { kind: "persisting" });
    expect(saving).toEqual({ kind: "saving", draft: "draft" });
    expect(reduceTutorReply(saving, { kind: "completed", text: "saved answer" })).toEqual({ kind: "completed", text: "saved answer" });
  });

  it("drops a failed draft and refuses late deltas until a new answer starts", () => {
    const failed = reduceTutorReply({ kind: "answering", draft: "incomplete" }, { kind: "answer-failed", reason: "answer" });
    expect(failed).toEqual({ kind: "fallback", reason: "answer" });
    expect(reduceTutorReply(failed, { kind: "delta", text: "late" })).toBe(failed);
    expect(reduceTutorReply(failed, { kind: "answer-started" })).toEqual({ kind: "answering", draft: "" });
  });

  it("does not let late generation events change a persisted reply", () => {
    const final = reduceTutorReply(initialTutorReply, { kind: "completed", text: "saved" });
    expect(reduceTutorReply(final, { kind: "delta", text: "late" })).toBe(final);
    expect(reduceTutorReply(final, { kind: "answer-failed", reason: "answer" })).toBe(final);
  });

  it("does not rewind a saving reply to diagnostics or append late deltas", () => {
    const saving = reduceTutorReply({ kind: "answering", draft: "draft" }, { kind: "persisting" });
    expect(reduceTutorReply(saving, { kind: "activity", activity: "tools" })).toBe(saving);
    expect(reduceTutorReply(saving, { kind: "delta", text: "late" })).toBe(saving);
  });
});
