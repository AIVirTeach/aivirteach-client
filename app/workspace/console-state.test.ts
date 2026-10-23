import { describe, expect, it } from "vitest";
import { consoleStateAfterLifecycleChange, consoleStateFor, updateConsoleStateIfCurrent, type KeyedConsoleState } from "./console-state";
import { createAsyncRequestOwner } from "./async-request-owner";

describe("workspace console lifecycle state", () => {
  it("resets session, error and loading for STOPPED then RUNNING on the same workspace ID", () => {
    const ready: KeyedConsoleState = { key: "ws-1:RUNNING", value: { session: { labId: "lab-old", state: "ready", data: "token-old" }, error: "", loading: false } };
    const stopped = consoleStateAfterLifecycleChange("ws-1:STOPPED", ready);
    expect(stopped).toBeNull();
    const resumed = consoleStateAfterLifecycleChange("ws-1:RUNNING", stopped);
    expect(resumed).toBeNull();
    expect(consoleStateFor("ws-1:RUNNING", resumed)).toEqual({ session: null, error: "", loading: false });
  });

  it("ignores a late callback owned by an old lifecycle key", () => {
    const running: KeyedConsoleState = { key: "ws-1:RUNNING", value: { session: null, error: "", loading: true } };
    const stopped = consoleStateAfterLifecycleChange("ws-1:STOPPED", running);
    expect(updateConsoleStateIfCurrent("ws-1:STOPPED", "ws-1:RUNNING", stopped, (state) => ({ ...state, session: { labId: "old", state: "ready" } }))).toBeNull();
  });

  it("rejects an in-flight RUNNING request after STOPPED then RUNNING on the same workspace", async () => {
    const owner = createAsyncRequestOwner();
    let finishFirst!: (value: string) => void;
    let finishSecond!: (value: string) => void;
    const published: string[] = [];
    const firstOwner = owner.begin();
    const first = owner.run(firstOwner, () => new Promise<string>((resolve) => { finishFirst = resolve; }), (value) => published.push(value), () => undefined);
    owner.invalidate();
    const secondOwner = owner.begin();
    const second = owner.run(secondOwner, () => new Promise<string>((resolve) => { finishSecond = resolve; }), (value) => published.push(value), () => undefined);
    finishFirst("stale session");
    await first;
    expect(published).toEqual([]);
    finishSecond("resumed session");
    await second;
    expect(published).toEqual(["resumed session"]);
  });
});
