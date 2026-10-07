import { describe, expect, it } from "vitest";
import { vmPanelState } from "./vm-panel-state";

describe("vmPanelState", () => {
  it("RUNNING 且控制台会话就绪时显示远程桌面", () => {
    expect(vmPanelState("RUNNING", true)).toBe("console");
  });

  it("RUNNING 但还没有控制台会话时显示启动远程桌面的按钮", () => {
    expect(vmPanelState("RUNNING", false)).toBe("start-console");
  });

  it("STOPPED 显示恢复按钮，而不是一直 Preparing", () => {
    expect(vmPanelState("STOPPED", false)).toBe("stopped");
  });

  it("ERROR 显示重试", () => {
    expect(vmPanelState("ERROR", false)).toBe("error");
  });

  it.each(["CREATING", undefined] as const)("%s 显示准备中", (status) => {
    expect(vmPanelState(status, false)).toBe("preparing");
  });
});
