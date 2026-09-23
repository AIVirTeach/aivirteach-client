import { describe, expect, it } from "vitest";
import { isHeartbeatDue } from "./heartbeat";

describe("isHeartbeatDue", () => {
  it("RUNNING 且可见且有焦点时为 true", () => {
    expect(isHeartbeatDue("RUNNING", true, true)).toBe(true);
  });

  it("不是 RUNNING 时为 false", () => {
    expect(isHeartbeatDue("STOPPED", true, true)).toBe(false);
    expect(isHeartbeatDue(undefined, true, true)).toBe(false);
  });

  it("标签页不可见时为 false", () => {
    expect(isHeartbeatDue("RUNNING", false, true)).toBe(false);
  });

  it("窗口没有焦点时为 false", () => {
    expect(isHeartbeatDue("RUNNING", true, false)).toBe(false);
  });
});
